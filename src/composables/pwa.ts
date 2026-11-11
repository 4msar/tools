import { ref } from "vue";
import { toast } from "vue-sonner";
import { registerSW } from "virtual:pwa-register";

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

    const updateSW = registerSW({
        onOfflineReady() {
            toast.success("DevTools is ready to work offline");
        },
        onNeedRefresh() {
            toast("A new version of DevTools is available", {
                duration: Infinity,
                action: { label: "Reload", onClick: () => updateSW(true) },
            });
        },
    });
}

export async function installApp() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    canInstall.value = false;
}
