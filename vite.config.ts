import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project sites live below /<repository>/, while user/org sites
// named <owner>.github.io are served from /. GitHub Actions supplies the repo.
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isUserOrOrgSite = repositoryName?.endsWith(".github.io") ?? false;
const base = process.env.GITHUB_ACTIONS === "true" && repositoryName && !isUserOrOrgSite
  ? `/${repositoryName}/`
  : "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
