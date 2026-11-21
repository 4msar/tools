import { ref } from "vue";
import { toast } from "vue-sonner";
import { registerSW } from "virtual:pwa-register";
import { APP_VERSION } from "@/site";

/** How often an open tab asks the server whether a newer version was deployed. */
const VERSION_CHECK_INTERVAL = 30 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
/** True when the browser has offered to install the app and it isn't installed yet. */
export const canInstall = ref(false);

export function setupPwa() {
    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        deferredPrompt = e as BeforeInstallPromptEvent;
        canInstall.value = true;
    });
    window.addEventListener("appinstalled", () => {
        deferredPrompt = null;
        canInstall.value = false;
        toast.success("DevTools installed");
    });

    let registration: ServiceWorkerRegistration | undefined;
    let latestVersion: string | null = null;
    let prompted = false;

    const promptReload = (reload: () => void) => {
        if (prompted) return;
        prompted = true;
        const label = latestVersion ? ` (v${latestVersion})` : "";
        toast(`A new version of DevTools is available${label}`, {
            description: `You're on v${APP_VERSION}.`,
            duration: Infinity,
            action: { label: "Reload", onClick: reload },
        });
    };

    registerSW({
        onOfflineReady() {
            toast.success("DevTools is ready to work offline");
        },
        onNeedRefresh() {
            promptReload(() => applyUpdate(registration));
        },
        onRegisteredSW(_url, r) {
            registration = r;
        },
    });

    if (!import.meta.env.PROD) return;

    /** Asks the server which version is deployed; if it differs, fetch the new service worker. */
    const checkVersion = async () => {
        if (prompted || !navigator.onLine) return;
        try {
            const res = await fetch(`/version.json?t=${Date.now()}`, {
                cache: "no-store",
            });
            if (!res.ok) return;
            const { version } = (await res.json()) as { version?: string };
            if (!version || version === APP_VERSION) return;
            latestVersion = version;
            if (registration) {
                // A new sw.js is deployed with every version; onNeedRefresh fires once it's installed.
                await registration.update();
                if (!registration.installing && !registration.waiting) {
                    // The server has a newer build but the SW script didn't change (stale CDN copy of
                    // sw.js, or the page isn't controlled): a plain reload would be served from the old
                    // precache, so drop the SW and its caches and load fresh from the network.
                    promptReload(() => applyUpdate(registration));
                }
            } else {
                promptReload(() => applyUpdate(registration));
            }
        } catch {
            // Offline or blocked; try again on the next tick.
        }
    };

    checkVersion();
    setInterval(checkVersion, VERSION_CHECK_INTERVAL);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkVersion();
    });
    window.addEventListener("online", checkVersion);
}

/** Reloads the page once, however many paths ask for it. */
let reloading = false;
function reloadOnce() {
    if (reloading) return;
    reloading = true;
    location.reload();
}

/** Resolves when `sw` reaches the `installed` state (or gives up after `timeout` ms). */
function waitForInstalled(sw: ServiceWorker, timeout = 15000): Promise<boolean> {
    if (sw.state === "installed" || sw.state === "activated") return Promise.resolve(true);
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), timeout);
        sw.addEventListener("statechange", () => {
            if (sw.state === "installed" || sw.state === "activated") {
                clearTimeout(timer);
                resolve(true);
            } else if (sw.state === "redundant") {
                clearTimeout(timer);
                resolve(false);
            }
        });
    });
}

/** Unregisters the service worker and clears its caches, so the next load comes from the network. */
async function hardReset(registration?: ServiceWorkerRegistration) {
    try {
        await registration?.unregister();
        const keys = await caches.keys();
        await Promise.all(
            keys.filter((k) => k.startsWith("workbox-")).map((k) => caches.delete(k)),
        );
    } catch {
        // Best effort; reload regardless.
    }
}

/**
 * Activates the newest service worker and reloads into it.
 *
 * workbox's own reload only fires on `controllerchange` when the page was controlled at load, so
 * it silently does nothing after a hard refresh or when the update was found by a later
 * `registration.update()`. This listens for the controller change itself, with a timeout fallback.
 */
async function applyUpdate(registration?: ServiceWorkerRegistration) {
    if (!registration || !("serviceWorker" in navigator)) return reloadOnce();

    try {
        if (!registration.waiting) {
            await registration.update();
            if (registration.installing) await waitForInstalled(registration.installing);
        }

        const waiting = registration.waiting;
        if (!waiting) {
            // Nothing newer to activate, yet the server reports a new version.
            await hardReset(registration);
            return reloadOnce();
        }

        navigator.serviceWorker.addEventListener("controllerchange", reloadOnce, {
            once: true,
        });
        waiting.addEventListener("statechange", () => {
            // An uncontrolled page never gets `controllerchange`; reload once the new SW is live.
            if (waiting.state === "activated") reloadOnce();
        });
        waiting.postMessage({ type: "SKIP_WAITING" });
        // Last resort if the SW never responds.
        setTimeout(async () => {
            if (reloading) return;
            await hardReset(registration);
            reloadOnce();
        }, 4000);
    } catch {
        await hardReset(registration);
        reloadOnce();
    }
}

export async function installApp() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    canInstall.value = false;
}
