<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-vue-next";
import { Btn, CopyButton, Panel, ToolPage } from "@/components/ui";

interface Layer { id: number; x: number; y: number; blur: number; spread: number; color: string; alpha: number; inset: boolean }

let nextId = 1;
const mk = (x: number, y: number, blur: number, spread: number, color: string, alpha: number, inset = false): Layer =>
    ({ id: nextId++, x, y, blur, spread, color, alpha, inset });

const layers = ref<Layer[]>([mk(0, 10, 25, -5, "#000000", 0.2), mk(0, 8, 10, -6, "#000000", 0.15)]);
const boxColor = ref("#ffffff");
const bgColor = ref("#f1f5f9");
const radius = ref(16);

const presets: { name: string; layers: () => Layer[]; box?: string; bg?: string }[] = [
    { name: "Subtle", layers: () => [mk(0, 1, 3, 0, "#000000", 0.12), mk(0, 1, 2, -1, "#000000", 0.08)] },
    { name: "Medium", layers: () => [mk(0, 4, 6, -1, "#000000", 0.12), mk(0, 2, 4, -2, "#000000", 0.1)] },
    { name: "Large", layers: () => [mk(0, 20, 25, -5, "#000000", 0.18), mk(0, 8, 10, -6, "#000000", 0.12)] },
    { name: "Inset", layers: () => [mk(0, 2, 6, 0, "#000000", 0.25, true)] },
    { name: "Neon", layers: () => [mk(0, 0, 8, 0, "#22d3ee", 0.9), mk(0, 0, 24, 2, "#22d3ee", 0.6), mk(0, 0, 48, 4, "#22d3ee", 0.35)], box: "#0f172a", bg: "#020617" },
];
function applyPreset(p: (typeof presets)[number]) {
    layers.value = p.layers();
    if (p.box) boxColor.value = p.box;
    if (p.bg) bgColor.value = p.bg;
}

function add() {
    layers.value.push(mk(0, 4, 12, 0, "#000000", 0.2));
}
function remove(i: number) {
    layers.value.splice(i, 1);
}
function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= layers.value.length) return;
    const [l] = layers.value.splice(i, 1);
    layers.value.splice(j, 0, l);
}

function rgba(hex: string, a: number) {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${Math.round(a * 100) / 100})`;
}
const px = (n: number) => (n === 0 ? "0" : `${n}px`);
const value = computed(() =>
    layers.value.length
        ? layers.value.map((l) => `${l.inset ? "inset " : ""}${px(l.x)} ${px(l.y)} ${px(l.blur)} ${px(l.spread)} ${rgba(l.color, l.alpha)}`).join(",\n    ")
        : "none",
);
const css = computed(() => `box-shadow: ${layers.value.length ? "\n    " : ""}${value.value};`);
const previewShadow = computed(() => value.value.replace(/\n\s*/g, " "));
</script>

<template>
    <ToolPage>
        <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-muted">Presets</span>
            <Btn v-for="p in presets" :key="p.name" size="sm" @click="applyPreset(p)">{{ p.name }}</Btn>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <div class="flex flex-col gap-4">
                <Panel title="Shadow layers">
                    <template #actions>
                        <Btn size="sm" variant="ghost" @click="add"><Plus /> Add layer</Btn>
                    </template>
                    <p v-if="!layers.length" class="text-sm text-muted">No shadows. Add a layer to begin.</p>
                    <div class="flex flex-col gap-3">
                        <div v-for="(l, i) in layers" :key="l.id" class="rounded-lg border border-line p-3">
                            <div class="mb-2 flex items-center justify-between gap-2">
                                <span class="text-xs font-semibold text-muted">Layer {{ i + 1 }}</span>
                                <div class="flex items-center gap-2">
                                    <label class="flex items-center gap-1.5 text-xs"><input v-model="l.inset" type="checkbox" class="checkbox" /> Inset</label>
                                    <Btn size="sm" variant="ghost" :disabled="i === 0" title="Move up" @click="move(i, -1)"><ArrowUp /></Btn>
                                    <Btn size="sm" variant="ghost" :disabled="i === layers.length - 1" title="Move down" @click="move(i, 1)"><ArrowDown /></Btn>
                                    <Btn size="sm" variant="ghost" title="Remove layer" @click="remove(i)"><Trash2 /></Btn>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-x-4 gap-y-2">
                                <label class="block"><span class="label">X: {{ l.x }}px</span><input v-model.number="l.x" type="range" min="-100" max="100" class="range w-full" /></label>
                                <label class="block"><span class="label">Y: {{ l.y }}px</span><input v-model.number="l.y" type="range" min="-100" max="100" class="range w-full" /></label>
                                <label class="block"><span class="label">Blur: {{ l.blur }}px</span><input v-model.number="l.blur" type="range" min="0" max="200" class="range w-full" /></label>
                                <label class="block"><span class="label">Spread: {{ l.spread }}px</span><input v-model.number="l.spread" type="range" min="-100" max="100" class="range w-full" /></label>
                                <label class="block"><span class="label">Opacity: {{ Math.round(l.alpha * 100) }}%</span><input v-model.number="l.alpha" type="range" min="0" max="1" step="0.01" class="range w-full" /></label>
                                <div>
                                    <span class="label">Color</span>
                                    <input v-model="l.color" type="color" class="h-8 w-full cursor-pointer rounded-lg border border-line bg-surface p-1" />
                                </div>
                            </div>
                        </div>
                    </div>
                </Panel>
            </div>

            <div class="flex flex-col gap-4">
                <Panel title="Preview">
                    <div class="flex min-h-64 items-center justify-center overflow-hidden rounded-lg border border-line p-8" :style="{ background: bgColor }">
                        <div class="size-40 max-w-full" :style="{ background: boxColor, borderRadius: radius + 'px', boxShadow: previewShadow }" />
                    </div>
                    <div class="mt-4 grid grid-cols-3 gap-3">
                        <div>
                            <span class="label">Box</span>
                            <input v-model="boxColor" type="color" class="h-8 w-full cursor-pointer rounded-lg border border-line bg-surface p-1" />
                        </div>
                        <div>
                            <span class="label">Background</span>
                            <input v-model="bgColor" type="color" class="h-8 w-full cursor-pointer rounded-lg border border-line bg-surface p-1" />
                        </div>
                        <label class="block"><span class="label">Radius: {{ radius }}px</span><input v-model.number="radius" type="range" min="0" max="80" class="range mt-2 w-full" /></label>
                    </div>
                </Panel>
                <Panel title="CSS" flush>
                    <template #actions><CopyButton :text="css" /></template>
                    <pre class="overflow-x-auto p-4 font-mono text-sm">{{ css }}</pre>
                </Panel>
            </div>
        </div>
    </ToolPage>
</template>
