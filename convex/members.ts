import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { search: v.string() },
  handler: async (ctx, { search }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const followed = await ctx.db
      .query("follows")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const followedIds = new Set(followed.map((row) => row.targetId));
    const needle = search.trim().toLowerCase();
    const users = await ctx.db.query("users").withIndex("by_created").order("desc").take(200);
    return users
      .filter((user) => user._id !== userId && user.displayName.trim().length > 0)
      .filter((user) => !needle || `${user.displayName} ${user.handle} ${user.role} ${user.bio}`.toLowerCase().includes(needle))
      .map((user) => ({
        id: user._id,
        name: user.displayName,
        handle: user.handle,
        role: user.role,
        bio: user.bio,
        avatar: user.avatarColor,
        followed: followedIds.has(user._id),
      }));
  },
});

export const toggleFollow = mutation({
  args: { targetId: v.id("users") },
  handler: async (ctx, { targetId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in to follow members.");
    if (userId === targetId) throw new ConvexError("You cannot follow your own profile.");
    const target = await ctx.db.get(targetId);
    if (!target || !target.displayName.trim()) throw new ConvexError("Member not found.");
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_user_target", (q) => q.eq("userId", userId).eq("targetId", targetId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { followed: false };
    }
    await ctx.db.insert("follows", { userId, targetId, createdAt: Date.now() });
    await ctx.db.insert("notifications", {
      recipientId: targetId,
      actorId: userId,
      kind: "follow",
      createdAt: Date.now(),
    });
    return { followed: true };
  },
});
