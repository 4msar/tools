<script setup lang="ts">
import { computed } from "vue";
import { Check, Download, Settings2, Sparkles } from "lucide-vue-next";
import { chatModels } from "@/chat/models";
import { engineProgress, engineStatus } from "@/chat/engine";

defineEmits<{ start: []; settings: [] }>();
const model = chatModels[0];
const unsupported = computed(() => engineStatus.value === "unsupported");

function progressPercent() {
    return Math.round(engineProgress.value.progress * 100);
}
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
        <div
            class="mb-5 grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent"
        >
            <Sparkles class="size-5" />
        </div>
        <p
            class="mb-1 text-xs font-semibold tracking-[0.12em] text-accent uppercase"
        >
            On-device assistant · beta
        </p>
        <h2 class="text-xl font-semibold tracking-tight text-fg">
            Find the right tool
        </h2>
        <p class="mt-2 text-sm leading-6 text-fg-muted">
            Describe what you are trying to do and get a useful starting point
            from the tools already in this app.
        </p>

        <div
            v-if="engineStatus === 'downloading'"
            class="mt-5 rounded-xl border border-line bg-subtle p-4"
        >
            <div
                class="flex items-center justify-between text-sm font-medium text-fg"
            >
                <span>Downloading {{ model.label }}</span
                ><span>{{ progressPercent }}%</span>
            </div>
            <div class="mt-3 h-2 overflow-hidden rounded-full bg-line">
                <div
                    class="h-full rounded-full bg-accent transition-[width]"
                    :style="{ width: `${progressPercent}%` }"
                />
            </div>
            <p class="mt-2 text-xs text-fg-subtle">
                {{ engineProgress.text || "Preparing the model…" }}
            </p>
        </div>
        <div v-else class="mt-5 rounded-xl border border-line bg-subtle p-4">
            <div class="flex items-start gap-3">
                <Download class="mt-0.5 size-4 shrink-0 text-accent" />
                <div class="min-w-0">
                    <p class="font-medium text-fg">{{ model.label }} model</p>
                    <p class="mt-1 text-xs text-fg-subtle">
                        {{ model.size }} · {{ model.note }}
                    </p>
                </div>
            </div>
        </div>

        <ul class="mt-5 space-y-3 text-xs leading-5 text-fg-muted">
            <li class="flex gap-2">
                <Check class="mt-0.5 size-4 shrink-0 text-accent" />Weights are
                cached in this browser.
            </li>
            <li class="flex gap-2">
                <Check class="mt-0.5 size-4 shrink-0 text-accent" />Your
                messages never leave this device.
            </li>
            <li class="flex gap-2">
                <Check
                    class="mt-0.5 size-4 shrink-0 text-accent"
                />Conversations stay local and can be deleted anytime.
            </li>
        </ul>

        <p
            v-if="unsupported"
            class="mt-5 rounded-lg bg-info-soft px-3 py-2 text-xs leading-5 text-info"
        >
            WebGPU is unavailable here. You can still use retrieval-only
            suggestions without downloading anything.
        </p>
        <div class="mt-auto flex flex-col gap-2 pt-6">
            <button
                type="button"
                class="flex h-10 items-center justify-center gap-2 rounded-md bg-inverse px-3 text-sm font-semibold text-inverse-fg hover:opacity-90 disabled:opacity-60"
                :disabled="engineStatus === 'downloading'"
                @click="$emit('start')"
            >
                <Download class="size-4" />{{
                    unsupported
                        ? "Continue without model"
                        : "Download and start"
                }}
            </button>
            <button
                type="button"
                class="flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm text-fg-subtle hover:bg-subtle hover:text-fg"
                @click="$emit('settings')"
            >
                <Settings2 class="size-4" />Models and settings
            </button>
        </div>
    </div>
</template>
