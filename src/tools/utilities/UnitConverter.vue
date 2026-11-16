<script setup lang="ts">
import { useHandoff } from "@/composables/handoff";
import { cats, fmt, fromC, toC } from "./units";
import { computed, nextTick, ref, watch } from "vue";
import { Btn, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

const catId = ref("length");
const cat = computed(() => cats.find((c) => c.id === catId.value)!);
const from = ref("m");
const raw = ref("1");

watch(catId, () => {
    from.value = cat.value.units[0].id;
});

const value = computed(() => (raw.value.trim() === "" ? NaN : Number(raw.value)));

const results = computed(() => {
    const v = value.value;
    if (!Number.isFinite(v)) return [];
    const c = cat.value;
    const src = c.units.find((x) => x.id === from.value) ?? c.units[0];
    const base = c.temp ? toC(v, src.id) : v * src.f;
    return c.units.map((x) => {
        const out = c.temp ? fromC(base, x.id) : base / x.f;
        return { ...x, text: fmt(out), isFrom: x.id === src.id };
    });
});

// Input sent from the chat assistant.
useHandoff<{ category?: string; from?: string; value?: string }>("unit-converter", (p) => {
    if (p.category) catId.value = p.category;
    // catId's watcher resets `from` on the next flush, so set it after.
    void nextTick(() => {
        if (p.from) from.value = p.from;
        if (p.value != null) raw.value = p.value;
    });
});
</script>

<template>
    <ToolPage>
        <Tabs v-model="catId" :options="cats.map((c) => ({ value: c.id, label: c.label }))" size="sm" />

        <Panel title="Convert">
            <div class="grid gap-3 sm:grid-cols-[1fr_1fr]">
                <Field label="Value"><input v-model="raw" class="input font-mono" inputmode="decimal" spellcheck="false" placeholder="1" /></Field>
                <Field label="From">
                    <select v-model="from" class="select">
                        <option v-for="x in cat.units" :key="x.id" :value="x.id">{{ x.name }} ({{ x.id }})</option>
                    </select>
                </Field>
            </div>
            <div class="mt-3 flex flex-wrap gap-1.5">
                <Btn v-for="n in ['1', '10', '100', '1000']" :key="n" size="sm" variant="ghost" @click="raw = n">{{ n }}</Btn>
            </div>
        </Panel>

        <Notice v-if="raw.trim() && !Number.isFinite(value)" type="error">Enter a valid number.</Notice>
        <Panel v-else title="Results" flush>
            <ul class="divide-y divide-line">
                <li
                    v-for="r in results"
                    :key="r.id"
                    class="flex items-center gap-3 px-4 py-2 hover:bg-subtle"
                    :class="r.isFrom ? 'bg-accent/10' : ''"
                >
                    <button type="button" class="min-w-0 flex-1 cursor-pointer text-left" :title="`Convert from ${r.name}`" @click="from = r.id; raw = r.text">
                        <span class="block font-mono text-sm break-all tabular-nums">{{ r.text }} <span class="text-muted">{{ r.id }}</span></span>
                        <span class="block text-xs text-muted">{{ r.name }}</span>
                    </button>
                    <CopyButton :text="r.text" icon-only />
                </li>
            </ul>
        </Panel>
        <p v-if="catId === 'data'" class="text-xs text-muted">SI units (kB, MB) are powers of 1000. IEC units (KiB, MiB) are powers of 1024.</p>
    </ToolPage>
</template>
