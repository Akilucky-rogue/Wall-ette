// wall-ette.com: the website, prerendered to static HTML for Firebase Hosting
// (scripts/build-hosting.mjs puts the web app beside it at /app).
//
// TanStack Start renders every page at build time: it starts from the pages
// listed here and follows each page's links, so a page nothing links to must
// be listed. There is no server at run time: forms write to Firestore and
// sign-in uses Firebase Auth, in the browser.
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: { port: 5310, strictPort: true },
  // The site's CSS is Tailwind 4, built by its Vite plugin below; it needs no
  // PostCSS. Left to search, Vite can find the app's PostCSS config one folder
  // up (Tailwind 3), which rejects this CSS: it does on Windows.
  css: { postcss: { plugins: [] } },
  resolve: { dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"] },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      pages: [{ path: "/" }, { path: "/status" }, { path: "/compare" }, { path: "/reset-password" }, { path: "/not-found" }],
      prerender: {
        enabled: true,
        crawlLinks: true,
        failOnError: true,
        autoSubfolderIndex: true,
        // Only pages that are linked (or listed above): discovery also renders
        // index routes at "/blog/", whose HTML then differs from "/blog".
        autoStaticPathsDiscovery: false,
        // The web app at /app is a separate build; links to it aren't pages
        // here. A link with a query (a blog filter) is the same file as the
        // page without one, so it would overwrite it with a filtered view.
        filter: (page) => !/^\/app(\/|$)/.test(page.path) && !page.path.includes("?"),
      },
    }),
    viteReact(),
    tailwindcss(),
  ],
});
