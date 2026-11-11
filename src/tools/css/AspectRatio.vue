<script setup lang="ts">
import { computed, ref } from "vue";
import { Link2, Link2Off } from "lucide-vue-next";
import { Btn, CopyButton, Field, Panel, ToolPage } from "@/components/ui";

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

const width = ref(1920);
const height = ref(1080);
const lock = ref(true);
const presets = ["16:9", "4:3", "1:1", "21:9", "9:16", "3:2"];

const ratio = computed(() => {
    const w = Math.round(width.value), h = Math.round(height.value);
    if (!(w > 0 && h > 0)) return null;
    const g = gcd(w, h);
    return { w: w / g, h: h / g, decimal: w / h };
});
const ratioText = computed(() => (ratio.value ? `${ratio.value.w}:${ratio.value.h}` : "—"));
const active = computed(() => (presets.includes(ratioText.value) ? ratioText.value : ""));

const sel = ref<{ w: number; h: number }>({ w: 16, h: 9 });
function usePreset(p: string) {
    const [w, h] = p.split(":").map(Number);
    sel.value = { w, h };
    if (width.value > 0) height.value = Math.round((width.value * h) / w);
}
function onWidth(e: Event) {
    width.value = Number((e.target as HTMLInputElement).value);
    if (lock.value && width.value > 0) height.value = Math.round((width.value * sel.value.h) / sel.value.w);
    else syncSel();
}
function onHeight(e: Event) {
    height.value = Number((e.target as HTMLInputElement).value);
    if (lock.value && height.value > 0) width.value = Math.round((height.value * sel.value.w) / sel.value.h);
    else syncSel();
}
function syncSel() {
    if (ratio.value) sel.value = { w: ratio.value.w, h: ratio.value.h };
}

const preview = computed(() => {
    const r = ratio.value;
    if (!r) return { w: 0, h: 0 };
    const maxW = 320, maxH = 200;
    const s = Math.min(maxW / r.w, maxH / r.h);
    return { w: Math.round(r.w * s), h: Math.round(r.h * s) };
});

const resolutions = computed(() => {
    const r = sel.value;
    const out: { w: number; h: number; label?: string }[] = [];
    const widths = [320, 640, 800, 1024, 1280, 1366, 1600, 1920, 2560, 3840];
    const names: Record<number, string> = { 1280: "HD (720p)", 1920: "Full HD", 2560: "QHD", 3840: "4K UHD" };
    for (const w of widths) {
        const h = (w * r.h) / r.w;
        out.push({ w, h: Math.round(h), label: Number.isInteger(h) ? names[w] : undefined });
    }
    return out;
});
const cssValue = computed(() => (ratio.value ? `aspect-ratio: ${ratio.value.w} / ${ratio.value.h};` : ""));
</script>

<template>
    <ToolPage>
        <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-muted">Presets</span>
            <Btn v-for="p in presets" :key="p" size="sm" :variant="active === p ? 'primary' : 'secondary'" @click="usePreset(p)">{{ p }}</Btn>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Dimensions">
                <div class="flex flex-wrap items-end gap-3">
                    <Field label="Width" class="w-32"><input :value="width" type="number" min="1" class="input" @input="onWidth" /></Field>
                    <Btn variant="ghost" :title="lock ? 'Keep the selected ratio' : 'Ratio follows the dimensions'" @click="lock = !lock">
                        <Link2 v-if="lock" /><Link2Off v-else />
                    </Btn>
                    <Field label="Height" class="w-32"><input :value="height" type="number" min="1" class="input" @input="onHeight" /></Field>
                </div>
                <p class="mt-2 text-xs text-muted">{{ lock ? `Locked to ${sel.w}:${sel.h}. Edit one side to get the other.` : "Unlocked: the ratio is computed from both values." }}</p>
                <dl v-if="ratio" class="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 text-sm">
                    <dt class="text-muted">Ratio</dt><dd class="font-mono text-lg font-semibold">{{ ratioText }}</dd><dd><CopyButton :text="ratioText" icon-only /></dd>
                    <dt class="text-muted">Decimal</dt><dd class="font-mono">{{ ratio.decimal.toFixed(4) }}</dd><dd><CopyButton :text="ratio.decimal.toFixed(4)" icon-only /></dd>
                    <dt class="text-muted">CSS</dt><dd class="font-mono">{{ cssValue }}</dd><dd><CopyButton :text="cssValue" icon-only /></dd>
                </dl>
            </Panel>

            <Panel title="Preview">
                <div class="flex min-h-52 items-center justify-center rounded-lg border border-line bg-subtle p-4">
                    <div v-if="ratio" class="flex items-center justify-center rounded-md border-2 border-accent bg-accent/10 font-mono text-sm text-accent" :style="{ width: preview.w + 'px', height: preview.h + 'px' }">
                        {{ ratioText }}
                    </div>
                    <span v-else class="text-sm text-muted">Enter a width and height.</span>
                </div>
            </Panel>
        </div>

        <Panel :title="`Common resolutions for ${sel.w}:${sel.h}`" flush>
            <ul class="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
                <li v-for="res in resolutions" :key="res.w" class="flex items-center justify-between gap-2 px-4 py-2 text-sm sm:border-b sm:border-line">
                    <span class="font-mono">{{ res.w }} × {{ res.h }}</span>
                    <span class="flex items-center gap-1">
                        <span v-if="res.label" class="chip">{{ res.label }}</span>
                        <Btn size="sm" variant="ghost" @click="width = res.w; height = res.h">Use</Btn>
                        <CopyButton :text="`${res.w}x${res.h}`" icon-only />
                    </span>
                </li>
            </ul>
        </Panel>
    </ToolPage>
</template>
