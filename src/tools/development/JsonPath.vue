<script setup lang="ts">
import { computed, ref } from "vue";
import { ClipboardPaste, Sparkles } from "lucide-vue-next";
import { JSONPath } from "jsonpath-plus";
import { Btn, CodeArea, CopyButton, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { readClipboard } from "@/composables/useClipboard";

const SAMPLE = JSON.stringify(
    {
        store: {
            book: [
                { category: "reference", author: "Nigel Rees", title: "Sayings of the Century", price: 8.95 },
                { category: "fiction", author: "Evelyn Waugh", title: "Sword of Honour", price: 12.99 },
                { category: "fiction", author: "Herman Melville", title: "Moby Dick", isbn: "0-553-21311-3", price: 8.99 },
                { category: "fiction", author: "J. R. R. Tolkien", title: "The Lord of the Rings", isbn: "0-395-19395-8", price: 22.99 },
            ],
            bicycle: { color: "red", price: 19.95 },
        },
    },
    null,
    2,
);

const input = ref(SAMPLE);
const path = ref("$.store.book[?(@.price < 10)].title");
const view = ref<"values" | "paths">("values");

const examples = [
    { p: "$.store.book[*].author", d: "All authors" },
    { p: "$..price", d: "Every price, at any depth" },
    { p: "$.store.book[0,1]", d: "First two books" },
    { p: "$.store.book[-1:]", d: "Last book" },
    { p: "$.store.book[?(@.isbn)]", d: "Books that have an ISBN" },
    { p: "$.store.book[?(@.price < 10)].title", d: "Titles cheaper than 10" },
    { p: "$..book[?(@.category === 'fiction')]", d: "Fiction books" },
    { p: "$.store.*", d: "Everything in the store" },
];

const parsed = computed<{ value?: unknown; error?: string }>(() => {
    if (!input.value.trim()) return {};
    try {
        return { value: JSON.parse(input.value) };
    } catch (e) {
        return { error: (e as Error).message };
    }
});

interface Hit { path: string; pointer: string; value: unknown }

const result = computed<{ hits: Hit[]; error?: string }>(() => {
    if (parsed.value.value === undefined || !path.value.trim()) return { hits: [] };
    try {
        // eval "safe" uses the library's own expression interpreter instead of JavaScript eval.
        const res = JSONPath({ path: path.value.trim(), json: parsed.value.value as object, resultType: "all", eval: "safe", wrap: true }) as Hit[];
        return { hits: res.map((r) => ({ path: r.path, pointer: r.pointer, value: r.value })) };
    } catch (e) {
        return { hits: [], error: (e as Error).message };
    }
});

const output = computed(() => {
    const h = result.value.hits;
    if (!h.length) return "";
    return view.value === "values" ? JSON.stringify(h.map((x) => x.value), null, 2) : h.map((x) => x.path).join("\n");
});

async function paste() {
    input.value = await readClipboard();
}
</script>

<template>
    <ToolPage>
        <Panel title="JSONPath expression">
            <input v-model="path" class="input font-mono text-base" spellcheck="false" placeholder="$.store.book[*].author" aria-label="JSONPath expression" />
            <div class="mt-3 flex flex-wrap gap-1.5">
                <button v-for="e in examples" :key="e.p" type="button" class="chip cursor-pointer hover:border-line-strong hover:text-fg" :title="e.p" @click="path = e.p">{{ e.d }}</button>
            </div>
            <Notice v-if="result.error" type="error" class="mt-3">{{ result.error }}</Notice>
        </Panel>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="JSON" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="input = SAMPLE"><Sparkles /> Sample</Btn>
                    <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                </template>
                <CodeArea v-model="input" :wrap="false" height="26rem" :invalid="!!parsed.error" placeholder="Paste JSON here…" />
                <div v-if="parsed.error" class="border-t border-line px-4 py-2 text-xs text-danger">{{ parsed.error }}</div>
            </Panel>

            <Panel :title="`${result.hits.length} match${result.hits.length === 1 ? '' : 'es'}`" flush>
                <template #actions>
                    <Tabs v-model="view" size="sm" :options="[{ value: 'values', label: 'Values' }, { value: 'paths', label: 'Paths' }]" />
                    <CopyButton :text="output" />
                </template>
                <CodeArea :model-value="output" readonly :wrap="false" height="26rem" placeholder="Matches appear here" />
            </Panel>
        </div>

        <Panel title="Syntax" flush>
            <div class="grid gap-x-6 text-sm sm:grid-cols-2">
                <div v-for="r in [
                    ['$', 'Root object'], ['@', 'Current item (inside filters)'], ['.key or [\'key\']', 'Child property'], ['..key', 'Recursive descent'],
                    ['*', 'All children'], ['[0,1]', 'Listed indexes'], ['[start:end:step]', 'Array slice'], ['[?(@.price < 10)]', 'Filter expression'],
                ]" :key="r[0]" class="flex items-baseline gap-3 border-b border-line px-4 py-2 last:border-0">
                    <code class="code shrink-0">{{ r[0] }}</code><span class="text-muted">{{ r[1] }}</span>
                </div>
            </div>
        </Panel>
    </ToolPage>
</template>
