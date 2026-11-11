<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-vue-next";
import { Btn, CopyButton, Panel, ToolPage } from "@/components/ui";
import { copyText } from "@/composables/useClipboard";

const currentColor = ref("#3b82f6");
const showDetails = ref(true);

// Tailwind palette shades used as the random pool
const tailwindColors = "#eff6ff #dbeafe #bfdbfe #93c5fd #60a5fa #3b82f6 #2563eb #1d4ed8 #1e40af #1e3a8a #fef2f2 #fecaca #fca5a5 #f87171 #ef4444 #dc2626 #b91c1c #991b1b #7f1d1d #450a0a #f0fdf4 #dcfce7 #bbf7d0 #86efac #4ade80 #22c55e #16a34a #15803d #166534 #14532d #fefce8 #fef3c7 #fde68a #fcd34d #facc15 #eab308 #ca8a04 #a16207 #854d0e #713f12 #faf5ff #f3e8ff #e9d5ff #d8b4fe #c084fc #a855f7 #9333ea #7c3aed #6d28d9 #5b21b6 #fdf2f8 #fce7f3 #fbcfe8 #f9a8d4 #f472b6 #ec4899 #db2777 #be185d #9d174d #831843 #f0f9ff #e0f2fe #bae6fd #7dd3fc #38bdf8 #0ea5e9 #0284c7 #0369a1 #075985 #0c4a6e #fff7ed #ffedd5 #fed7aa #fdba74 #fb923c #f97316 #ea580c #c2410c #9a3412 #7c2d12 #f0fdfa #ccfbf1 #99f6e4 #5eead4 #2dd4bf #14b8a6 #0d9488 #0f766e #115e59 #134e4a #ecfeff #cffafe #a5f3fc #67e8f9 #22d3ee #06b6d4 #0891b2 #0e7490 #155e75 #164e63 #f9fafb #f3f4f6 #e5e7eb #d1d5db #9ca3af #6b7280 #4b5563 #374151 #1f2937 #111827 #ecfdf5 #d1fae5 #a7f3d0 #6ee7b7 #34d399 #10b981 #059669 #047857 #065f46 #064e3b #fff1f2 #ffe4e6 #fecdd3 #fda4af #fb7185 #f43f5e #e11d48 #be123c #9f1239 #881337 #f5f3ff #ede9fe #ddd6fe #c4b5fd #a78bfa #8b5cf6 #4c1d95 #fffbeb #f59e0b #d97706 #b45309 #92400e #78350f #f7fee7 #ecfccb #d9f99d #bef264 #a3e635 #84cc16 #65a30d #4d7c0f #365314 #1a2e05 #fafafa #f5f5f5 #e5e5e5 #d4d4d4 #a3a3a3 #737373 #525252 #404040 #262626 #171717 #fafaf9 #f5f5f4 #e7e5e4 #d6d3d1 #a8a29e #78716c #57534e #44403c #292524 #1c1917 #f4f4f5 #e4e4e7 #d4d4d8 #a1a1aa #71717a #52525b #3f3f46 #27272a #18181b #f8fafc #f1f5f9 #e2e8f0 #cbd5e1 #94a3b8 #64748b #475569 #334155 #1e293b #0f172a".split(" ");

function getLuminance(hex: string) {
    const color = hex.replace("#", "");
    const r = parseInt(color.substring(0, 2), 16) / 255;
    const g = parseInt(color.substring(2, 4), 16) / 255;
    const b = parseInt(color.substring(4, 6), 16) / 255;
    const [sr, sg, sb] = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * sr + 0.7152 * sg + 0.0722 * sb;
}

const isLightBackground = computed(() => getLuminance(currentColor.value) > 0.5);

// Text/buttons rendered on top of the user-chosen swatch keep literal colors so they stay readable on it.
const textColorClass = computed(() => (isLightBackground.value ? "text-black" : "text-white"));
const textColorSecondaryClass = computed(() => (isLightBackground.value ? "text-black/80" : "text-white/80"));
const buttonClass = computed(() => (isLightBackground.value ? "bg-black/20 hover:bg-black/30 text-black" : "bg-white/20 hover:bg-white/30 text-white"));

const formats = computed(() => {
    const hex = currentColor.value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    let h = 0, s = 0;
    if (d !== 0) {
        s = d / (1 - Math.abs(2 * l - 1));
        if (max === rn) h = ((gn - bn) / d) % 6;
        else if (max === gn) h = (bn - rn) / d + 2;
        else h = (rn - gn) / d + 4;
        h = Math.round(h * 60);
        if (h < 0) h += 360;
    }
    return [
        { label: "HEX", value: hex.toUpperCase() },
        { label: "RGB", value: `rgb(${r}, ${g}, ${b})` },
        { label: "HSL", value: `hsl(${h}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)` },
    ];
});

function randomizeColor() {
    currentColor.value = tailwindColors[Math.floor(Math.random() * tailwindColors.length)];
}

function updateColor(event: Event) {
    currentColor.value = (event.target as HTMLInputElement).value;
}

function copyColor() {
    copyText(currentColor.value.toUpperCase(), `Copied ${currentColor.value.toUpperCase()}`);
}

onMounted(randomizeColor);
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-[1fr_20rem]">
            <div
                class="relative flex min-h-[24rem] cursor-pointer items-center justify-center rounded-xl border border-line p-6 shadow-xs transition-colors duration-500 ease-in-out select-none"
                :style="{ backgroundColor: currentColor }"
                @dblclick="randomizeColor"
            >
                <button
                    type="button"
                    class="absolute top-3 right-3 grid size-8 cursor-pointer place-items-center rounded-lg transition-colors"
                    :class="buttonClass"
                    :title="showDetails ? 'Hide details' : 'Show details'"
                    @click.stop="showDetails = !showDetails"
                    @dblclick.stop
                >
                    <EyeOff v-if="showDetails" class="size-4" />
                    <Eye v-else class="size-4" />
                </button>

                <div v-if="showDetails" class="space-y-3 text-center">
                    <p :class="textColorClass" class="font-mono text-3xl font-semibold">{{ currentColor.toUpperCase() }}</p>
                    <p :class="textColorSecondaryClass" class="text-sm">Double-click anywhere to randomize the color</p>
                </div>
            </div>

            <div class="space-y-4">
                <Panel title="Controls">
                    <div class="space-y-3">
                        <div class="flex items-center gap-3">
                            <input id="colorPicker" type="color" :value="currentColor" class="size-10 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent p-0.5" @input="updateColor" />
                            <label for="colorPicker" class="text-sm text-muted">Pick a specific color</label>
                        </div>
                        <div class="flex gap-2">
                            <Btn variant="primary" class="flex-1" @click="randomizeColor"><RefreshCw /> Random</Btn>
                            <Btn class="flex-1" @click="copyColor"><Copy /> Copy HEX</Btn>
                        </div>
                    </div>
                </Panel>

                <Panel title="Formats">
                    <ul class="space-y-2">
                        <li v-for="f in formats" :key="f.label" class="flex items-center justify-between gap-2 rounded-lg bg-subtle px-3 py-2">
                            <span class="w-9 text-xs font-medium text-muted">{{ f.label }}</span>
                            <span class="flex-1 truncate font-mono text-sm">{{ f.value }}</span>
                            <CopyButton :text="f.value" icon-only />
                        </li>
                    </ul>
                </Panel>
            </div>
        </div>
    </ToolPage>
</template>
