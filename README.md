# Commonline

Commonline is a professional network for people sharing useful work across Aotearoa New Zealand. It uses Convex for live data and Convex Auth for username-and-password accounts. The interface starts with genuine empty states: there are no seeded people, posts, replies, notifications or sample statistics.

## Run the app

Use Node.js 22 or later (the Convex CLI version used here requires it), then run:

```sh
npm install
npm run dev
```

If no Convex URL is configured, the site shows a deployment setup screen rather than sample content. Once a project is connected, Vite reads the public deployment URL from `VITE_CONVEX_URL`.

## Connect a Convex deployment

This is a one-time project-owner/developer step, not something Commonline members need to do.

1. Choose the Commonline Convex project and whether to activate its development or production deployment.
2. Provide the deployment's public URL and set it as `VITE_CONVEX_URL` in the app's environment (a local `.env.local` file for development, or the hosting provider's environment settings in production).
3. Authorize a developer with access to the project to run the Convex CLI and deploy the schema and functions:

   ```sh
   npm run convex:dev
   ```

   For a production deployment, use `npm run convex:deploy` from an authorized environment.

The deployment URL is public configuration. **Do not put a Convex admin key, deploy key or other private credential in a `VITE_` variable, the browser bundle, or chat.** The project owner can grant deployment access directly; a private key does not need to be shared here.

### Information needed to activate the connection

- The Convex project name or dashboard link.
- Which deployment to use (development or production) and its `https://…convex.cloud` URL.
- Access for the project owner or an authorized developer to deploy the code. If the current owner prefers, they can run `npm run convex:dev` or `npm run convex:deploy` themselves and provide only the resulting public deployment URL for the front-end configuration.

## Authentication and accounts

- The app uses Convex Auth's username/password flow. End users create an account in Commonline; they do not configure Convex.
- A short profile setup asks for a display name, with role and introduction optional.
- No email address is collected. Password reset is not configured yet, so members should use a password manager.
- Feed posts, replies, likes, saved posts, follows, member profiles, notifications and personal reading goals are stored in the connected Convex deployment.

## Project layout

- `src/App.tsx` — sign-in, profile setup and Commonline workspace.
- `src/SetupScreen.tsx` — deployment connection instructions shown when no URL is set.
- `src/styles.css` and `src/commonline.css` — supplied component styling and the application interface.
- `src/components/bencho/` — the eight requested interaction and motion components.
- `convex/schema.ts` — Convex data model and indexes.
- `convex/*.ts` — authentication, profiles, posts, members, notifications and preferences.
- `convex/convex.config.ts` — registered Convex Auth components.

The previous Express/SQLite demo backend and its local database have been removed. This project does not automatically copy that sample data into Convex.

See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for the Bencho component licence note.
