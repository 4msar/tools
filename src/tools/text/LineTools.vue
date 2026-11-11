<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowDownToLine, ClipboardPaste, Shuffle, Sparkles, Trash2 } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { readClipboard } from "@/composables/useClipboard";

type Tab = "transform" | "compare";
const tab = ref<Tab>("transform");

const SAMPLE = `banana
Apple
cherry
apple

banana
  Date
item10
item2
elderberry`;

const input = ref(SAMPLE);

// toggles / options
const opSplit = ref(false);
const splitSep = ref(",");
const opTrim = ref(false);
const opRemoveEmpty = ref(false);
const opDedupe = ref(false);
const dedupeCI = ref(false);
const opFilter = ref(false);
const filterText = ref("");
const filterMode = ref<"contains" | "not">("contains");
const filterRegex = ref(false);
const filterCase = ref(false);
const sortMode = ref<"none" | "az" | "za" | "natural" | "len-asc" | "len-desc">("none");
const sortCI = ref(true);
const opReverse = ref(false);
const opShuffle = ref(false);
const shuffleSeed = ref(0);
const opPrefix = ref(false);
const prefix = ref("");
const suffix = ref("");
const opNumber = ref(false);
const numStart = ref(1);
const numSep = ref(". ");
const opJoin = ref(false);
const joinSep = ref(", ");

const unesc = (s: string) => s.replace(/\\(n|t|r|\\)/g, (_, c: string) => ({ n: "\n", t: "\t", r: "\r", "\\": "\\" })[c] ?? c);
const toLines = (s: string) => (s === "" ? [] : s.split(/\r\n|\r|\n/));

const pipeline = computed(() => {
    let lines: string[] = opSplit.value ? input.value.split(unesc(splitSep.value) || "\n") : toLines(input.value);
    if (opSplit.value && input.value === "") lines = [];
    let error = "";
    if (opTrim.value) lines = lines.map((l) => l.trim());
    if (opRemoveEmpty.value) lines = lines.filter((l) => l.trim() !== "");
    if (opDedupe.value) {
        const seen = new Set<string>();
        lines = lines.filter((l) => {
            const k = dedupeCI.value ? l.toLowerCase() : l;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }
    if (opFilter.value && filterText.value) {
        let test: (l: string) => boolean;
        if (filterRegex.value) {
            try {
                const re = new RegExp(filterText.value, filterCase.value ? "" : "i");
                test = (l) => re.test(l);
            } catch (e) {
                error = "Invalid regular expression: " + (e instanceof Error ? e.message : "");
                test = () => true;
            }
        } else {
            const needle = filterCase.value ? filterText.value : filterText.value.toLowerCase();
            test = (l) => (filterCase.value ? l : l.toLowerCase()).includes(needle);
        }
        lines = lines.filter((l) => (filterMode.value === "contains" ? test(l) : !test(l)));
    }
    if (sortMode.value !== "none") {
        const coll = new Intl.Collator(undefined, { sensitivity: sortCI.value ? "base" : "variant", numeric: sortMode.value === "natural" });
        const cmp: Record<string, (a: string, b: string) => number> = {
            az: (a, b) => coll.compare(a, b),
            za: (a, b) => coll.compare(b, a),
            natural: (a, b) => coll.compare(a, b),
            "len-asc": (a, b) => a.length - b.length || coll.compare(a, b),
            "len-desc": (a, b) => b.length - a.length || coll.compare(a, b),
        };
        lines = lines.slice().sort(cmp[sortMode.value]);
    }
    if (opReverse.value) lines = lines.slice().reverse();
    if (opShuffle.value) {
        void shuffleSeed.value;
        lines = lines.slice();
        for (let i = lines.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [lines[i], lines[j]] = [lines[j], lines[i]];
        }
    }
    if (opPrefix.value) lines = lines.map((l) => prefix.value + l + suffix.value);
    if (opNumber.value) {
        const start = Number.isFinite(numStart.value) ? numStart.value : 1;
        lines = lines.map((l, i) => `${start + i}${numSep.value}${l}`);
    }
    const out = opJoin.value ? lines.join(unesc(joinSep.value)) : lines.join("\n");
    return { lines, out, error };
});

const inCount = computed(() => toLines(input.value).length);
const outCount = computed(() => (opJoin.value ? (pipeline.value.lines.length ? 1 : 0) : pipeline.value.lines.length));
const removed = computed(() => Math.max(0, inCount.value - pipeline.value.lines.length));

function applyToInput() {
    input.value = pipeline.value.out;
    opSplit.value = false;
}

async function paste() {
    input.value = await readClipboard();
}

function resetOps() {
    opSplit.value = opTrim.value = opRemoveEmpty.value = opDedupe.value = opFilter.value = opReverse.value = opShuffle.value = opPrefix.value = opNumber.value = opJoin.value = false;
    sortMode.value = "none";
}

// ---------- compare ----------
const listA = ref("apple\nbanana\ncherry\ndate");
const listB = ref("banana\ncherry\nelderberry\nfig");
const cmpTrim = ref(true);
const cmpCase = ref(false);

const compare = computed(() => {
    const norm = (l: string) => {
        const t = cmpTrim.value ? l.trim() : l;
        return cmpCase.value ? t.toLowerCase() : t;
    };
    const a = toLines(listA.value).filter((l) => norm(l) !== "");
    const b = toLines(listB.value).filter((l) => norm(l) !== "");
    const setA = new Set(a.map(norm));
    const setB = new Set(b.map(norm));
    const uniq = (arr: string[]) => {
        const seen = new Set<string>();
        return arr.filter((l) => {
            const k = norm(l);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    };
    const show = (l: string) => (cmpTrim.value ? l.trim() : l);
    return {
        onlyA: uniq(a).filter((l) => !setB.has(norm(l))).map(show),
        onlyB: uniq(b).filter((l) => !setA.has(norm(l))).map(show),
        both: uniq(a).filter((l) => setB.has(norm(l))).map(show),
        countA: setA.size,
        countB: setB.size,
    };
});

function sampleCompare() {
    listA.value = "apple\nbanana\ncherry\ndate";
    listB.value = "banana\ncherry\nelderberry\nfig";
}

const toggles = computed(() => [opSplit.value, opTrim.value, opRemoveEmpty.value, opDedupe.value, opFilter.value, sortMode.value !== "none", opReverse.value, opShuffle.value, opPrefix.value, opNumber.value, opJoin.value].filter(Boolean).length);
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="tab" :options="[{ value: 'transform', label: 'Transform' }, { value: 'compare', label: 'Compare lists' }]" />
        </template>

        <template v-if="tab === 'transform'">
            <Panel title="Operations" flush>
                <template #actions>
                    <span class="px-1 text-xs text-muted">{{ toggles }} active · applied top to bottom</span>
                    <Btn size="sm" variant="ghost" :disabled="!toggles" @click="resetOps">Reset</Btn>
                </template>
                <div class="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
                    <!-- split -->
                    <div class="space-y-1.5">
                        <label class="flex items-center gap-2 font-medium"><input v-model="opSplit" type="checkbox" class="checkbox" /> Split by separator</label>
                        <input v-model="splitSep" class="input !h-8 font-mono" :disabled="!opSplit" placeholder="e.g. , or \t" spellcheck="false" />
                    </div>
                    <!-- trim / empty / dedupe -->
                    <div class="space-y-1.5">
                        <label class="flex items-center gap-2"><input v-model="opTrim" type="checkbox" class="checkbox" /> Trim whitespace</label>
                        <label class="flex items-center gap-2"><input v-model="opRemoveEmpty" type="checkbox" class="checkbox" /> Remove empty lines</label>
                        <div class="flex items-center gap-3">
                            <label class="flex items-center gap-2"><input v-model="opDedupe" type="checkbox" class="checkbox" /> Remove duplicates</label>
                            <label class="flex items-center gap-1.5 text-xs text-muted"><input v-model="dedupeCI" type="checkbox" class="checkbox" :disabled="!opDedupe" /> case-insensitive</label>
                        </div>
                    </div>
                    <!-- filter -->
                    <div class="space-y-1.5">
                        <label class="flex items-center gap-2 font-medium"><input v-model="opFilter" type="checkbox" class="checkbox" /> Filter lines</label>
                        <div class="flex gap-1.5">
                            <select v-model="filterMode" class="select !h-8 !w-auto" :disabled="!opFilter">
                                <option value="contains">containing</option>
                                <option value="not">not containing</option>
                            </select>
                            <input v-model="filterText" class="input !h-8 min-w-0 font-mono" :disabled="!opFilter" spellcheck="false" placeholder="text or regex" />
                        </div>
                        <div class="flex gap-4 text-xs text-muted">
                            <label class="flex items-center gap-1.5"><input v-model="filterRegex" type="checkbox" class="checkbox" :disabled="!opFilter" /> Regex</label>
                            <label class="flex items-center gap-1.5"><input v-model="filterCase" type="checkbox" class="checkbox" :disabled="!opFilter" /> Match case</label>
                        </div>
                    </div>
                    <!-- sort -->
                    <div class="space-y-1.5">
                        <div class="font-medium">Sort</div>
                        <select v-model="sortMode" class="select !h-8">
                            <option value="none">Don't sort</option>
                            <option value="az">A → Z</option>
                            <option value="za">Z → A</option>
                            <option value="natural">Natural (item2 before item10)</option>
                            <option value="len-asc">By length, shortest first</option>
                            <option value="len-desc">By length, longest first</option>
                        </select>
                        <label class="flex items-center gap-1.5 text-xs text-muted"><input v-model="sortCI" type="checkbox" class="checkbox" :disabled="sortMode === 'none'" /> Ignore case</label>
                    </div>
                    <!-- reverse / shuffle -->
                    <div class="space-y-1.5">
                        <label class="flex items-center gap-2"><input v-model="opReverse" type="checkbox" class="checkbox" /> Reverse order</label>
                        <div class="flex items-center gap-2">
                            <label class="flex items-center gap-2"><input v-model="opShuffle" type="checkbox" class="checkbox" /> Shuffle</label>
                            <Btn size="sm" variant="secondary" :disabled="!opShuffle" @click="shuffleSeed++"><Shuffle /> Reshuffle</Btn>
                        </div>
                    </div>
                    <!-- prefix / suffix -->
                    <div class="space-y-1.5">
                        <label class="flex items-center gap-2 font-medium"><input v-model="opPrefix" type="checkbox" class="checkbox" /> Add prefix / suffix</label>
                        <div class="flex gap-1.5">
                            <input v-model="prefix" class="input !h-8 min-w-0 font-mono" :disabled="!opPrefix" placeholder="prefix" spellcheck="false" />
                            <input v-model="suffix" class="input !h-8 min-w-0 font-mono" :disabled="!opPrefix" placeholder="suffix" spellcheck="false" />
                        </div>
                    </div>
                    <!-- number -->
                    <div class="space-y-1.5">
                        <label class="flex items-center gap-2 font-medium"><input v-model="opNumber" type="checkbox" class="checkbox" /> Number lines</label>
                        <div class="flex gap-1.5">
                            <input v-model.number="numStart" type="number" class="input !h-8 !w-20" :disabled="!opNumber" title="Start at" />
                            <input v-model="numSep" class="input !h-8 min-w-0 font-mono" :disabled="!opNumber" placeholder="separator" spellcheck="false" />
                        </div>
                    </div>
                    <!-- join -->
                    <div class="space-y-1.5">
                        <label class="flex items-center gap-2 font-medium"><input v-model="opJoin" type="checkbox" class="checkbox" /> Join with separator</label>
                        <input v-model="joinSep" class="input !h-8 font-mono" :disabled="!opJoin" placeholder="e.g. , or \n" spellcheck="false" />
                    </div>
                </div>
            </Panel>

            <Notice v-if="pipeline.error" type="error">{{ pipeline.error }}</Notice>

            <div class="grid gap-4 lg:grid-cols-2">
                <Panel title="Input" flush>
                    <template #actions>
                        <Btn size="sm" variant="ghost" @click="input = SAMPLE"><Sparkles /> Sample</Btn>
                        <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                        <Btn size="sm" variant="ghost" :disabled="!input" @click="input = ''"><Trash2 /> Clear</Btn>
                    </template>
                    <CodeArea v-model="input" :wrap="false" height="20rem" placeholder="One item per line…" />
                    <div class="border-t border-line px-4 py-2 text-xs text-muted">{{ inCount }} line{{ inCount === 1 ? "" : "s" }}</div>
                </Panel>
                <Panel title="Output" flush>
                    <template #actions>
                        <Btn size="sm" variant="ghost" :disabled="!pipeline.out" title="Replace the input with this output" @click="applyToInput"><ArrowDownToLine /> Use as input</Btn>
                        <CopyButton :text="pipeline.out" />
                    </template>
                    <CodeArea :model-value="pipeline.out" readonly :wrap="false" height="20rem" placeholder="Result appears here" />
                    <div class="border-t border-line px-4 py-2 text-xs text-muted">
                        {{ outCount }} line{{ outCount === 1 ? "" : "s" }}<span v-if="removed"> · {{ removed }} removed</span>
                    </div>
                </Panel>
            </div>
        </template>

        <template v-else>
            <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <label class="flex items-center gap-2"><input v-model="cmpTrim" type="checkbox" class="checkbox" /> Trim whitespace</label>
                <label class="flex items-center gap-2"><input v-model="cmpCase" type="checkbox" class="checkbox" /> Ignore case</label>
                <Btn class="ml-auto" size="sm" variant="secondary" @click="sampleCompare"><Sparkles /> Sample</Btn>
            </div>
            <div class="grid gap-4 lg:grid-cols-2">
                <Panel title="List A" flush>
                    <CodeArea v-model="listA" :wrap="false" height="12rem" placeholder="One item per line…" />
                    <div class="border-t border-line px-4 py-2 text-xs text-muted">{{ compare.countA }} unique</div>
                </Panel>
                <Panel title="List B" flush>
                    <CodeArea v-model="listB" :wrap="false" height="12rem" placeholder="One item per line…" />
                    <div class="border-t border-line px-4 py-2 text-xs text-muted">{{ compare.countB }} unique</div>
                </Panel>
            </div>
            <div class="grid gap-4 lg:grid-cols-3">
                <Panel flush>
                    <template #title>Only in A <span class="chip ml-1 !text-danger">{{ compare.onlyA.length }}</span></template>
                    <template #actions><CopyButton :text="compare.onlyA.join('\n')" /></template>
                    <CodeArea :model-value="compare.onlyA.join('\n')" readonly :wrap="false" height="10rem" />
                </Panel>
                <Panel flush>
                    <template #title>In both <span class="chip ml-1">{{ compare.both.length }}</span></template>
                    <template #actions><CopyButton :text="compare.both.join('\n')" /></template>
                    <CodeArea :model-value="compare.both.join('\n')" readonly :wrap="false" height="10rem" />
                </Panel>
                <Panel flush>
                    <template #title>Only in B <span class="chip ml-1 !text-success">{{ compare.onlyB.length }}</span></template>
                    <template #actions><CopyButton :text="compare.onlyB.join('\n')" /></template>
                    <CodeArea :model-value="compare.onlyB.join('\n')" readonly :wrap="false" height="10rem" />
                </Panel>
            </div>
        </template>
    </ToolPage>
</template>
