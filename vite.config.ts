import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";
import { seo } from "./plugins/seo.ts";
import { SITE_DESCRIPTION, SITE_NAME } from "./src/site.ts";

// https://vite.dev/config/
export default defineConfig({
    plugins: [
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
                    "**/*web-llm*",
                    "**/*worker*",
                    "**/lib-*.js",
                ],
                // The GPT tokenizer chunk is ~2 MB.
                maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
                navigateFallback: "/index.html",
                cleanupOutdatedCaches: true,
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
    // Large chunks (tokenizer, prettier parsers) are lazy-loaded per tool.
    build: { chunkSizeWarningLimit: 2500 },
    worker: { format: "es" },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
});
