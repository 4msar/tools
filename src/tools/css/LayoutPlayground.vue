<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { CSSProperties } from "vue";
import { Minus, Plus, RotateCcw } from "lucide-vue-next";
import { Btn, CopyButton, Field, Panel, Tabs, ToolPage } from "@/components/ui";

const mode = ref<"flex" | "grid">("flex");
const count = ref(5);
const selected = ref<number | null>(null);

// ---- flexbox ----
const flexDefaults = { direction: "row", wrap: "nowrap", justify: "flex-start", align: "stretch", content: "normal", gap: 12 };
const flex = reactive({ ...flexDefaults });
const flexOpts = {
    direction: ["row", "row-reverse", "column", "column-reverse"],
    wrap: ["nowrap", "wrap", "wrap-reverse"],
    justify: ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"],
    align: ["stretch", "flex-start", "center", "flex-end", "baseline"],
    content: ["normal", "flex-start", "center", "flex-end", "space-between", "space-around", "stretch"],
};
interface FlexItem { grow: number; shrink: number; basis: string; self: string; order: number }
const flexItems = reactive<FlexItem[]>(Array.from({ length: 12 }, () => ({ grow: 0, shrink: 1, basis: "auto", self: "auto", order: 0 })));

// ---- grid ----
const gridDefaults = { columns: "repeat(3, 1fr)", rows: "auto", gap: 12, justifyItems: "stretch", alignItems: "stretch", flow: "row" };
const grid = reactive({ ...gridDefaults });
const columnPresets = ["repeat(3, 1fr)", "1fr 2fr 1fr", "200px 1fr", "repeat(auto-fit, minmax(120px, 1fr))", "repeat(4, minmax(0, 1fr))", "auto 1fr auto"];
interface GridItem { colSpan: number; rowSpan: number }
const gridItems = reactive<GridItem[]>(Array.from({ length: 12 }, () => ({ colSpan: 1, rowSpan: 1 })));

const containerStyle = computed(() =>
    (mode.value === "flex"
        ? { display: "flex", flexDirection: flex.direction, flexWrap: flex.wrap, justifyContent: flex.justify, alignItems: flex.align, alignContent: flex.content, gap: flex.gap + "px" }
        : { display: "grid", gridTemplateColumns: grid.columns, gridTemplateRows: grid.rows, gap: grid.gap + "px", justifyItems: grid.justifyItems, alignItems: grid.alignItems, gridAutoFlow: grid.flow }) as CSSProperties,
);

function itemStyle(i: number): CSSProperties {
    if (mode.value === "flex") {
        const it = flexItems[i];
        return { flex: `${it.grow} ${it.shrink} ${it.basis || "auto"}`, alignSelf: it.self, order: it.order };
    }
    const it = gridItems[i];
    return { gridColumn: it.colSpan > 1 ? `span ${it.colSpan}` : undefined, gridRow: it.rowSpan > 1 ? `span ${it.rowSpan}` : undefined };
}

const css = computed(() => {
    const lines: string[] = [".container {"];
    if (mode.value === "flex") {
        lines.push("  display: flex;");
        if (flex.direction !== "row") lines.push(`  flex-direction: ${flex.direction};`);
        if (flex.wrap !== "nowrap") lines.push(`  flex-wrap: ${flex.wrap};`);
        if (flex.justify !== "flex-start") lines.push(`  justify-content: ${flex.justify};`);
        if (flex.align !== "stretch") lines.push(`  align-items: ${flex.align};`);
        if (flex.content !== "normal") lines.push(`  align-content: ${flex.content};`);
        if (flex.gap) lines.push(`  gap: ${flex.gap}px;`);
    } else {
        lines.push("  display: grid;", `  grid-template-columns: ${grid.columns};`);
        if (grid.rows.trim() && grid.rows !== "auto") lines.push(`  grid-template-rows: ${grid.rows};`);
        if (grid.gap) lines.push(`  gap: ${grid.gap}px;`);
        if (grid.justifyItems !== "stretch") lines.push(`  justify-items: ${grid.justifyItems};`);
        if (grid.alignItems !== "stretch") lines.push(`  align-items: ${grid.alignItems};`);
        if (grid.flow !== "row") lines.push(`  grid-auto-flow: ${grid.flow};`);
    }
    lines.push("}");
    for (let i = 0; i < count.value; i++) {
        const rules: string[] = [];
        if (mode.value === "flex") {
            const it = flexItems[i];
            if (it.grow !== 0 || it.shrink !== 1 || (it.basis && it.basis !== "auto")) rules.push(`  flex: ${it.grow} ${it.shrink} ${it.basis || "auto"};`);
            if (it.self !== "auto") rules.push(`  align-self: ${it.self};`);
            if (it.order) rules.push(`  order: ${it.order};`);
        } else {
            const it = gridItems[i];
            if (it.colSpan > 1) rules.push(`  grid-column: span ${it.colSpan};`);
            if (it.rowSpan > 1) rules.push(`  grid-row: span ${it.rowSpan};`);
        }
        if (rules.length) lines.push("", `.item:nth-child(${i + 1}) {`, ...rules, "}");
    }
    return lines.join("\n");
});

function reset() {
    Object.assign(flex, flexDefaults);
    Object.assign(grid, gridDefaults);
    flexItems.forEach((it) => Object.assign(it, { grow: 0, shrink: 1, basis: "auto", self: "auto", order: 0 }));
    gridItems.forEach((it) => Object.assign(it, { colSpan: 1, rowSpan: 1 }));
    selected.value = null;
}
function setCount(n: number) {
    count.value = Math.min(12, Math.max(1, n));
    if (selected.value !== null && selected.value >= count.value) selected.value = null;
}
const sizes = [56, 80, 64, 96, 72, 60, 88, 68, 76, 58, 92, 66];
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="mode" :options="[{ value: 'flex', label: 'Flexbox' }, { value: 'grid', label: 'Grid' }]" />
        </template>

        <div class="grid gap-4 lg:grid-cols-[20rem_1fr]">
            <div class="flex min-w-0 flex-col gap-4">
                <Panel title="Container">
                    <template #actions><Btn size="sm" variant="ghost" @click="reset"><RotateCcw /> Reset</Btn></template>
                    <div v-if="mode === 'flex'" class="flex flex-col gap-3">
                        <Field label="flex-direction"><select v-model="flex.direction" class="select"><option v-for="o in flexOpts.direction" :key="o">{{ o }}</option></select></Field>
                        <Field label="flex-wrap"><select v-model="flex.wrap" class="select"><option v-for="o in flexOpts.wrap" :key="o">{{ o }}</option></select></Field>
                        <Field label="justify-content"><select v-model="flex.justify" class="select"><option v-for="o in flexOpts.justify" :key="o">{{ o }}</option></select></Field>
                        <Field label="align-items"><select v-model="flex.align" class="select"><option v-for="o in flexOpts.align" :key="o">{{ o }}</option></select></Field>
                        <Field label="align-content" hint="Only matters when items wrap onto several lines"><select v-model="flex.content" class="select"><option v-for="o in flexOpts.content" :key="o">{{ o }}</option></select></Field>
                        <Field :label="`gap: ${flex.gap}px`"><input v-model.number="flex.gap" type="range" min="0" max="48" class="range" /></Field>
                    </div>
                    <div v-else class="flex flex-col gap-3">
                        <Field label="grid-template-columns">
                            <input v-model="grid.columns" class="input font-mono" spellcheck="false" />
                            <div class="mt-1.5 flex flex-wrap gap-1"><button v-for="c in columnPresets" :key="c" type="button" class="chip cursor-pointer font-mono !text-[11px] hover:text-fg" @click="grid.columns = c">{{ c }}</button></div>
                        </Field>
                        <Field label="grid-template-rows"><input v-model="grid.rows" class="input font-mono" spellcheck="false" placeholder="auto" /></Field>
                        <Field label="justify-items"><select v-model="grid.justifyItems" class="select"><option v-for="o in ['stretch', 'start', 'center', 'end']" :key="o">{{ o }}</option></select></Field>
                        <Field label="align-items"><select v-model="grid.alignItems" class="select"><option v-for="o in ['stretch', 'start', 'center', 'end']" :key="o">{{ o }}</option></select></Field>
                        <Field label="grid-auto-flow"><select v-model="grid.flow" class="select"><option v-for="o in ['row', 'column', 'dense', 'row dense']" :key="o">{{ o }}</option></select></Field>
                        <Field :label="`gap: ${grid.gap}px`"><input v-model.number="grid.gap" type="range" min="0" max="48" class="range" /></Field>
                    </div>
                </Panel>

                <Panel :title="selected === null ? 'Item' : `Item ${selected + 1}`">
                    <p v-if="selected === null" class="text-sm text-muted">Click an item in the preview to change its own properties.</p>
                    <div v-else-if="mode === 'flex'" class="grid grid-cols-2 gap-3">
                        <Field label="flex-grow"><input v-model.number="flexItems[selected].grow" type="number" min="0" class="input" /></Field>
                        <Field label="flex-shrink"><input v-model.number="flexItems[selected].shrink" type="number" min="0" class="input" /></Field>
                        <Field label="flex-basis"><input v-model="flexItems[selected].basis" class="input font-mono" placeholder="auto" /></Field>
                        <Field label="order"><input v-model.number="flexItems[selected].order" type="number" class="input" /></Field>
                        <Field label="align-self" class="col-span-2"><select v-model="flexItems[selected].self" class="select"><option v-for="o in ['auto', ...flexOpts.align]" :key="o">{{ o }}</option></select></Field>
                    </div>
                    <div v-else class="grid grid-cols-2 gap-3">
                        <Field label="Column span"><input v-model.number="gridItems[selected].colSpan" type="number" min="1" max="12" class="input" /></Field>
                        <Field label="Row span"><input v-model.number="gridItems[selected].rowSpan" type="number" min="1" max="12" class="input" /></Field>
                    </div>
                </Panel>
            </div>

            <div class="flex min-w-0 flex-col gap-4">
                <Panel title="Preview">
                    <template #actions>
                        <Btn size="sm" variant="ghost" aria-label="Remove item" :disabled="count <= 1" @click="setCount(count - 1)"><Minus /></Btn>
                        <span class="w-14 text-center text-xs text-muted">{{ count }} items</span>
                        <Btn size="sm" variant="ghost" aria-label="Add item" :disabled="count >= 12" @click="setCount(count + 1)"><Plus /></Btn>
                    </template>
                    <div class="h-[24rem] resize overflow-auto rounded-lg border border-dashed border-line bg-subtle p-3" :style="containerStyle">
                        <button
                            v-for="i in count" :key="i" type="button" :style="[itemStyle(i - 1), mode === 'flex' ? { minWidth: '2.5rem', minHeight: flex.align === 'stretch' ? undefined : sizes[i - 1] * 0.6 + 'px', padding: `0 ${sizes[i - 1] / 4}px` } : { minHeight: '3.5rem' }]"
                            class="flex cursor-pointer items-center justify-center rounded-md font-mono text-sm font-semibold transition-colors"
                            :class="selected === i - 1 ? 'bg-accent text-accent-fg ring-2 ring-fg' : 'bg-accent/25 text-fg hover:bg-accent/40'"
                            :aria-pressed="selected === i - 1" @click="selected = selected === i - 1 ? null : i - 1"
                        >{{ i }}</button>
                    </div>
                    <p class="mt-2 text-xs text-muted">Drag the bottom-right corner of the dashed box to resize the container and see how the layout responds.</p>
                </Panel>

                <Panel title="CSS" flush>
                    <template #actions><CopyButton :text="css" /></template>
                    <pre class="max-h-72 overflow-auto p-4 font-mono text-[13px]">{{ css }}</pre>
                </Panel>
            </div>
        </div>
    </ToolPage>
</template>
