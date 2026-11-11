<script setup lang="ts">
import { computed, ref } from "vue";
import { CodeArea, CopyButton, Field, Panel, ToolPage } from "@/components/ui";

type Unit = "px" | "rem" | "em" | "pt" | "pct";

const root = ref(16);
const parent = ref(16);
const px = ref(16);
const vals = ref<Record<Unit, string>>({ px: "16", rem: "1", em: "1", pt: "12", pct: "100" });

const num = (n: number) => String(Math.round(n * 10000) / 10000);
const r = computed(() => (root.value > 0 ? root.value : 16));
const p = computed(() => (parent.value > 0 ? parent.value : 16));

function toPx(unit: Unit, v: number) {
    switch (unit) {
        case "px": return v;
        case "rem": return v * r.value;
        case "em": return v * p.value;
        case "pt": return (v * 96) / 72;
        case "pct": return (v / 100) * p.value;
    }
}
function fill(except?: Unit) {
    const v = px.value;
    const all: Record<Unit, string> = {
        px: num(v),
        rem: num(v / r.value),
        em: num(v / p.value),
        pt: num((v * 72) / 96),
        pct: num((v / p.value) * 100),
    };
    for (const k of Object.keys(all) as Unit[]) if (k !== except) vals.value[k] = all[k];
}
function onInput(unit: Unit, e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    vals.value[unit] = raw;
    const n = parseFloat(raw);
    if (Number.isNaN(n)) return;
    px.value = toPx(unit, n);
    fill(unit);
}

const units: { key: Unit; label: string; suffix: string }[] = [
    { key: "px", label: "Pixels", suffix: "px" },
    { key: "rem", label: "Root em", suffix: "rem" },
    { key: "em", label: "Em (parent)", suffix: "em" },
    { key: "pt", label: "Points", suffix: "pt" },
    { key: "pct", label: "Percent (of parent)", suffix: "%" },
];

const table = computed(() => {
    const out: { px: number; rem: string }[] = [];
    [4, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96].forEach((v) => out.push({ px: v, rem: num(v / r.value) }));
    return out;
});

const sample = `.card {
  padding: 24px 16px;
  margin-bottom: 1.5em;
  border-radius: 8px;
  font-size: 14px;
  box-shadow: 0 2px 4px rgba(0,0,0,.1);
  max-width: 640px;
}`;
const bulkIn = ref(sample);
const bulkOut = computed(() =>
    bulkIn.value.replace(/(-?\d*\.?\d+)px\b/gi, (_m, n: string) => {
        const v = parseFloat(n);
        return v === 0 ? "0" : `${num(v / r.value)}rem`;
    }),
);
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Convert">
                <div class="grid grid-cols-2 gap-4">
                    <Field label="Root font size (px)" hint="Used for rem">
                        <input v-model.number="root" type="number" min="1" class="input" @input="fill()" />
                    </Field>
                    <Field label="Parent font size (px)" hint="Used for em and %">
                        <input v-model.number="parent" type="number" min="1" class="input" @input="fill()" />
                    </Field>
                    <Field v-for="u in units" :key="u.key" :label="u.label">
                        <div class="relative">
                            <input :value="vals[u.key]" type="number" step="any" class="input pr-10 font-mono" @input="onInput(u.key, $event)" />
                            <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">{{ u.suffix }}</span>
                        </div>
                    </Field>
                </div>
            </Panel>

            <Panel title="Reference" flush>
                <div class="max-h-96 overflow-auto">
                    <table class="w-full text-sm">
                        <thead class="sticky top-0 bg-subtle text-left text-xs text-muted">
                            <tr><th class="px-4 py-2 font-medium">px</th><th class="px-4 py-2 font-medium">rem</th><th class="w-12" /></tr>
                        </thead>
                        <tbody class="divide-y divide-line">
                            <tr v-for="row in table" :key="row.px">
                                <td class="px-4 py-1.5 font-mono">{{ row.px }}px</td>
                                <td class="px-4 py-1.5 font-mono">{{ row.rem }}rem</td>
                                <td class="px-2"><CopyButton :text="`${row.rem}rem`" icon-only /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Panel>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="CSS with px values" flush>
                <CodeArea v-model="bulkIn" placeholder="Paste CSS containing NNpx values…" height="16rem" />
            </Panel>
            <Panel title="Converted to rem" flush>
                <template #actions><CopyButton :text="bulkOut" /></template>
                <CodeArea :model-value="bulkOut" readonly height="16rem" />
            </Panel>
        </div>
    </ToolPage>
</template>
