// Build-time constants injected by Vite `define` (see vite.config.ts).
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;
/** True only in the Tauri desktop build; lets the web build drop all desktop code. */
declare const __DESKTOP__: boolean;
