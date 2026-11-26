# Deploy Commonline from Termux

This guide is for deploying the Commonline **Convex backend** to the production deployment. It does not start a local Convex backend, and it does not deploy the website frontend.

## Before you start

- Commonline production URL: `https://marvelous-buffalo-260.convex.cloud`.
- The separate development URL is `https://uncommon-okapi-320.convex.cloud`.
- The Convex CLI in this project requires Node.js 22 or newer. Termux's `nodejs-lts` package is a simple option; confirm the version with `node -v`.
- Sign in to the Convex account that owns or has deploy access to the Commonline project. If the CLI offers to create a new project instead of selecting Commonline, stop rather than creating one.
- Check the target in the Convex dashboard before accepting a production prompt.
- Never send a deploy key or admin key in chat. If the CLI specifically requires a deploy key, enter it only in your own Termux session or use an approved secure secret store.

## 1. Install Node.js and unzip in Termux

```sh
pkg update
pkg install nodejs-lts unzip
node -v
npm -v
```

`node -v` must print `v22` or higher. `nodejs-lts` includes npm.

## 2. Put the project ZIP in Termux

Download `commonline-termux-source.zip` from Arena to your Android Downloads folder. In Termux, grant storage access when prompted:

```sh
termux-setup-storage
```

Then extract the project:

```sh
unzip ~/storage/downloads/commonline-termux-source.zip -d ~/commonline
cd ~/commonline
```

If Android saved the ZIP under another name or folder, adjust that file path.

## 3. Install project dependencies

```sh
npm install
```

## 4. Deploy the Convex backend

```sh
npm run convex:deploy
```

This deploy command typechecks and bundles the Convex functions, then pushes the schema, indexes and functions to the selected production deployment. It does not upload any legacy SQLite demo data.

## After the backend deploy

Set the public `VITE_CONVEX_URL` value to `https://marvelous-buffalo-260.convex.cloud` in the website's environment settings (or in a local `.env.local` file for local testing). This URL is public configuration; deploy/admin keys are not.
