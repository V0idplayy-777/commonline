import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

const modeValidator = v.union(v.literal("all"), v.literal("following"), v.literal("saved"));

async function signedInProfile(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Sign in to continue.");
  const user = await ctx.db.get(userId);
  if (!user?.displayName.trim()) throw new ConvexError("Complete your profile before continuing.");
  return user;
}

export const feed = query({
  args: { mode: modeValidator, search: v.string() },
  handler: async (ctx, { mode, search }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const viewer = await ctx.db.get(userId);
    if (!viewer?.displayName.trim()) return [];

    const needle = search.trim();
    let posts;
    if (mode === "saved") {
      const bookmarks = await ctx.db
        .query("bookmarks")
        .withIndex("by_user_created", (q) => q.eq("userId", userId))
        .order("desc")
        .take(100);
      const bookmarkedPosts = await Promise.all(bookmarks.map((bookmark) => ctx.db.get(bookmark.postId)));
      posts = bookmarkedPosts
        .filter((post) => post !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
      if (needle) {
        const lower = needle.toLowerCase();
        posts = posts.filter((post) => post.searchText.toLowerCase().includes(lower));
      }
    } else if (mode === "following") {
      const follows = await ctx.db
        .query("follows")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const authorIds = [userId, ...follows.map((follow) => follow.targetId)];
      const groups = await Promise.all(authorIds.map((authorId) =>
        ctx.db.query("posts")
          .withIndex("by_author_created", (q) => q.eq("authorId", authorId))
          .order("desc")
          .take(needle ? 80 : 30),
      ));
      posts = groups.flat().sort((a, b) => b.createdAt - a.createdAt);
      if (needle) {
        const lower = needle.toLowerCase();
        posts = posts.filter((post) => post.searchText.toLowerCase().includes(lower));
      }
    } else if (needle) {
      posts = await ctx.db.query("posts")
        .withSearchIndex("search_content", (q) => q.search("searchText", needle))
        .take(80);
    } else {
      posts = await ctx.db.query("posts").withIndex("by_created").order("desc").take(40);
    }

    const distinct = new Map(posts.map((post) => [post._id, post]));
    const ordered = [...distinct.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 40);
    const savedRows = await ctx.db.query("bookmarks")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .collect();
    const savedIds = new Set(savedRows.map((row) => row.postId));

    return Promise.all(ordered.map(async (post) => {
      const author = await ctx.db.get(post.authorId);
      if (!author?.displayName.trim()) return null;
      const [like, recentComments] = await Promise.all([
        ctx.db.query("likes")
          .withIndex("by_post_user", (q) => q.eq("postId", post._id).eq("userId", userId))
          .unique(),
        ctx.db.query("comments")
          .withIndex("by_post_created", (q) => q.eq("postId", post._id))
          .order("desc")
          .take(4),
      ]);
      const comments = await Promise.all(recentComments.map(async (comment) => {
        const commenter = await ctx.db.get(comment.authorId);
        if (!commenter) return null;
        return {
          id: comment._id,
          body: comment.body,
          createdAt: comment.createdAt,
          name: commenter.displayName,
          handle: commenter.handle,
          initials: initials(commenter.displayName),
          avatar: commenter.avatarColor,
        };
      }));
      return {
        id: post._id,
        body: post.body,
        topic: post.topic,
        createdAt: post.createdAt,
        likes: post.likesCount,
        liked: like !== null,
        saved: savedIds.has(post._id),
        commentCount: post.commentsCount,
        author: {
          id: author._id,
          name: author.displayName,
          handle: author.handle,
          role: author.role,
          initials: initials(author.displayName),
          avatar: author.avatarColor,
        },
        comments: comments.filter((comment) => comment !== null).reverse(),
      };
    })).then((items) => items.filter((item) => item !== null));
  },
});

export const topics = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const posts = await ctx.db.query("posts").withIndex("by_created").order("desc").take(300);
    const counts = new Map<string, number>();
    for (const post of posts) {
      const topic = post.topic.trim();
      if (topic) counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 12);
  },
});

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { members: 0, posts: 0 };
    const [users, posts] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("posts").collect(),
    ]);
    return {
      members: users.filter((user) => user.displayName.trim()).length,
      posts: posts.length,
    };
  },
});

export const create = mutation({
  args: { body: v.string(), topic: v.string() },
  handler: async (ctx, { body, topic }) => {
    const author = await signedInProfile(ctx);
    const cleanBody = body.trim();
    const cleanTopic = topic.trim();
    if (cleanBody.length < 1 || cleanBody.length > 1000) {
      throw new ConvexError("Updates must be between 1 and 1,000 characters.");
    }
    if (cleanTopic.length < 1 || cleanTopic.length > 40) {
      throw new ConvexError("Choose a topic under 40 characters.");
    }
    const postId = await ctx.db.insert("posts", {
      authorId: author._id,
      body: cleanBody,
      topic: cleanTopic,
      searchText: `${cleanBody} ${cleanTopic} ${author.displayName} ${author.handle} ${author.role}`,
      likesCount: 0,
      commentsCount: 0,
      createdAt: Date.now(),
    });
    return postId;
  },
});

export const toggleLike = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const user = await signedInProfile(ctx);
    const post = await ctx.db.get(postId);
    if (!post) throw new ConvexError("Post not found.");
    const existing = await ctx.db.query("likes")
      .withIndex("by_post_user", (q) => q.eq("postId", postId).eq("userId", user._id))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(postId, { likesCount: Math.max(0, post.likesCount - 1) });
      return { liked: false, likes: Math.max(0, post.likesCount - 1) };
    }
    await ctx.db.insert("likes", { postId, userId: user._id, createdAt: Date.now() });
    await ctx.db.patch(postId, { likesCount: post.likesCount + 1 });
    return { liked: true, likes: post.likesCount + 1 };
  },
});

export const reply = mutation({
  args: { postId: v.id("posts"), body: v.string() },
  handler: async (ctx, { postId, body }) => {
    const author = await signedInProfile(ctx);
    const cleanBody = body.trim();
    if (cleanBody.length < 1 || cleanBody.length > 500) {
      throw new ConvexError("Replies must be between 1 and 500 characters.");
    }
    const post = await ctx.db.get(postId);
    if (!post) throw new ConvexError("Post not found.");
    const commentId = await ctx.db.insert("comments", {
      postId,
      authorId: author._id,
      body: cleanBody,
      createdAt: Date.now(),
    });
    await ctx.db.patch(postId, { commentsCount: post.commentsCount + 1 });
    if (post.authorId !== author._id) {
      await ctx.db.insert("notifications", {
        recipientId: post.authorId,
        actorId: author._id,
        kind: "reply",
        postId,
        createdAt: Date.now(),
      });
    }
    return commentId;
  },
});

export const toggleBookmark = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const user = await signedInProfile(ctx);
    if (!(await ctx.db.get(postId))) throw new ConvexError("Post not found.");
    const existing = await ctx.db.query("bookmarks")
      .withIndex("by_post_user", (q) => q.eq("postId", postId).eq("userId", user._id))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { saved: false };
    }
    await ctx.db.insert("bookmarks", { postId, userId: user._id, createdAt: Date.now() });
    return { saved: true };
  },
});

export const remove = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const user = await signedInProfile(ctx);
    const post = await ctx.db.get(postId);
    if (!post || post.authorId !== user._id) throw new ConvexError("You can only remove your own updates.");
    const [comments, likes, bookmarks, notifications] = await Promise.all([
      ctx.db.query("comments").withIndex("by_post_created", (q) => q.eq("postId", postId)).collect(),
      ctx.db.query("likes").withIndex("by_post", (q) => q.eq("postId", postId)).collect(),
      ctx.db.query("bookmarks").withIndex("by_post", (q) => q.eq("postId", postId)).collect(),
      ctx.db.query("notifications").withIndex("by_post", (q) => q.eq("postId", postId)).collect(),
    ]);
    for (const item of comments) await ctx.db.delete(item._id);
    for (const item of likes) await ctx.db.delete(item._id);
    for (const item of bookmarks) await ctx.db.delete(item._id);
    for (const item of notifications) await ctx.db.delete(item._id);
    await ctx.db.delete(postId);
    return { removed: true };
  },
});

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
