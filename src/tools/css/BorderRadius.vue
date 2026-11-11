<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { Link2, Link2Off, Shuffle } from "lucide-vue-next";
import { Btn, CopyButton, Field, Panel, Tabs, ToolPage } from "@/components/ui";

const mode = ref<"corners" | "blob">("corners");

// ---- simple corners ----
const unit = ref<"px" | "%" | "rem">("px");
const linked = ref(true);
const c = reactive({ tl: 24, tr: 24, br: 24, bl: 24 });
const corners = [
    { k: "tl", label: "Top left" }, { k: "tr", label: "Top right" }, { k: "br", label: "Bottom right" }, { k: "bl", label: "Bottom left" },
] as const;
const max = computed(() => (unit.value === "px" ? 200 : unit.value === "%" ? 50 : 12));
function setCorner(k: keyof typeof c, v: number) {
    if (linked.value) c.tl = c.tr = c.br = c.bl = v;
    else c[k] = v;
}
const cornerValue = computed(() => {
    const u = unit.value;
    const { tl, tr, br, bl } = c;
    if (tl === tr && tr === br && br === bl) return `${tl}${u}`;
    if (tl === br && tr === bl) return `${tl}${u} ${tr}${u}`;
    if (tr === bl) return `${tl}${u} ${tr}${u} ${br}${u}`;
    return `${tl}${u} ${tr}${u} ${br}${u} ${bl}${u}`;
});

// ---- blob: eight values, one split point per side ----
// top/bottom are the horizontal split of each edge, left/right the vertical split.
const b = reactive({ top: 30, right: 30, bottom: 70, left: 70 });
const blobValue = computed(() => `${b.top}% ${100 - b.top}% ${100 - b.bottom}% ${b.bottom}% / ${b.left}% ${b.right}% ${100 - b.right}% ${100 - b.left}%`);
function randomize() {
    const rnd = () => 20 + Math.round(Math.random() * 60);
    Object.assign(b, { top: rnd(), right: rnd(), bottom: rnd(), left: rnd() });
}
const blobPresets = [
    { name: "Pebble", v: [30, 30, 70, 70] }, { name: "Egg", v: [50, 60, 50, 60] }, { name: "Leaf", v: [0, 100, 100, 0] },
    { name: "Drop", v: [50, 100, 50, 0] }, { name: "Squircle-ish", v: [42, 42, 58, 58] }, { name: "Wobble", v: [63, 37, 46, 59] },
];

const value = computed(() => (mode.value === "corners" ? cornerValue.value : blobValue.value));
const css = computed(() => `border-radius: ${value.value};`);
const tailwind = computed(() => `rounded-[${value.value.replace(/ /g, "_")}]`);

const w = ref(260);
const h = ref(260);
const fill = ref("#6366f1");
const border = ref(0);
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="mode" :options="[{ value: 'corners', label: 'Corners' }, { value: 'blob', label: 'Blob shape' }]" />
        </template>

        <div class="grid gap-4 lg:grid-cols-[1fr_22rem]">
            <Panel title="Preview">
                <template #actions>
                    <label class="flex items-center gap-1.5 text-xs text-muted">W <input v-model.number="w" type="number" min="40" max="600" class="input !h-7 !w-16 !py-0 text-xs" /></label>
                    <label class="flex items-center gap-1.5 text-xs text-muted">H <input v-model.number="h" type="number" min="40" max="600" class="input !h-7 !w-16 !py-0 text-xs" /></label>
                    <input v-model="fill" type="color" class="size-7 cursor-pointer rounded border border-line bg-surface" aria-label="Fill color" />
                </template>
                <div class="flex min-h-[22rem] items-center justify-center overflow-auto rounded-lg bg-subtle p-6">
                    <div :style="{ width: w + 'px', height: h + 'px', maxWidth: '100%', borderRadius: value, background: fill, border: border ? `${border}px solid var(--fg)` : 'none' }" class="shrink-0 transition-[border-radius] duration-200" />
                </div>
            </Panel>

            <div class="flex min-w-0 flex-col gap-4">
                <Panel v-if="mode === 'corners'" title="Corners">
                    <template #actions>
                        <Btn size="sm" variant="ghost" :title="linked ? 'Edit corners separately' : 'Keep all corners equal'" @click="linked = !linked"><component :is="linked ? Link2 : Link2Off" /> {{ linked ? "Linked" : "Separate" }}</Btn>
                    </template>
                    <div class="flex flex-col gap-3">
                        <Field label="Unit"><select v-model="unit" class="select"><option>px</option><option>%</option><option>rem</option></select></Field>
                        <Field v-for="k in corners" :key="k.k" :label="`${k.label}: ${c[k.k]}${unit}`">
                            <input :value="c[k.k]" type="range" min="0" :max="max" :step="unit === 'rem' ? 0.25 : 1" class="range" @input="setCorner(k.k, Number(($event.target as HTMLInputElement).value))" />
                        </Field>
                    </div>
                </Panel>
                <Panel v-else title="Blob">
                    <template #actions><Btn size="sm" variant="ghost" @click="randomize"><Shuffle /> Random</Btn></template>
                    <div class="flex flex-col gap-3">
                        <Field v-for="k in (['top', 'right', 'bottom', 'left'] as const)" :key="k" :label="`${k[0].toUpperCase() + k.slice(1)} edge split: ${b[k]}%`">
                            <input v-model.number="b[k]" type="range" min="0" max="100" class="range" />
                        </Field>
                        <div class="flex flex-wrap gap-1.5">
                            <button v-for="x in blobPresets" :key="x.name" type="button" class="chip cursor-pointer hover:text-fg" @click="Object.assign(b, { top: x.v[0], right: x.v[1], bottom: x.v[2], left: x.v[3] })">{{ x.name }}</button>
                        </div>
                        <p class="text-xs text-muted">Each slider moves the point where one edge switches from one corner's curve to the next, using the 8-value <code class="code">a b c d / e f g h</code> syntax.</p>
                    </div>
                </Panel>

                <Panel title="CSS" flush>
                    <template #actions><CopyButton :text="css" /></template>
                    <pre class="p-4 font-mono text-[13px] break-all whitespace-pre-wrap">{{ css }}</pre>
                    <div class="flex items-center justify-between gap-2 border-t border-line px-4 py-2">
                        <code class="min-w-0 font-mono text-xs break-all text-muted">{{ tailwind }}</code><CopyButton :text="tailwind" icon-only />
                    </div>
                </Panel>
                <Field :label="`Outline: ${border}px`"><input v-model.number="border" type="range" min="0" max="12" class="range" /></Field>
            </div>
        </div>
    </ToolPage>
</template>
