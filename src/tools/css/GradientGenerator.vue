<script setup lang="ts">
import { computed, ref } from "vue";
import { Dices, Plus, Trash2 } from "lucide-vue-next";
import { Btn, CopyButton, Field, Panel, Tabs, ToolPage } from "@/components/ui";

type GType = "linear" | "radial" | "conic";
interface Stop { id: number; color: string; pos: number }

let nextId = 1;
const stop = (color: string, pos: number): Stop => ({ id: nextId++, color, pos });

const type = ref<GType>("linear");
const angle = ref(90);
const shape = ref<"circle" | "ellipse">("circle");
const cx = ref(50);
const cy = ref(50);
const stops = ref<Stop[]>([stop("#6366f1", 0), stop("#ec4899", 100)]);
const selected = ref(stops.value[0].id);

const sorted = computed(() => [...stops.value].sort((a, b) => a.pos - b.pos));
const stopList = computed(() => sorted.value.map((s) => `${s.color} ${Math.round(s.pos)}%`).join(", "));
const gradient = computed(() => {
    if (type.value === "linear") return `linear-gradient(${angle.value}deg, ${stopList.value})`;
    if (type.value === "radial") return `radial-gradient(${shape.value} at ${cx.value}% ${cy.value}%, ${stopList.value})`;
    return `conic-gradient(from ${angle.value}deg at ${cx.value}% ${cy.value}%, ${stopList.value})`;
});
const barGradient = computed(() => `linear-gradient(90deg, ${stopList.value})`);
const css = computed(() => `background: ${gradient.value};`);

const presets: { name: string; type: GType; angle: number; stops: [string, number][] }[] = [
    { name: "Sunset", type: "linear", angle: 135, stops: [["#f97316", 0], ["#ec4899", 55], ["#7c3aed", 100]] },
    { name: "Ocean", type: "linear", angle: 180, stops: [["#06b6d4", 0], ["#3b82f6", 100]] },
    { name: "Mint", type: "linear", angle: 120, stops: [["#a7f3d0", 0], ["#3b82f6", 100]] },
    { name: "Aurora", type: "linear", angle: 90, stops: [["#22c55e", 0], ["#06b6d4", 50], ["#8b5cf6", 100]] },
    { name: "Spotlight", type: "radial", angle: 0, stops: [["#fde68a", 0], ["#f97316", 60], ["#7c2d12", 100]] },
    { name: "Rainbow", type: "conic", angle: 0, stops: [["#ef4444", 0], ["#eab308", 20], ["#22c55e", 40], ["#06b6d4", 60], ["#8b5cf6", 80], ["#ef4444", 100]] },
];
function applyPreset(p: (typeof presets)[number]) {
    type.value = p.type;
    angle.value = p.angle;
    stops.value = p.stops.map(([c, pos]) => stop(c, pos));
    selected.value = stops.value[0].id;
}

const sel = computed(() => stops.value.find((s) => s.id === selected.value) ?? stops.value[0]);

function hexAt(pos: number): string {
    const s = sorted.value;
    if (!s.length) return "#888888";
    if (pos <= s[0].pos) return s[0].color;
    for (let i = 1; i < s.length; i++) {
        if (pos <= s[i].pos) {
            const a = s[i - 1], b = s[i];
            const t = b.pos === a.pos ? 0 : (pos - a.pos) / (b.pos - a.pos);
            const ca = parseInt(a.color.slice(1), 16), cb = parseInt(b.color.slice(1), 16);
            const ch = (sh: number) => Math.round(((ca >> sh) & 255) * (1 - t) + ((cb >> sh) & 255) * t);
            return "#" + [16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, "0")).join("");
        }
    }
    return s[s.length - 1].color;
}

const bar = ref<HTMLElement | null>(null);
function addAt(e: MouseEvent) {
    if (!bar.value) return;
    const r = bar.value.getBoundingClientRect();
    const pos = Math.min(100, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * 100)));
    const s = stop(hexAt(pos), pos);
    stops.value.push(s);
    selected.value = s.id;
}
function addStop() {
    const s = stop(hexAt(50), 50);
    stops.value.push(s);
    selected.value = s.id;
}
function removeStop(id: number) {
    if (stops.value.length <= 2) return;
    stops.value = stops.value.filter((s) => s.id !== id);
    if (selected.value === id) selected.value = stops.value[0].id;
}

const rnd = (n: number) => Math.floor(Math.random() * n);
const rndHex = () => "#" + [0, 0, 0].map(() => rnd(256).toString(16).padStart(2, "0")).join("");
function random() {
    const t: GType[] = ["linear", "radial", "conic"];
    type.value = t[rnd(3)];
    angle.value = rnd(361);
    const n = 2 + rnd(3);
    stops.value = Array.from({ length: n }, (_, i) => stop(rndHex(), Math.round((i / (n - 1)) * 100)));
    selected.value = stops.value[0].id;
}
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="type" :options="[{ value: 'linear', label: 'Linear' }, { value: 'radial', label: 'Radial' }, { value: 'conic', label: 'Conic' }]" />
        </template>

        <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-muted">Presets</span>
            <Btn v-for="p in presets" :key="p.name" size="sm" @click="applyPreset(p)">{{ p.name }}</Btn>
            <Btn size="sm" variant="primary" @click="random"><Dices /> Random</Btn>
        </div>

        <div class="h-64 w-full rounded-xl border border-line sm:h-80" :style="{ background: gradient }" role="img" aria-label="Gradient preview" />

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Settings">
                <div class="flex flex-col gap-4">
                    <label v-if="type !== 'radial'" class="block">
                        <span class="label">{{ type === "linear" ? "Angle" : "Start angle" }}: {{ angle }}°</span>
                        <input v-model.number="angle" type="range" min="0" max="360" class="range w-full" />
                    </label>
                    <Field v-if="type === 'radial'" label="Shape">
                        <select v-model="shape" class="select"><option value="circle">Circle</option><option value="ellipse">Ellipse</option></select>
                    </Field>
                    <div v-if="type !== 'linear'" class="grid grid-cols-2 gap-4">
                        <label class="block"><span class="label">Center X: {{ cx }}%</span><input v-model.number="cx" type="range" min="0" max="100" class="range w-full" /></label>
                        <label class="block"><span class="label">Center Y: {{ cy }}%</span><input v-model.number="cy" type="range" min="0" max="100" class="range w-full" /></label>
                    </div>
                    <div>
                        <span class="label">Color stops <span class="font-normal text-muted">(click the bar to add)</span></span>
                        <div ref="bar" class="relative mt-1 h-10 cursor-copy rounded-lg border border-line" :style="{ background: barGradient }" @click="addAt">
                            <button
                                v-for="s in stops"
                                :key="s.id"
                                type="button"
                                class="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2 border-surface shadow ring-1 ring-line-strong"
                                :class="s.id === selected ? 'z-10 ring-2 ring-accent' : ''"
                                :style="{ left: s.pos + '%', background: s.color }"
                                :aria-label="`Stop at ${s.pos}%`"
                                @click.stop="selected = s.id"
                            />
                        </div>
                    </div>
                </div>
            </Panel>

            <Panel title="Stops">
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="addStop"><Plus /> Add stop</Btn>
                </template>
                <ul class="flex flex-col gap-2">
                    <li
                        v-for="s in sorted"
                        :key="s.id"
                        class="flex items-center gap-2 rounded-lg border p-2"
                        :class="s.id === sel.id ? 'border-accent bg-accent/5' : 'border-line'"
                        @click="selected = s.id"
                    >
                        <input v-model="s.color" type="color" class="size-8 shrink-0 cursor-pointer rounded-md border border-line bg-surface p-0.5" :aria-label="'Stop color'" />
                        <input v-model="s.color" class="input w-24 font-mono" spellcheck="false" />
                        <input v-model.number="s.pos" type="range" min="0" max="100" class="range min-w-0 flex-1" aria-label="Position" />
                        <span class="w-10 text-right font-mono text-xs text-muted">{{ Math.round(s.pos) }}%</span>
                        <Btn size="sm" variant="ghost" :disabled="stops.length <= 2" title="Remove stop" @click.stop="removeStop(s.id)"><Trash2 /></Btn>
                    </li>
                </ul>
            </Panel>
        </div>

        <Panel title="CSS" flush>
            <template #actions><CopyButton :text="css" /></template>
            <pre class="overflow-x-auto p-4 font-mono text-sm break-words whitespace-pre-wrap">{{ css }}</pre>
        </Panel>
    </ToolPage>
</template>
