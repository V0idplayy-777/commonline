import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const unread = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_created", (q) => q.eq("recipientId", userId))
      .order("desc")
      .take(40);
    const unread = rows.filter((row) => row.readAt === undefined).slice(0, 12);
    return Promise.all(unread.map(async (row) => {
      const actor = await ctx.db.get(row.actorId);
      const post = row.postId ? await ctx.db.get(row.postId) : null;
      if (!actor) return null;
      return {
        id: row._id,
        kind: row.kind,
        actorName: actor.displayName,
        actorHandle: actor.handle,
        postId: row.postId,
        postExcerpt: post?.body.slice(0, 90) ?? "",
        createdAt: row.createdAt,
      };
    })).then((items) => items.filter((item) => item !== null));
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in to update notifications.");
    const notification = await ctx.db.get(notificationId);
    if (!notification || notification.recipientId !== userId) {
      throw new ConvexError("Notification not found.");
    }
    if (notification.readAt === undefined) await ctx.db.patch(notificationId, { readAt: Date.now() });
    return { ok: true };
  },
});
