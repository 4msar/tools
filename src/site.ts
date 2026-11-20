// Shared site constants. Imported by the app (runtime meta) and by vite.config.ts (SEO build plugin),
// so keep this file free of browser or Vue imports.
export const SITE_URL = "https://tools.msar.me";
export const SITE_NAME = "DevTools";
export const SITE_TITLE = "DevTools — Free Developer Tools in Your Browser";
export const SITE_DESCRIPTION =
    "Free, private developer tools that run entirely in your browser: JSON formatter, regex tester, hash & UUID generators, JWT decoder, cron, Base64, color tools and more. No sign-up, works offline.";
export const OG_IMAGE = `${SITE_URL}/og-image.png`;
export const AUTHOR = "Saiful Alam Rakib";

// Injected by Vite `define` from package.json; guarded because vite.config.ts also imports this file in Node.
export const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
export const BUILD_DATE = typeof __BUILD_DATE__ !== "undefined" ? __BUILD_DATE__ : "";

export const toolTitle = (name: string) => `${name} — Free Online Tool · ${SITE_NAME}`;
export const toolUrl = (id: string) => `${SITE_URL}/${id}`;
export const toolOgImage = (id: string) => `${SITE_URL}/og/${id}.png`;
