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

    const updateSW = registerSW({
        onOfflineReady() {
            toast.success("DevTools is ready to work offline");
        },
        onNeedRefresh() {
            promptReload(() => updateSW(true));
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
                    // SW didn't change (or isn't controlling): fall back to a plain reload.
                    promptReload(() => location.reload());
                }
            } else {
                promptReload(() => location.reload());
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

export async function installApp() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    canInstall.value = false;
}
