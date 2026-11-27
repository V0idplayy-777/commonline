import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { components } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Accounts allowed into the admin console. Matched against the auth username
 * (case-insensitive) and the profile handle, which is a server-side copy of it.
 */
export const ADMIN_USERNAMES = ["dubnium", "admin", "no"] as const;

/** Console password. Kept server-side so the browser never decides who is staff. */
export const ADMIN_PASSWORD = "585958";

export const SETTINGS_KEY = "global";
export const SESSION_TTL_MS = 60 * 60 * 1000;

export type SiteSettings = {
  announcement?: Doc<"siteSettings">["announcement"];
  readOnly: boolean;
  slowModeSeconds: number;
  chaos: boolean;
  upsideDown: boolean;
  lockedTopics: string[];
  shrekBomb?: Doc<"siteSettings">["shrekBomb"];
  updatedAt: number;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  readOnly: false,
  slowModeSeconds: 0,
  chaos: false,
  upsideDown: false,
  lockedTopics: [],
  updatedAt: 0,
};

export type AdminIdentity = { user: Doc<"users">; username: string };

type ReadCtx = QueryCtx | MutationCtx;

/** True when a username/handle pair is on the server-side admin allow-list. */
export function isAdminUsername(username: string, handle: string) {
  const candidates = [username, handle]
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  return ADMIN_USERNAMES.some((name) => candidates.includes(name));
}

/** Resolve the caller and check the admin allow-list. Returns null for anyone else. */
export async function adminIdentity(ctx: ReadCtx): Promise<AdminIdentity | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;
  const username = (await ctx.runQuery(components.authUsername.public.getUsername, { userId })) ?? "";
  if (!isAdminUsername(username, user.handle)) return null;
  return { user, username: username || user.handle };
}

/** Constant-time-ish string comparison for the console password. */
export function passwordMatches(candidate: string) {
  const given = candidate.trim();
  if (given.length !== ADMIN_PASSWORD.length) return false;
  let diff = 0;
  for (let index = 0; index < ADMIN_PASSWORD.length; index += 1) {
    diff |= ADMIN_PASSWORD.charCodeAt(index) ^ given.charCodeAt(index);
  }
  return diff === 0;
}

export async function readSettingsDoc(ctx: ReadCtx) {
  return await ctx.db
    .query("siteSettings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .first();
}

export function withDefaults(doc: Doc<"siteSettings"> | null): SiteSettings {
  if (!doc) return DEFAULT_SETTINGS;
  return {
    announcement: doc.announcement,
    readOnly: doc.readOnly,
    slowModeSeconds: doc.slowModeSeconds,
    chaos: doc.chaos,
    upsideDown: doc.upsideDown,
    lockedTopics: doc.lockedTopics,
    shrekBomb: doc.shrekBomb,
    updatedAt: doc.updatedAt,
  };
}

export async function getSettings(ctx: ReadCtx): Promise<SiteSettings> {
  return withDefaults(await readSettingsDoc(ctx));
}

/** Read-or-create the singleton settings row. Only callable from a mutation. */
export async function settingsForWrite(ctx: MutationCtx): Promise<Id<"siteSettings">> {
  const existing = await readSettingsDoc(ctx);
  if (existing) return existing._id;
  return await ctx.db.insert("siteSettings", {
    key: SETTINGS_KEY,
    readOnly: DEFAULT_SETTINGS.readOnly,
    slowModeSeconds: DEFAULT_SETTINGS.slowModeSeconds,
    chaos: DEFAULT_SETTINGS.chaos,
    upsideDown: DEFAULT_SETTINGS.upsideDown,
    lockedTopics: DEFAULT_SETTINGS.lockedTopics,
    updatedAt: Date.now(),
  });
}

/**
 * The gate used by every single admin action. It revalidates, on the server,
 * both that the caller is on the admin allow-list AND that the unlock token is
 * live and belongs to that same account. Nothing is trusted from the client.
 */
export async function requireAdmin(ctx: MutationCtx, token: string): Promise<AdminIdentity> {
  const identity = await adminIdentity(ctx);
  if (!identity) {
    throw new ConvexError("This account does not have admin access.");
  }
  const clean = token.trim();
  if (!clean) throw new ConvexError("Admin session expired — unlock the console again.");
  const session = await ctx.db
    .query("adminSessions")
    .withIndex("by_token", (q) => q.eq("token", clean))
    .unique();
  if (!session || session.userId !== identity.user._id) {
    throw new ConvexError("Admin session expired — unlock the console again.");
  }
  if (session.expiresAt < Date.now()) {
    await ctx.db.delete(session._id);
    throw new ConvexError("Admin session expired — unlock the console again.");
  }
  await ctx.db.patch(session._id, { lastUsedAt: Date.now() });
  return identity;
}

export async function logAdmin(
  ctx: MutationCtx,
  actor: AdminIdentity,
  action: string,
  detail: string,
) {
  await ctx.db.insert("adminLog", {
    actorName: actor.username || actor.user.displayName || "admin",
    action,
    detail,
    createdAt: Date.now(),
  });
}

export function randomToken() {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Blocks actions from accounts an admin has suspended. */
export function assertAccountActive(user: Doc<"users">) {
  if (user.suspended) {
    throw new ConvexError("Your account is suspended. Contact an administrator.");
  }
}

/** Blocks writes while the network is frozen. */
export function assertNetworkOpen(settings: SiteSettings) {
  if (settings.readOnly) {
    throw new ConvexError("The network is frozen by an administrator. Try again later.");
  }
}

/** Enforces the admin slow-mode cooldown on content creation. */
export function assertNotTooFast(settings: SiteSettings, user: Doc<"users">) {
  if (settings.slowModeSeconds <= 0) return;
  const elapsed = Date.now() - (user.lastActionAt ?? 0);
  const cooldown = settings.slowModeSeconds * 1000;
  if (elapsed < cooldown) {
    const wait = Math.ceil((cooldown - elapsed) / 1000);
    throw new ConvexError(`Slow mode is on. Wait ${wait}s before posting again.`);
  }
}
