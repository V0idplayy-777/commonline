# Admin console

The admin console lives in `src/components/AdminPanel.tsx` (UI) and `convex/admin.ts` (server).
It is reached from **Admin console** in the sidebar, which only appears for allow-listed accounts.

## Access

- Allow-list (`ADMIN_USERNAMES` in `convex/adminShared.ts`): `dubnium`, `admin`, `no`.
  Matching is case-insensitive and checked against the account's auth username (and its handle copy).
- The console is password-gated. The password constant also lives in `convex/adminShared.ts`
  and is never sent to the browser — the browser asks the server to unlock and receives a
  short-lived (1 hour) session token instead.
- **Every single action re-verifies on the server** that the caller is still on the allow-list
  *and* that the presented token is live and belongs to that same account
  (`requireAdmin` in `convex/adminShared.ts`). Nothing is trusted from the client.
- Every action is written to the `adminLog` table, surfaced as the console's audit trail.
- Locking the console (or letting the session expire) deletes the server-side session.

## The 20 features

| # | Feature | What it does |
|---|---------|--------------|
| 1 | Global announcement | Banner on every member's stream; can also fire confetti network-wide. Take-down included. |
| 2 | Direct member alert | System notification in one member's activity drawer. |
| 3 | Rename member | Rewrites any member's display name. |
| 4 | Rewrite role & bio | Overwrites any member's headline and introduction. |
| 5 | Verified flair | Grants/removes the verified badge shown beside names. |
| 6 | Suspend / reinstate | Suspended accounts cannot post, reply, like, save or follow. |
| 7 | Inject followers | Attaches existing members as followers of a target account. |
| 8 | Delete member | Removes the account and all of its content, reactions, follows and preferences. |
| 9 | Delete any update | Deletes any post plus its replies, likes, bookmarks and notifications. |
| 10 | Pin update | Floats a post to the top of every feed until unpinned. |
| 11 | Purge replies | Deletes every reply on a post, keeping the post. |
| 12 | Wipe the feed | Deletes every post on the network. |
| 13 | Topic locks | Blocks posting into chosen topics. |
| 14 | Freeze network | Read-only mode, enforced server-side on writes. |
| 15 | Slow mode | Cooldown between posts/replies for everyone. |
| 16 | Chaos shuffle | Reshuffles everyone's feed every minute. |
| 17 | Mass-like | Pumps likes onto a post using real member accounts. |
| 18 | Hamburbur bomb | Full-screen cursed portrait + message for a set duration. |
| 19 | Upside-down mode | Rotates the entire interface 180°. |
| 20 | The Great Renaming | Renames every member to `hamburbur`. |

The console footer shows the requested portrait with the caption **hamburbur**.

## Server-side enforcement

`convex/posts.ts`, `convex/members.ts` and `convex/users.ts` read the shared site settings on every
write, so freeze, slow mode, suspension and topic locks hold even if a client bypasses the UI.
Announcements, the hamburbur overlay and upside-down mode are published through
`api.admin.publicState`, which every signed-in client subscribes to.

## Deploying

The console adds new tables (`siteSettings`, `adminSessions`, `adminLog`), new optional fields on
`users` and `posts`, and a new `system` notification kind, so the Convex backend must be deployed
(`npx convex deploy`, or keep `npx convex dev` running) before the UI will work against it.
