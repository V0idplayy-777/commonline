# Publish Commonline on GitHub Pages (browser-based setup)

The Commonline Convex backend is already deployed at `https://marvelous-buffalo-260.convex.cloud`. GitHub Pages will host only the Vite frontend; it will not deploy or replace Convex. The included Actions workflow builds the frontend and injects the public Convex URL. It needs no Convex deploy key.

The site itself is public. Sign-ups, posts and other writes from it go to the live production Convex database.

## 1. Download and extract the prepared project

Download `commonline-pages-ready.zip` from Arena and extract it using your device's file manager. The archive contains the source, GitHub Pages workflow, and correct Vite path handling. It does not contain `node_modules`, build output, local environment files, or credentials.

## 2. Create an empty GitHub repository

1. Sign in at `https://github.com` and choose **New repository**.
2. Name it `commonline` (or another name you prefer).
3. For the free GitHub Pages path, make it **Public**.
4. Leave **Add a README**, **.gitignore**, and **license** unchecked so the repo starts empty.
5. Create the repository.

## 3. Upload the project in GitHub's website

1. Open the new repository and choose **Add file → Upload files**.
2. Upload the extracted project contents, preserving folders such as `src/`, `convex/`, and `.github/workflows/`.
3. Make sure these are included: `package.json`, `package-lock.json`, `vite.config.ts`, `src/`, `convex/`, and `.github/workflows/pages.yml`.
4. Commit directly to the `main` branch.

If the mobile file picker hides dot-folders or will not upload folders, use the browser's **Desktop site** option. Alternatively, create `.github/workflows/pages.yml` from the repo page with **Add file → Create new file**; use that exact filename and copy the contents from the archive's `.github/workflows/pages.yml`.

## 4. Enable Pages

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open the **Actions** tab. The `Deploy Commonline to GitHub Pages` workflow should run after the commit. If it has not started, use **Run workflow**.
4. Wait for both `build` and `deploy` jobs to finish green.

## 5. Open the site

For a repository named `commonline`, the URL will be:

`https://YOUR-GITHUB-USERNAME.github.io/commonline/`

The included Vite config detects the repository name in GitHub Actions and sets the correct project-site base path automatically. For a repository named `YOUR-GITHUB-USERNAME.github.io`, the site is at the root URL instead.

## Security and data

- The workflow includes `VITE_CONVEX_URL=https://marvelous-buffalo-260.convex.cloud`. This is public browser configuration, not a secret.
- Do **not** add a Convex admin/deploy key to the Pages workflow. The backend is already deployed; this workflow only builds and publishes static files.
- Any new account or content created from the Pages site is real production data.
- Future changes to `convex/` still need a separate authorized Convex production deploy. GitHub Pages only handles the frontend.
