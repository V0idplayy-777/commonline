import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const preference = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return preference ?? { weeklyGoal: 8 };
  },
});

export const saveWeeklyGoal = mutation({
  args: { weeklyGoal: v.number() },
  handler: async (ctx, { weeklyGoal }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in to save preferences.");
    if (!Number.isInteger(weeklyGoal) || weeklyGoal < 1 || weeklyGoal > 200) {
      throw new ConvexError("Choose a weekly goal between 1 and 200.");
    }
    const existing = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { weeklyGoal, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("preferences", { userId, weeklyGoal, updatedAt: Date.now() });
    }
    return { weeklyGoal };
  },
});
