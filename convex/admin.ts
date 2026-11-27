import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  ADMIN_USERNAMES,
  SESSION_TTL_MS,
  adminIdentity,
  getSettings,
  logAdmin,
  passwordMatches,
  randomToken,
  readSettingsDoc,
  requireAdmin,
  settingsForWrite,
  withDefaults,
} from "./adminShared";

const moodValidator = v.union(v.literal("info"), v.literal("warning"), v.literal("party"));

async function purgePost(ctx: MutationCtx, postId: Id<"posts">) {
  const [comments, likes, bookmarks, notifications] = await Promise.all([
    ctx.db.query("comments").withIndex("by_post_created", (q) => q.eq("postId", postId)).collect(),
    ctx.db.query("likes").withIndex("by_post", (q) => q.eq("postId", postId)).collect(),
    ctx.db.query("bookmarks").withIndex("by_post", (q) => q.eq("postId", postId)).collect(),
    ctx.db.query("notifications").withIndex("by_post", (q) => q.eq("postId", postId)).collect(),
  ]);
  for (const row of comments) await ctx.db.delete(row._id);
  for (const row of likes) await ctx.db.delete(row._id);
  for (const row of bookmarks) await ctx.db.delete(row._id);
  for (const row of notifications) await ctx.db.delete(row._id);
  await ctx.db.delete(postId);
}

/* ------------------------------------------------------------------ *
 * Unlock gate
 * ------------------------------------------------------------------ */

export const unlock = mutation({
  args: { password: v.string() },
  returns: v.object({ token: v.string(), name: v.string(), expiresAt: v.number() }),
  handler: async (ctx, { password }) => {
    const identity = await adminIdentity(ctx);
    if (!identity) throw new ConvexError("This account does not have admin access.");
    if (!passwordMatches(password)) throw new ConvexError("That password is not correct.");

    const sessions = await ctx.db
      .query("adminSessions")
      .withIndex("by_user", (q) => q.eq("userId", identity.user._id))
      .collect();
    const now = Date.now();
    for (const row of sessions) {
      if (row.expiresAt < now) await ctx.db.delete(row._id);
    }

    const token = randomToken();
    await ctx.db.insert("adminSessions", {
      userId: identity.user._id,
      token,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
      lastUsedAt: now,
    });
    await logAdmin(ctx, identity, "unlock", "Unlocked the admin console.");
    return {
      token,
      name: identity.user.displayName || identity.username,
      expiresAt: now + SESSION_TTL_MS,
    };
  },
});

export const lock = mutation({
  args: { token: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token }) => {
    const identity = await requireAdmin(ctx, token);
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q) => q.eq("token", token.trim()))
      .unique();
    if (session) await ctx.db.delete(session._id);
    await logAdmin(ctx, identity, "lock", "Locked the admin console.");
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ *
 * Read models
 * ------------------------------------------------------------------ */

/** Anything the whole network should see, including the troll overlays. */
export const publicState = query({
  args: {},
  handler: async (ctx) => {
    const settings = await getSettings(ctx);
    const bomb = settings.shrekBomb && settings.shrekBomb.expiresAt > Date.now() ? settings.shrekBomb : undefined;
    return {
      announcement: settings.announcement ?? null,
      readOnly: settings.readOnly,
      slowModeSeconds: settings.slowModeSeconds,
      chaos: settings.chaos,
      upsideDown: settings.upsideDown,
      lockedTopics: settings.lockedTopics,
      shrekBomb: bomb ?? null,
    };
  },
});

export const overview = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const identity = await adminIdentity(ctx);
    if (!identity) return null;
    const clean = token.trim();
    if (!clean) return null;
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q) => q.eq("token", clean))
      .unique();
    if (!session || session.userId !== identity.user._id || session.expiresAt < Date.now()) return null;

    const settings = withDefaults(await readSettingsDoc(ctx));
    const [users, posts, log] = await Promise.all([
      ctx.db.query("users").withIndex("by_created").order("desc").take(200),
      ctx.db.query("posts").withIndex("by_created").order("desc").take(25),
      ctx.db.query("adminLog").withIndex("by_created").order("desc").take(15),
    ]);
    const allPosts = await ctx.db.query("posts").collect();

    const memberRows = users
      .filter((user) => user.displayName.trim().length > 0)
      .map((user) => ({
        id: user._id,
        name: user.displayName,
        handle: user.handle,
        role: user.role,
        bio: user.bio,
        avatar: user.avatarColor,
        verified: user.verified === true,
        suspended: user.suspended === true,
        createdAt: user.createdAt,
      }));

    const postRows = await Promise.all(posts.map(async (post) => {
      const author = await ctx.db.get(post.authorId);
      return {
        id: post._id,
        authorId: post.authorId,
        authorName: author?.displayName ?? "Unknown member",
        authorHandle: author?.handle ?? "",
        body: post.body.length > 160 ? `${post.body.slice(0, 157)}…` : post.body,
        topic: post.topic,
        likes: post.likesCount,
        comments: post.commentsCount,
        pinned: post.pinnedAt !== undefined,
        createdAt: post.createdAt,
      };
    }));

    const topicCounts = new Map<string, number>();
    for (const post of allPosts) {
      const topic = post.topic.trim();
      if (topic) topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }

    return {
      admin: {
        name: identity.user.displayName || identity.username,
        username: identity.username || identity.user.handle,
        allowList: [...ADMIN_USERNAMES],
        expiresAt: session.expiresAt,
      },
      settings,
      stats: {
        members: memberRows.length,
        posts: allPosts.length,
        suspended: memberRows.filter((member) => member.suspended).length,
        verified: memberRows.filter((member) => member.verified).length,
        pinned: allPosts.filter((post) => post.pinnedAt !== undefined).length,
      },
      members: memberRows,
      posts: postRows,
      topics: [...topicCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 20),
      log: log.map((entry) => ({
        id: entry._id,
        actor: entry.actorName,
        action: entry.action,
        detail: entry.detail,
        createdAt: entry.createdAt,
      })),
    };
  },
});

/* ------------------------------------------------------------------ *
 * 1. Global announcement
 * ------------------------------------------------------------------ */

export const setAnnouncement = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    body: v.string(),
    mood: moodValidator,
    party: v.boolean(),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token, title, body, mood, party }) => {
    const admin = await requireAdmin(ctx, token);
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (cleanTitle.length < 2 || cleanTitle.length > 90) {
      throw new ConvexError("Give the announcement a title between 2 and 90 characters.");
    }
    if (cleanBody.length < 2 || cleanBody.length > 400) {
      throw new ConvexError("Keep the announcement body between 2 and 400 characters.");
    }
    const id = await settingsForWrite(ctx);
    const doc = await ctx.db.get(id);
    const burst = party ? (doc?.announcement?.burst ?? 0) + 1 : (doc?.announcement?.burst ?? 0);
    await ctx.db.patch(id, {
      announcement: {
        title: cleanTitle,
        body: cleanBody,
        mood,
        author: admin.username || admin.user.displayName,
        createdAt: Date.now(),
        burst,
      },
      updatedAt: Date.now(),
    });
    await logAdmin(ctx, admin, "announcement", `${party ? "Party " : ""}announcement: ${cleanTitle}`);
    return { ok: true };
  },
});

export const clearAnnouncement = mutation({
  args: { token: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token }) => {
    const admin = await requireAdmin(ctx, token);
    const id = await settingsForWrite(ctx);
    await ctx.db.patch(id, { announcement: undefined, updatedAt: Date.now() });
    await logAdmin(ctx, admin, "announcement", "Took the announcement down.");
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ *
 * 2. Direct alert to one member
 * ------------------------------------------------------------------ */

export const alertMember = mutation({
  args: { token: v.string(), targetId: v.id("users"), title: v.string(), body: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token, targetId, title, body }) => {
    const admin = await requireAdmin(ctx, token);
    const target = await ctx.db.get(targetId);
    if (!target) throw new ConvexError("Member not found.");
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (cleanTitle.length < 2 || cleanTitle.length > 80) throw new ConvexError("Alert title must be 2–80 characters.");
    if (cleanBody.length < 2 || cleanBody.length > 400) throw new ConvexError("Alert body must be 2–400 characters.");
    await ctx.db.insert("notifications", {
      recipientId: targetId,
      actorId: admin.user._id,
      kind: "system",
      title: cleanTitle,
      message: cleanBody,
      createdAt: Date.now(),
    });
    await logAdmin(ctx, admin, "alert", `Alerted @${target.handle || target.displayName}: ${cleanTitle}`);
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ *
 * 3–8. Member management
 * ------------------------------------------------------------------ */

export const renameMember = mutation({
  args: { token: v.string(), targetId: v.id("users"), name: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token, targetId, name }) => {
    const admin = await requireAdmin(ctx, token);
    const target = await ctx.db.get(targetId);
    if (!target) throw new ConvexError("Member not found.");
    const clean = name.trim();
    if (clean.length < 2 || clean.length > 80) throw new ConvexError("Names must be 2–80 characters.");
    await ctx.db.patch(targetId, { displayName: clean, updatedAt: Date.now() });
    await logAdmin(ctx, admin, "rename-member", `${target.displayName} → ${clean}`);
    return { ok: true };
  },
});

export const editMemberProfile = mutation({
  args: { token: v.string(), targetId: v.id("users"), role: v.string(), bio: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token, targetId, role, bio }) => {
    const admin = await requireAdmin(ctx, token);
    const target = await ctx.db.get(targetId);
    if (!target) throw new ConvexError("Member not found.");
    const cleanRole = role.trim();
    const cleanBio = bio.trim();
    if (cleanRole.length > 80) throw new ConvexError("Roles must be 80 characters or fewer.");
    if (cleanBio.length > 280) throw new ConvexError("Bios must be 280 characters or fewer.");
    await ctx.db.patch(targetId, { role: cleanRole, bio: cleanBio, updatedAt: Date.now() });
    await logAdmin(ctx, admin, "edit-member", `Rewrote profile for @${target.handle || target.displayName}`);
    return { ok: true };
  },
});

export const toggleFlair = mutation({
  args: { token: v.string(), targetId: v.id("users") },
  returns: v.object({ verified: v.boolean() }),
  handler: async (ctx, { token, targetId }) => {
    const admin = await requireAdmin(ctx, token);
    const target = await ctx.db.get(targetId);
    if (!target) throw new ConvexError("Member not found.");
    const verified = target.verified !== true;
    await ctx.db.patch(targetId, { verified, updatedAt: Date.now() });
    await logAdmin(ctx, admin, "flair", `${verified ? "Gave" : "Removed"} verified flair ${verified ? "to" : "from"} @${target.handle || target.displayName}`);
    return { verified };
  },
});

export const setSuspended = mutation({
  args: { token: v.string(), targetId: v.id("users"), suspended: v.boolean() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token, targetId, suspended }) => {
    const admin = await requireAdmin(ctx, token);
    const target = await ctx.db.get(targetId);
    if (!target) throw new ConvexError("Member not found.");
    if (suspended && targetId === admin.user._id) {
      throw new ConvexError("You cannot suspend your own admin account.");
    }
    await ctx.db.patch(targetId, { suspended, updatedAt: Date.now() });
    await logAdmin(ctx, admin, "suspend", `${suspended ? "Suspended" : "Reinstated"} @${target.handle || target.displayName}`);
    return { ok: true };
  },
});

export const grantFollowers = mutation({
  args: { token: v.string(), targetId: v.id("users"), count: v.number() },
  returns: v.object({ added: v.number() }),
  handler: async (ctx, { token, targetId, count }) => {
    const admin = await requireAdmin(ctx, token);
    const target = await ctx.db.get(targetId);
    if (!target) throw new ConvexError("Member not found.");
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new ConvexError("Choose between 1 and 100 followers.");
    const users = await ctx.db.query("users").withIndex("by_created").order("desc").take(200);
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_target", (q) => q.eq("targetId", targetId))
      .collect();
    const already = new Set(existing.map((row) => row.userId));
    const candidates = users
      .filter((user) => user._id !== targetId && user.displayName.trim().length > 0 && !already.has(user._id))
      .slice(0, count);
    for (const candidate of candidates) {
      await ctx.db.insert("follows", { userId: candidate._id, targetId, createdAt: Date.now() });
    }
    await logAdmin(ctx, admin, "followers", `Injected ${candidates.length} followers onto @${target.handle || target.displayName}`);
    return { added: candidates.length };
  },
});

export const deleteMember = mutation({
  args: { token: v.string(), targetId: v.id("users") },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token, targetId }) => {
    const admin = await requireAdmin(ctx, token);
    const target = await ctx.db.get(targetId);
    if (!target) throw new ConvexError("Member not found.");
    if (targetId === admin.user._id) throw new ConvexError("You cannot delete your own admin account.");

    const [authored, comments, likes, bookmarks, followsOut, followsIn, notifications, sessions, prefs] = await Promise.all([
      ctx.db.query("posts").withIndex("by_author_created", (q) => q.eq("authorId", targetId)).collect(),
      ctx.db.query("comments").withIndex("by_author_created", (q) => q.eq("authorId", targetId)).collect(),
      ctx.db.query("likes").withIndex("by_user", (q) => q.eq("userId", targetId)).collect(),
      ctx.db.query("bookmarks").withIndex("by_user_created", (q) => q.eq("userId", targetId)).collect(),
      ctx.db.query("follows").withIndex("by_user", (q) => q.eq("userId", targetId)).collect(),
      ctx.db.query("follows").withIndex("by_target", (q) => q.eq("targetId", targetId)).collect(),
      ctx.db.query("notifications").withIndex("by_recipient_created", (q) => q.eq("recipientId", targetId)).collect(),
      ctx.db.query("adminSessions").withIndex("by_user", (q) => q.eq("userId", targetId)).collect(),
      ctx.db.query("preferences").withIndex("by_user", (q) => q.eq("userId", targetId)).collect(),
    ]);

    for (const post of authored) await purgePost(ctx, post._id);
    for (const comment of comments) {
      const parent = await ctx.db.get(comment.postId);
      if (parent) await ctx.db.patch(parent._id, { commentsCount: Math.max(0, parent.commentsCount - 1) });
      await ctx.db.delete(comment._id);
    }
    for (const row of likes) {
      const post = await ctx.db.get(row.postId);
      if (post) await ctx.db.patch(post._id, { likesCount: Math.max(0, post.likesCount - 1) });
      await ctx.db.delete(row._id);
    }
    for (const row of bookmarks) await ctx.db.delete(row._id);
    for (const row of followsOut) await ctx.db.delete(row._id);
    for (const row of followsIn) await ctx.db.delete(row._id);
    for (const row of notifications) await ctx.db.delete(row._id);
    for (const row of sessions) await ctx.db.delete(row._id);
    for (const row of prefs) await ctx.db.delete(row._id);

    const strayNotifications = await ctx.db.query("notifications").collect();
    for (const row of strayNotifications) {
      if (row.actorId === targetId) await ctx.db.delete(row._id);
    }

    // Best effort: end their sign-in sessions too, so the account is fully gone.
    try {
      const authSessions = await ctx.runQuery(components.auth.public.listSessions, { userId: targetId });
      if (authSessions.length > 0) {
        await ctx.runMutation(components.auth.public.revokeSessions, {
          sessionIds: authSessions.map((session) => String(session.sessionId)),
        });
      }
    } catch {
      /* auth cleanup must never block the deletion */
    }

    await ctx.db.delete(targetId);
    await logAdmin(ctx, admin, "delete-member", `Deleted @${target.handle || target.displayName} and ${authored.length} update(s)`);
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ *
 * 9–13. Content control
 * ------------------------------------------------------------------ */

export const deletePost = mutation({
  args: { token: v.string(), postId: v.id("posts") },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token, postId }) => {
    const admin = await requireAdmin(ctx, token);
    const post = await ctx.db.get(postId);
    if (!post) throw new ConvexError("Update not found.");
    await purgePost(ctx, postId);
    await logAdmin(ctx, admin, "delete-post", `Deleted an update: “${post.body.slice(0, 70)}”`);
    return { ok: true };
  },
});

export const togglePin = mutation({
  args: { token: v.string(), postId: v.id("posts") },
  returns: v.object({ pinned: v.boolean() }),
  handler: async (ctx, { token, postId }) => {
    const admin = await requireAdmin(ctx, token);
    const post = await ctx.db.get(postId);
    if (!post) throw new ConvexError("Update not found.");
    const pinned = post.pinnedAt === undefined;
    await ctx.db.patch(postId, { pinnedAt: pinned ? Date.now() : undefined });
    await logAdmin(ctx, admin, "pin", `${pinned ? "Pinned" : "Unpinned"} an update by ${post.body.slice(0, 50)}`);
    return { pinned };
  },
});

export const purgeReplies = mutation({
  args: { token: v.string(), postId: v.id("posts") },
  returns: v.object({ removed: v.number() }),
  handler: async (ctx, { token, postId }) => {
    const admin = await requireAdmin(ctx, token);
    const post = await ctx.db.get(postId);
    if (!post) throw new ConvexError("Update not found.");
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_post_created", (q) => q.eq("postId", postId))
      .collect();
    for (const comment of comments) await ctx.db.delete(comment._id);
    await ctx.db.patch(postId, { commentsCount: 0 });
    await logAdmin(ctx, admin, "purge-replies", `Purged ${comments.length} repl${comments.length === 1 ? "y" : "ies"}`);
    return { removed: comments.length };
  },
});

export const wipeFeed = mutation({
  args: { token: v.string() },
  returns: v.object({ removed: v.number() }),
  handler: async (ctx, { token }) => {
    const admin = await requireAdmin(ctx, token);
    const posts = await ctx.db.query("posts").collect();
    for (const post of posts) await purgePost(ctx, post._id);
    const strayComments = await ctx.db.query("comments").collect();
    for (const comment of strayComments) await ctx.db.delete(comment._id);
    await logAdmin(ctx, admin, "wipe-feed", `Wiped ${posts.length} update(s) from the stream`);
    return { removed: posts.length };
  },
});

export const toggleTopicLock = mutation({
  args: { token: v.string(), topic: v.string() },
  returns: v.object({ locked: v.boolean(), lockedTopics: v.array(v.string()) }),
  handler: async (ctx, { token, topic }) => {
    const admin = await requireAdmin(ctx, token);
    const clean = topic.trim();
    if (!clean) throw new ConvexError("Pick a topic first.");
    const id = await settingsForWrite(ctx);
    const doc = await ctx.db.get(id);
    const current = doc?.lockedTopics ?? [];
    const exists = current.some((entry) => entry.toLowerCase() === clean.toLowerCase());
    const lockedTopics = exists
      ? current.filter((entry) => entry.toLowerCase() !== clean.toLowerCase())
      : [...current, clean];
    await ctx.db.patch(id, { lockedTopics, updatedAt: Date.now() });
    await logAdmin(ctx, admin, "topic-lock", `${exists ? "Unlocked" : "Locked"} #${clean}`);
    return { locked: !exists, lockedTopics };
  },
});

/* ------------------------------------------------------------------ *
 * 14–16. Network controls
 * ------------------------------------------------------------------ */

export const setReadOnly = mutation({
  args: { token: v.string(), value: v.boolean() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token, value }) => {
    const admin = await requireAdmin(ctx, token);
    const id = await settingsForWrite(ctx);
    await ctx.db.patch(id, { readOnly: value, updatedAt: Date.now() });
    await logAdmin(ctx, admin, "freeze", value ? "Froze the network (read-only)" : "Thawed the network");
    return { ok: true };
  },
});

export const setSlowMode = mutation({
  args: { token: v.string(), seconds: v.number() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token, seconds }) => {
    const admin = await requireAdmin(ctx, token);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 600) {
      throw new ConvexError("Slow mode must be between 0 and 600 seconds.");
    }
    const id = await settingsForWrite(ctx);
    await ctx.db.patch(id, { slowModeSeconds: seconds, updatedAt: Date.now() });
    await logAdmin(ctx, admin, "slow-mode", seconds === 0 ? "Disabled slow mode" : `Slow mode: ${seconds}s`);
    return { ok: true };
  },
});

export const setChaos = mutation({
  args: { token: v.string(), value: v.boolean() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token, value }) => {
    const admin = await requireAdmin(ctx, token);
    const id = await settingsForWrite(ctx);
    await ctx.db.patch(id, { chaos: value, updatedAt: Date.now() });
    await logAdmin(ctx, admin, "chaos", value ? "Turned on chaos shuffle" : "Restored the feed order");
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ *
 * 17–20. Trolls
 * ------------------------------------------------------------------ */

export const massLike = mutation({
  args: { token: v.string(), postId: v.id("posts"), count: v.number() },
  returns: v.object({ likes: v.number(), added: v.number() }),
  handler: async (ctx, { token, postId, count }) => {
    const admin = await requireAdmin(ctx, token);
    const post = await ctx.db.get(postId);
    if (!post) throw new ConvexError("Update not found.");
    if (!Number.isInteger(count) || count < 1 || count > 250) throw new ConvexError("Choose between 1 and 250 likes.");
    const users = await ctx.db.query("users").withIndex("by_created").order("desc").take(200);
    const existing = await ctx.db.query("likes").withIndex("by_post", (q) => q.eq("postId", postId)).collect();
    const already = new Set(existing.map((row) => row.userId));
    const lovely = users.filter((user) => !already.has(user._id)).slice(0, count);
    for (const user of lovely) {
      await ctx.db.insert("likes", { postId, userId: user._id, createdAt: Date.now() });
    }
    const likes = post.likesCount + lovely.length;
    await ctx.db.patch(postId, { likesCount: likes });
    await logAdmin(ctx, admin, "mass-like", `Pumped ${lovely.length} likes onto an update`);
    return { likes, added: lovely.length };
  },
});

export const triggerShrekBomb = mutation({
  args: { token: v.string(), message: v.string(), durationSeconds: v.number() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token, message, durationSeconds }) => {
    const admin = await requireAdmin(ctx, token);
    const clean = message.trim();
    if (clean.length > 120) throw new ConvexError("Keep the overlay message under 120 characters.");
    if (!Number.isInteger(durationSeconds) || durationSeconds < 5 || durationSeconds > 600) {
      throw new ConvexError("The hamburbur lasts between 5 and 600 seconds.");
    }
    const id = await settingsForWrite(ctx);
    const now = Date.now();
    await ctx.db.patch(id, {
      shrekBomb: { message: clean || "hamburbur", startedAt: now, expiresAt: now + durationSeconds * 1000 },
      updatedAt: now,
    });
    await logAdmin(ctx, admin, "shrek-bomb", `Dropped a hamburbur for ${durationSeconds}s`);
    return { ok: true };
  },
});

export const cancelShrekBomb = mutation({
  args: { token: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token }) => {
    const admin = await requireAdmin(ctx, token);
    const id = await settingsForWrite(ctx);
    await ctx.db.patch(id, { shrekBomb: undefined, updatedAt: Date.now() });
    await logAdmin(ctx, admin, "shrek-bomb", "Called off the hamburbur");
    return { ok: true };
  },
});

export const setUpsideDown = mutation({
  args: { token: v.string(), value: v.boolean() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token, value }) => {
    const admin = await requireAdmin(ctx, token);
    const id = await settingsForWrite(ctx);
    await ctx.db.patch(id, { upsideDown: value, updatedAt: Date.now() });
    await logAdmin(ctx, admin, "upside-down", value ? "Flipped the whole network upside down" : "Put the network the right way up");
    return { ok: true };
  },
});

export const renameEveryone = mutation({
  args: { token: v.string() },
  returns: v.object({ renamed: v.number() }),
  handler: async (ctx, { token }) => {
    const admin = await requireAdmin(ctx, token);
    const users = await ctx.db.query("users").collect();
    let renamed = 0;
    for (const user of users) {
      if (!user.displayName.trim() || user.displayName === "hamburbur") continue;
      await ctx.db.patch(user._id, { displayName: "hamburbur", updatedAt: Date.now() });
      renamed += 1;
    }
    await logAdmin(ctx, admin, "great-renaming", `Renamed ${renamed} member(s) to hamburbur`);
    return { renamed };
  },
});
