import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";
import { seo } from "./plugins/seo.ts";
import { SITE_DESCRIPTION, SITE_NAME } from "./src/site.ts";

const pkg = JSON.parse(
    readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

const BUILD_DATE = new Date().toISOString();

// Emits /version.json so open tabs can detect a new deploy (see src/composables/pwa.ts).
const versionFile = (): Plugin => ({
    name: "app-version-file",
    apply: "build",
    generateBundle() {
        this.emitFile({
            type: "asset",
            fileName: "version.json",
            source: JSON.stringify({
                version: pkg.version,
                buildDate: BUILD_DATE,
            }),
        });
    },
});

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        versionFile(),
        vue(),
        tailwindcss(),
        seo({
            registry: fileURLToPath(
                new URL("./src/tools/registry.ts", import.meta.url),
            ),
        }),
        VitePWA({
            registerType: "prompt",
            includeAssets: [
                "favicon.svg",
                "favicon-32x32.png",
                "apple-touch-icon.png",
            ],
            manifest: {
                id: "/",
                name: `${SITE_NAME} — Developer Tools`,
                short_name: SITE_NAME,
                description: SITE_DESCRIPTION,
                start_url: "/",
                scope: "/",
                display: "standalone",
                display_override: ["window-controls-overlay", "standalone"],
                orientation: "any",
                background_color: "#f8fafc",
                theme_color: "#00776e",
                categories: ["developer", "productivity", "utilities"],
                icons: [
                    { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
                    {
                        src: "pwa-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                    {
                        src: "maskable-icon-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                ],
                shortcuts: [
                    {
                        name: "JSON Formatter",
                        url: "/json-formatter",
                        icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
                    },
                    {
                        name: "Regex Tester",
                        url: "/regex-tester",
                        icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
                    },
                    {
                        name: "Hash Generator",
                        url: "/hash-generator",
                        icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
                    },
                    {
                        name: "UUID Generator",
                        url: "/uuid-generator",
                        icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
                    },
                ],
            },
            workbox: {
                // Precache the whole app (every tool chunk) so all tools work offline after the first visit.
                globPatterns: [
                    "**/*.{js,css,html,svg,png,ico,woff2,webmanifest}",
                ],
                // Social share images are only fetched by link-preview crawlers, so keep them out of the offline cache.
                globIgnores: [
                    "og/**",
                    "404.html",
                    // Must always come from the network so update checks see the latest deploy.
                    "version.json",
                    "**/*web-llm*",
                    "**/*worker*",
                    "**/lib-*.js",
                ],
                // The GPT tokenizer chunk is ~2 MB.
                maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
                navigateFallback: "/index.html",
                cleanupOutdatedCaches: true,
                // Tie the app shell's revision to the app version, so every version bump
                // produces a new sw.js and triggers a service-worker update.
                manifestTransforms: [
                    (entries) => ({
                        manifest: entries.map((e) =>
                            e.url === "index.html"
                                ? { ...e, revision: `${e.revision}-v${pkg.version}` }
                                : e,
                        ),
                        warnings: [],
                    }),
                ],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: "StaleWhileRevalidate",
                        options: { cacheName: "google-fonts-css" },
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "google-fonts-files",
                            expiration: {
                                maxEntries: 30,
                                maxAgeSeconds: 60 * 60 * 24 * 365,
                            },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
            },
        }),
    ],
    base: "/",
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
        __BUILD_DATE__: JSON.stringify(BUILD_DATE),
    },
    server: {
        allowedHosts: ["app.msar.dev"],
    },
    // Large chunks (tokenizer, prettier parsers) are lazy-loaded per tool.
    build: { chunkSizeWarningLimit: 2500 },
    worker: { format: "es" },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
});
