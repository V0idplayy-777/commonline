import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    displayName: v.string(),
    handle: v.string(),
    role: v.string(),
    bio: v.string(),
    avatarColor: v.string(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_handle", ["handle"])
    .index("by_created", ["createdAt"]),

  posts: defineTable({
    authorId: v.id("users"),
    body: v.string(),
    topic: v.string(),
    searchText: v.string(),
    likesCount: v.number(),
    commentsCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_created", ["createdAt"])
    .index("by_author_created", ["authorId", "createdAt"])
    .index("by_topic_created", ["topic", "createdAt"])
    .searchIndex("search_content", { searchField: "searchText" }),

  comments: defineTable({
    postId: v.id("posts"),
    authorId: v.id("users"),
    body: v.string(),
    createdAt: v.number(),
  })
    .index("by_post_created", ["postId", "createdAt"])
    .index("by_author_created", ["authorId", "createdAt"]),

  likes: defineTable({
    postId: v.id("posts"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_post_user", ["postId", "userId"])
    .index("by_post", ["postId"])
    .index("by_user", ["userId"]),

  bookmarks: defineTable({
    postId: v.id("posts"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_post_user", ["postId", "userId"])
    .index("by_post", ["postId"])
    .index("by_user_created", ["userId", "createdAt"]),

  follows: defineTable({
    userId: v.id("users"),
    targetId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_target", ["userId", "targetId"])
    .index("by_target", ["targetId"]),

  notifications: defineTable({
    recipientId: v.id("users"),
    actorId: v.id("users"),
    kind: v.union(v.literal("reply"), v.literal("follow")),
    postId: v.optional(v.id("posts")),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index("by_recipient_created", ["recipientId", "createdAt"])
    .index("by_post", ["postId"]),

  preferences: defineTable({
    userId: v.id("users"),
    weeklyGoal: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});
