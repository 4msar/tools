<script setup lang="ts">
import { ref, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { Keyboard, RotateCcw, X } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Btn } from "@/components/ui";
import { APP_VERSION } from "@/site";
import {
    DEFAULT_LAUNCHER_SHORTCUT,
    desktopSettingsOpen as open,
    formatShortcut,
    getDesktopSettings,
    keyEventToAccelerator,
    setAutostart,
    setCloseToTray,
    setLauncherShortcut,
    setShowInDock,
    type DesktopSettings,
} from "@/composables/desktop";

const settings = ref<DesktopSettings>();
const recording = ref(false);
const pending = ref(false);

watch(open, async (v) => {
    recording.value = false;
    if (v) settings.value = await getDesktopSettings();
});

onKeyStroke("Escape", (e) => {
    if (!open.value || recording.value) return;
    e.preventDefault();
    open.value = false;
});

async function saveShortcut(accel: string) {
    if (!settings.value) return;
    pending.value = true;
    try {
        await setLauncherShortcut(accel);
        settings.value.launcherShortcut = accel;
        toast.success(accel ? `Launcher shortcut set to ${formatShortcut(accel)}` : "Launcher shortcut turned off");
    } catch (err) {
        toast.error(String(err));
    } finally {
        pending.value = false;
        recording.value = false;
    }
}

function onRecordKey(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        recording.value = false;
        return;
    }
    const accel = keyEventToAccelerator(e);
    if (accel) saveShortcut(accel);
}

async function toggle(key: "autostart" | "closeToTray" | "showInDock") {
    if (!settings.value) return;
    const next = !settings.value[key];
    const fn = { autostart: setAutostart, closeToTray: setCloseToTray, showInDock: setShowInDock }[key];
    try {
        await fn(next);
        settings.value[key] = next;
    } catch (err) {
        toast.error(String(err));
    }
}
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0"
            leave-active-class="transition duration-100 ease-in"
            leave-to-class="opacity-0"
        >
            <div
                v-if="open"
                class="fixed inset-0 z-50 flex items-start justify-center bg-inverse/25 p-4 pt-[12vh] backdrop-blur-sm"
                @mousedown.self="open = false"
            >
                <div class="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-float" role="dialog" aria-label="Desktop settings">
                    <div class="flex items-center justify-between border-b border-line px-5 py-3.5">
                        <h2 class="text-sm font-semibold text-fg">Desktop settings</h2>
                        <button type="button" class="cursor-pointer rounded-full p-1 text-fg-subtle hover:bg-subtle hover:text-fg" aria-label="Close" @click="open = false">
                            <X class="size-4" stroke-width="1.75" />
                        </button>
                    </div>

                    <div v-if="settings" class="divide-y divide-line">
                        <div class="px-5 py-4">
                            <div class="flex items-center justify-between gap-4">
                                <div>
                                    <p class="text-sm font-medium text-fg">Launcher shortcut</p>
                                    <p class="text-xs text-fg-subtle">Opens tool search from anywhere. Press it again to hide.</p>
                                </div>
                                <button
                                    type="button"
                                    class="flex h-9 min-w-28 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-sm ring-1 ring-inset outline-none"
                                    :class="recording ? 'bg-accent/10 text-accent ring-accent' : 'bg-subtle text-fg ring-line hover:bg-surface'"
                                    :disabled="pending"
                                    @click="recording = !recording"
                                    @keydown="recording && onRecordKey($event)"
                                    @blur="recording = false"
                                >
                                    <Keyboard v-if="recording" class="size-4" stroke-width="1.75" />
                                    <span v-if="recording">Press keys…</span>
                                    <span v-else class="font-mono">{{ formatShortcut(settings.launcherShortcut) }}</span>
                                </button>
                            </div>
                            <div class="mt-2 flex gap-1.5">
                                <Btn
                                    size="sm"
                                    variant="ghost"
                                    :disabled="pending || settings.launcherShortcut === DEFAULT_LAUNCHER_SHORTCUT"
                                    @click="saveShortcut(DEFAULT_LAUNCHER_SHORTCUT)"
                                >
                                    <RotateCcw />Reset to {{ formatShortcut(DEFAULT_LAUNCHER_SHORTCUT) }}
                                </Btn>
                                <Btn size="sm" variant="ghost" :disabled="pending || !settings.launcherShortcut" @click="saveShortcut('')">
                                    Turn off
                                </Btn>
                            </div>
                        </div>

                        <label class="flex cursor-pointer items-center justify-between gap-4 px-5 py-3.5">
                            <span>
                                <span class="block text-sm font-medium text-fg">Launch at login</span>
                                <span class="block text-xs text-fg-subtle">Starts quietly in the menubar.</span>
                            </span>
                            <input type="checkbox" class="size-4 accent-[var(--accent)]" :checked="settings.autostart" @change="toggle('autostart')" />
                        </label>

                        <label class="flex cursor-pointer items-center justify-between gap-4 px-5 py-3.5">
                            <span>
                                <span class="block text-sm font-medium text-fg">Keep running when closed</span>
                                <span class="block text-xs text-fg-subtle">Closing the window leaves DevTools in the menubar.</span>
                            </span>
                            <input type="checkbox" class="size-4 accent-[var(--accent)]" :checked="settings.closeToTray" @change="toggle('closeToTray')" />
                        </label>

                        <label v-if="settings.platform === 'macos'" class="flex cursor-pointer items-center justify-between gap-4 px-5 py-3.5">
                            <span>
                                <span class="block text-sm font-medium text-fg">Show in Dock</span>
                                <span class="block text-xs text-fg-subtle">Turn off to live only in the menubar.</span>
                            </span>
                            <input type="checkbox" class="size-4 accent-[var(--accent)]" :checked="settings.showInDock" @change="toggle('showInDock')" />
                        </label>
                    </div>

                    <div class="border-t border-line bg-subtle px-5 py-2 text-xs text-fg-subtle">DevTools v{{ APP_VERSION }}</div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
