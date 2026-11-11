<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from "vue";
import { ClipboardPaste, Download, Sparkles } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { downloadBlob, readClipboard } from "@/composables/useClipboard";

type Tokenizer = typeof import("gpt-tokenizer/encoding/o200k_base");

const SAMPLE = `# Retrieval-augmented generation

Retrieval-augmented generation (RAG) gives a language model access to documents it was not trained on. Instead of relying on memory, the model receives the most relevant passages along with the question.

## Why chunking matters

Documents are split into chunks before they are embedded. If chunks are too large, each embedding mixes several topics and retrieval gets vague. If they are too small, a chunk loses the context needed to answer anything.

Overlap repeats the end of one chunk at the start of the next. It protects sentences that would otherwise be cut in half at a boundary, at the cost of storing some text twice.

## Picking a size

A common starting point is 200 to 500 tokens with 10 to 20 percent overlap. Measure retrieval quality on real questions, then adjust. Structured documents often work better when split on headings first.`;

const text = ref(SAMPLE);
const unit = ref<"tokens" | "chars" | "words">("tokens");
const sizeN = ref(120);
const overlapN = ref(20);
const strategy = ref<"recursive" | "fixed">("recursive");
const view = ref<"visual" | "json" | "jsonl">("visual");
const tokenizer = shallowRef<Tokenizer | null>(null);
const loadError = ref(false);
onMounted(async () => {
    try {
        tokenizer.value = await import("gpt-tokenizer/encoding/o200k_base");
    } catch {
        loadError.value = true;
    }
});

// Split into atoms (the smallest movable pieces) and measure each one in the chosen unit.
interface Atom { text: string; len: number }
function atomize(src: string): Atom[] {
    if (unit.value === "chars") return Array.from(src, (c) => ({ text: c, len: 1 }));
    if (unit.value === "words") return (src.match(/\S+\s*|\s+/g) ?? []).map((t) => ({ text: t, len: /\S/.test(t) ? 1 : 0 }));
    if (tokenizer.value) return tokenizer.value.encode(src).map((id) => ({ text: tokenizer.value!.decode([id]), len: 1 }));
    return (src.match(/[\s\S]{1,4}/g) ?? []).map((t) => ({ text: t, len: 1 })); // rough fallback: 4 characters per token
}

// Break priority for the recursive strategy: paragraph, line, sentence, then any atom.
function breakScore(a: Atom[], i: number): number {
    const prev = a[i - 1]?.text ?? "";
    const joined = (a[i - 2]?.text ?? "") + prev;
    if (/\n\s*\n\s*$/.test(joined)) return 3;
    if (/\n\s*$/.test(prev)) return 2;
    if (/[.!?]["')\]]?\s+$/.test(joined) || /[.!?]["')\]]?\s*$/.test(prev)) return 1;
    return 0;
}

interface Chunk { index: number; text: string; start: number; end: number; size: number; overlap: string; fresh: string }
const chunks = computed<Chunk[]>(() => {
    const src = text.value;
    if (!src.trim()) return [];
    const size = Math.max(1, Math.round(sizeN.value) || 1);
    const overlap = Math.min(size - 1, Math.max(0, Math.round(overlapN.value) || 0));
    const atoms = atomize(src);
    const offsets: number[] = [0];
    for (const a of atoms) offsets.push(offsets[offsets.length - 1] + a.text.length);
    const out: Chunk[] = [];
    let start = 0;
    let prevEnd = 0;
    while (start < atoms.length && out.length < 5000) {
        // take atoms until the size budget is used
        let end = start, used = 0;
        while (end < atoms.length && used + atoms[end].len <= size) used += atoms[end++].len;
        if (end === start) end = start + 1;
        if (strategy.value === "recursive" && end < atoms.length) {
            // back up to the best natural boundary in the last 40% of the chunk
            const floor = start + Math.max(1, Math.floor((end - start) * 0.6));
            let best = end, bestScore = 0;
            for (let i = end; i > floor; i--) {
                const s = breakScore(atoms, i);
                if (s > bestScore) { bestScore = s; best = i; if (s === 3) break; }
            }
            end = best;
        }
        const slice = atoms.slice(start, end);
        const ovEnd = Math.min(Math.max(prevEnd, start), end);
        out.push({
            index: out.length, start: offsets[start], end: offsets[end], size: slice.reduce((n, a) => n + a.len, 0),
            text: src.slice(offsets[start], offsets[end]), overlap: src.slice(offsets[start], offsets[ovEnd]), fresh: src.slice(offsets[ovEnd], offsets[end]),
        });
        if (end >= atoms.length) break;
        prevEnd = end;
        // step back by the overlap budget, but always make progress
        let back = end, o = 0;
        while (back > start + 1 && o + atoms[back - 1].len <= overlap) o += atoms[--back].len;
        start = overlap ? back : end;
    }
    return out;
});

const unitLabel = computed(() => (unit.value === "tokens" ? (tokenizer.value ? "tokens" : "tokens (estimated)") : unit.value === "chars" ? "characters" : "words"));
const stats = computed(() => {
    const c = chunks.value;
    if (!c.length) return null;
    const sizes = c.map((x) => x.size);
    const stored = c.reduce((n, x) => n + x.text.length, 0);
    return { count: c.length, avg: Math.round(sizes.reduce((a, b) => a + b, 0) / c.length), min: Math.min(...sizes), max: Math.max(...sizes), extra: Math.round((stored / text.value.length - 1) * 100) };
});

const records = computed(() => chunks.value.map((c) => ({ id: c.index, text: c.text, start: c.start, end: c.end, [unit.value]: c.size })));
const exported = computed(() => (view.value === "jsonl" ? records.value.map((r) => JSON.stringify(r)).join("\n") : JSON.stringify(records.value, null, 2)));

async function paste() {
    text.value = await readClipboard();
}
</script>

<template>
    <ToolPage>
        <Panel>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Measure in">
                    <select v-model="unit" class="select"><option value="tokens">Tokens (GPT-4o tokenizer)</option><option value="chars">Characters</option><option value="words">Words</option></select>
                </Field>
                <Field label="Chunk size"><input v-model.number="sizeN" type="number" min="1" class="input" /></Field>
                <Field label="Overlap" :hint="sizeN ? `${Math.round((Math.min(overlapN, sizeN - 1) / sizeN) * 100)}% of the chunk size` : ''"><input v-model.number="overlapN" type="number" min="0" :max="sizeN - 1" class="input" /></Field>
                <Field label="Split at">
                    <select v-model="strategy" class="select"><option value="recursive">Paragraphs and sentences where possible</option><option value="fixed">Exact size (may cut sentences)</option></select>
                </Field>
            </div>
        </Panel>

        <Notice v-if="loadError && unit === 'tokens'" type="warning">The tokenizer could not be loaded, so tokens are estimated at 4 characters each.</Notice>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Text" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="text = SAMPLE"><Sparkles /> Sample</Btn>
                    <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                </template>
                <CodeArea v-model="text" height="30rem" placeholder="Paste the document to split…" />
            </Panel>

            <Panel flush>
                <template #title>
                    {{ chunks.length }} chunk{{ chunks.length === 1 ? "" : "s" }}
                    <span v-if="stats" class="ml-2 text-xs font-normal text-muted">avg {{ stats.avg }} · min {{ stats.min }} · max {{ stats.max }} {{ unitLabel }}</span>
                </template>
                <template #actions>
                    <Tabs v-model="view" size="sm" :options="[{ value: 'visual', label: 'Visual' }, { value: 'json', label: 'JSON' }, { value: 'jsonl', label: 'JSONL' }]" />
                    <Btn v-if="view !== 'visual'" size="sm" variant="ghost" :disabled="!chunks.length" @click="downloadBlob(exported, view === 'jsonl' ? 'chunks.jsonl' : 'chunks.json', 'application/json')"><Download /></Btn>
                    <CopyButton :text="exported" />
                </template>
                <template v-if="view === 'visual'">
                    <p v-if="!chunks.length" class="p-4 text-sm text-muted">Enter some text to see how it is split.</p>
                    <ol v-else class="max-h-[30rem] divide-y divide-line overflow-auto">
                        <li v-for="c in chunks" :key="c.index" class="p-4">
                            <div class="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted">
                                <span><span class="font-semibold text-fg">#{{ c.index + 1 }}</span> · {{ c.size }} {{ unitLabel }} · characters {{ c.start }}–{{ c.end }}</span>
                                <CopyButton :text="c.text" icon-only />
                            </div>
                            <p class="font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap"><mark v-if="c.overlap" class="rounded-sm bg-warning/30 text-fg" title="Overlap: repeated from the previous chunk">{{ c.overlap }}</mark>{{ c.fresh }}</p>
                        </li>
                    </ol>
                    <div v-if="stats" class="border-t border-line px-4 py-2 text-xs text-muted">
                        <mark class="rounded-sm bg-warning/30 px-1 text-fg">Highlighted</mark> text is overlap repeated from the previous chunk. Overlap adds {{ Math.max(0, stats.extra) }}% to the stored text.
                    </div>
                </template>
                <CodeArea v-else :model-value="exported" readonly :wrap="view === 'jsonl' ? false : true" height="30rem" />
            </Panel>
        </div>
    </ToolPage>
</template>
