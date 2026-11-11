<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowLeftRight, ClipboardPaste, Download, Sparkles, Trash2 } from "lucide-vue-next";
import Papa from "papaparse";
import { Btn, CodeArea, CopyButton, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { downloadBlob, readClipboard } from "@/composables/useClipboard";

type Dir = "csv2json" | "json2csv";
const dir = ref<Dir>("csv2json");
const input = ref("");
const delimiter = ref("auto");
const header = ref(true);
const dynamicTyping = ref(true);
const flatten = ref(true);
const indent = ref(2);

const SAMPLE_CSV = "id,name,email,active\n1,Ada Lovelace,ada@example.com,true\n2,Alan Turing,alan@example.com,true\n3,\"Hopper, Grace\",grace@example.com,false\n";
const SAMPLE_JSON = JSON.stringify([
    { id: 1, name: "Ada", address: { city: "London", zip: "N1" }, tags: ["math", "code"] },
    { id: 2, name: "Alan", address: { city: "Wilmslow", zip: "SK9" }, tags: [] },
], null, 2);

const delimiterValue = computed(() => ({ auto: "", comma: ",", semicolon: ";", tab: "\t", pipe: "|" })[delimiter.value] ?? "");

function flattenObj(v: unknown, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
    if (v !== null && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length) {
        for (const [k, val] of Object.entries(v)) flattenObj(val, prefix ? `${prefix}.${k}` : k, out);
    } else {
        out[prefix] = v;
    }
    return out;
}

interface Result { out: string; rows?: unknown[][]; cols?: string[]; total?: number; error?: string; note?: string }

const result = computed<Result>(() => {
    const text = input.value;
    if (!text.trim()) return { out: "" };
    if (dir.value === "csv2json") {
        const parsed = Papa.parse<unknown>(text, {
            header: header.value,
            dynamicTyping: dynamicTyping.value,
            skipEmptyLines: "greedy",
            delimiter: delimiterValue.value || undefined,
        });
        const fatal = parsed.errors.find((e) => e.type === "Quotes") ?? null;
        const data = parsed.data;
        const out = JSON.stringify(data, null, indent.value || undefined);
        let cols: string[];
        let rows: unknown[][];
        if (header.value) {
            cols = parsed.meta.fields ?? [];
            rows = (data as Record<string, unknown>[]).slice(0, 100).map((r) => cols.map((c) => r[c]));
        } else {
            const arr = data as unknown[][];
            cols = Array.from({ length: Math.max(0, ...arr.map((r) => r.length)) }, (_, i) => String(i + 1));
            rows = arr.slice(0, 100);
        }
        return {
            out, cols, rows, total: data.length,
            error: fatal ? `Row ${(fatal.row ?? 0) + 1}: ${fatal.message}` : undefined,
            note: `Detected delimiter: ${JSON.stringify(parsed.meta.delimiter)}`,
        };
    }
    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch (e) {
        return { out: "", error: (e as Error).message };
    }
    const arr = Array.isArray(json) ? json : [json];
    if (!arr.length) return { out: "" };
    try {
        const records = arr.map((r) => {
            const o = flatten.value ? flattenObj(r) : r;
            if (o === null || typeof o !== "object") return { value: o };
            if (Array.isArray(o)) return Object.fromEntries(o.map((x, i) => [i, x]));
            return Object.fromEntries(Object.entries(o as object).map(([k, v]) => [k, v !== null && typeof v === "object" ? JSON.stringify(v) : v]));
        });
        const out = Papa.unparse(records as object[], { delimiter: delimiterValue.value || ",", header: header.value, newline: "\n" });
        return { out };
    } catch (e) {
        return { out: "", error: (e as Error).message };
    }
});

function swap() {
    if (!result.value.out || (result.value.error && dir.value === "json2csv")) return;
    input.value = result.value.out;
    dir.value = dir.value === "csv2json" ? "json2csv" : "csv2json";
}

function download() {
    const csv = dir.value === "json2csv";
    downloadBlob(result.value.out, csv ? "data.csv" : "data.json", csv ? "text/csv" : "application/json");
}

function setDir(d: Dir) {
    dir.value = d;
}
async function paste() { input.value = await readClipboard(); }
function sample() { input.value = dir.value === "csv2json" ? SAMPLE_CSV : SAMPLE_JSON; }
async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) input.value = await f.text();
    (e.target as HTMLInputElement).value = "";
}
const cell = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs :model-value="dir" :options="[{ value: 'csv2json', label: 'CSV → JSON' }, { value: 'json2csv', label: 'JSON → CSV' }]" @update:model-value="setDir" />
        </template>

        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <label class="flex items-center gap-2">
                <span class="text-muted">Delimiter</span>
                <select v-model="delimiter" class="select !w-auto">
                    <option value="auto" :disabled="dir === 'json2csv'">Auto</option>
                    <option value="comma">Comma</option>
                    <option value="semicolon">Semicolon</option>
                    <option value="tab">Tab</option>
                    <option value="pipe">Pipe</option>
                </select>
            </label>
            <label class="flex items-center gap-2"><input v-model="header" type="checkbox" class="checkbox" /> Header row</label>
            <label v-if="dir === 'csv2json'" class="flex items-center gap-2"><input v-model="dynamicTyping" type="checkbox" class="checkbox" /> Dynamic typing</label>
            <label v-else class="flex items-center gap-2"><input v-model="flatten" type="checkbox" class="checkbox" /> Flatten nested keys (a.b)</label>
            <label v-if="dir === 'csv2json'" class="flex items-center gap-2">
                <span class="text-muted">Indent</span>
                <select v-model.number="indent" class="select !w-auto"><option :value="0">Minified</option><option :value="2">2 spaces</option><option :value="4">4 spaces</option></select>
            </label>
            <label class="ml-auto inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium shadow-xs hover:bg-subtle">
                Open file
                <input type="file" class="hidden" accept=".csv,.tsv,.txt,.json" @change="onFile" />
            </label>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel :title="dir === 'csv2json' ? 'CSV' : 'JSON'" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="sample"><Sparkles /> Sample</Btn>
                    <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!input" @click="input = ''"><Trash2 /> Clear</Btn>
                </template>
                <CodeArea v-model="input" :wrap="false" height="20rem" :placeholder="dir === 'csv2json' ? 'Paste CSV here…' : 'Paste a JSON array of objects…'" />
            </Panel>

            <Panel :title="dir === 'csv2json' ? 'JSON' : 'CSV'" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" :disabled="!result.out" title="Use output as input and switch direction" @click="swap"><ArrowLeftRight /> Swap</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!result.out" @click="download"><Download /> Download</Btn>
                    <CopyButton :text="result.out" />
                </template>
                <div v-if="result.error" class="p-4"><Notice type="error">{{ result.error }}</Notice></div>
                <CodeArea :model-value="result.out" readonly :wrap="false" height="20rem" placeholder="Output appears here" />
                <div v-if="result.note" class="border-t border-line px-4 py-2 text-xs text-muted">{{ result.total }} rows · {{ result.note }}</div>
            </Panel>
        </div>

        <Panel v-if="dir === 'csv2json' && result.rows?.length" :title="`Table preview (first ${result.rows.length} of ${result.total} rows)`" flush>
            <div class="max-h-96 overflow-auto">
                <table class="w-full border-collapse text-left text-sm">
                    <thead class="sticky top-0 bg-subtle">
                        <tr>
                            <th v-for="c in result.cols" :key="c" class="border-b border-line px-3 py-2 font-semibold whitespace-nowrap">{{ c }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(r, i) in result.rows" :key="i" class="border-b border-line last:border-0">
                            <td v-for="(_, j) in result.cols" :key="j" class="px-3 py-1.5 font-mono text-xs whitespace-nowrap">{{ cell(r[j]) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </Panel>
    </ToolPage>
</template>
