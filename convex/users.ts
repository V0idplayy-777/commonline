import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import { internalMutation, query, mutation } from "./_generated/server";

const AVATAR_COLOURS = ["#b5cbbf", "#c7b7a6", "#a9bdc1", "#c4b7c7", "#d4bb9d", "#9eb7a2"];

export const createUser = internalMutation({
  args: {
    method: v.object({
      name: v.literal("usernamePassword"),
      profile: v.object({}),
    }),
  },
  returns: v.id("users"),
  handler: async (ctx) => {
    const userId = await ctx.db.insert("users", {
      displayName: "",
      handle: "",
      role: "",
      bio: "",
      avatarColor: AVATAR_COLOURS[0],
      createdAt: Date.now(),
    });
    return userId;
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const username = await ctx.runQuery(components.authUsername.public.getUsername, { userId });
    return { ...user, username: username ?? user.handle };
  },
});

export const saveProfile = mutation({
  args: {
    displayName: v.string(),
    role: v.string(),
    bio: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in to update your profile.");

    const displayName = args.displayName.trim();
    const role = args.role.trim();
    const bio = args.bio.trim();
    if (displayName.length < 2 || displayName.length > 80) {
      throw new ConvexError("Your name must be between 2 and 80 characters.");
    }
    if (role.length > 80) throw new ConvexError("Keep your role under 80 characters.");
    if (bio.length > 280) throw new ConvexError("Keep your profile note under 280 characters.");

    const username = await ctx.runQuery(components.authUsername.public.getUsername, { userId });
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("Profile not found.");
    await ctx.db.patch(userId, {
      displayName,
      role,
      bio,
      handle: username ?? user.handle,
      updatedAt: Date.now(),
    });
    return { displayName, role, bio, handle: username ?? user.handle };
  },
});
