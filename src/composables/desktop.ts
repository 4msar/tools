/**
 * Bridge to the Tauri desktop shell (src-tauri). Everything here is a no-op in the browser,
 * and the Tauri API is only imported when running inside the desktop app.
 */
import { ref, watch } from "vue";
import type { Router } from "vue-router";
import { toast } from "vue-sonner";
import { recents } from "@/composables/prefs";

/** True when the app runs inside the Tauri desktop shell. */
export const isDesktopApp =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface DesktopSettings {
    launcherShortcut: string;
    closeToTray: boolean;
    showInDock: boolean;
    autostart: boolean;
    platform: string;
}

export const DEFAULT_LAUNCHER_SHORTCUT = "Alt+Shift+Space";
export const desktopSettingsOpen = ref(false);

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(cmd, args);
}

export const getDesktopSettings = () => invoke<DesktopSettings>("get_desktop_settings");
export const setLauncherShortcut = (shortcut: string) => invoke<void>("set_launcher_shortcut", { shortcut });
export const setCloseToTray = (enabled: boolean) => invoke<void>("set_close_to_tray", { enabled });
export const setShowInDock = (enabled: boolean) => invoke<void>("set_show_in_dock", { enabled });
export const setAutostart = (enabled: boolean) => invoke<void>("set_autostart", { enabled });
export const hideWindow = () => invoke<void>("hide_window");
export const openExternal = (url: string) => invoke<void>("open_external", { url });

const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

/** "Alt+Shift+Space" → "⌥⇧Space" on macOS, "Alt+Shift+Space" elsewhere. */
export function formatShortcut(accel: string): string {
    if (!accel) return "Off";
    if (!isMac) return accel.replace(/CommandOrControl|CmdOrCtrl/g, "Ctrl");
    const map: Record<string, string> = {
        Alt: "⌥", Option: "⌥", Shift: "⇧", Control: "⌃", Ctrl: "⌃",
        Super: "⌘", Cmd: "⌘", Command: "⌘", Meta: "⌘", CommandOrControl: "⌘", CmdOrCtrl: "⌘",
    };
    return accel.split("+").map((k) => map[k] ?? k).join("");
}

const CODE_KEYS: Record<string, string> = {
    Space: "Space", Enter: "Enter", Tab: "Tab", Backspace: "Backspace", Delete: "Delete",
    Escape: "Escape", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
    Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown",
    Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]",
    Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/",
};

/**
 * Turns a keydown into a Tauri accelerator string ("Alt+Shift+Space").
 * Returns null while only modifiers are held, or when no modifier is used (a bare key would hijack typing).
 */
export function keyEventToAccelerator(e: KeyboardEvent): string | null {
    let key: string | undefined;
    if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
    else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5);
    else if (/^F\d{1,2}$/.test(e.code)) key = e.code;
    else key = CODE_KEYS[e.code];
    if (!key) return null;

    const mods: string[] = [];
    if (e.metaKey) mods.push("Super");
    if (e.ctrlKey) mods.push("Control");
    if (e.altKey) mods.push("Alt");
    if (e.shiftKey) mods.push("Shift");
    // Function keys are fine on their own; anything else needs a modifier other than Shift.
    if (!/^F\d/.test(key) && !mods.some((m) => m !== "Shift")) return null;
    return [...mods, key].join("+");
}

interface SetupOptions {
    router: Router;
    /** Opens the tool search; called when the launcher shortcut fires. */
    onQuickOpen: () => void;
}

/** Wires desktop events to the app. Call once from App.vue. */
export async function setupDesktop({ router, onQuickOpen }: SetupOptions) {
    if (!isDesktopApp) return;
    const { listen } = await import("@tauri-apps/api/event");

    await listen("desktop://quick-open", () => onQuickOpen());
    await listen<string>("desktop://navigate", (e) => router.push(e.payload));
    await listen("desktop://open-settings", () => (desktopSettingsOpen.value = true));
    await listen<{ path: string | null; success: boolean }>("desktop://downloaded", (e) => {
        const name = e.payload.path?.split(/[\\/]/).pop();
        if (e.payload.success) toast.success(name ? `Saved ${name} to Downloads` : "Saved to Downloads");
        else toast.error("Download failed");
    });

    // Keep the menubar's "Recent Tools" in sync.
    watch(
        recents,
        (list) => {
            invoke("set_tray_recents", { tools: list.map((t) => ({ id: t.id, name: t.name })) }).catch(() => {});
        },
        { immediate: true },
    );

    // External links open in the default browser instead of inside the app window.
    document.addEventListener(
        "click",
        (e) => {
            if (e.defaultPrevented || e.button !== 0) return;
            const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
            if (!a || a.hasAttribute("download")) return;
            const url = new URL(a.href, location.href);
            if (url.origin === location.origin || !/^(https?|mailto):$/.test(url.protocol)) return;
            e.preventDefault();
            openExternal(url.href).catch((err) => toast.error(String(err)));
        },
        true,
    );
    const nativeOpen = window.open.bind(window);
    window.open = (url?: string | URL, target?: string, features?: string) => {
        const href = url ? new URL(String(url), location.href) : null;
        if (href && href.origin !== location.origin && /^https?:$/.test(href.protocol)) {
            openExternal(href.href).catch(() => {});
            return null;
        }
        return nativeOpen(url, target, features);
    };
}
