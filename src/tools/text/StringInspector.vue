<script setup lang="ts">
import { computed, ref } from "vue";
import { Check, ClipboardPaste, Eraser, Sparkles, Trash2 } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, ToolPage } from "@/components/ui";
import { readClipboard } from "@/composables/useClipboard";

const SAMPLE = "Hello world​! This has a zero​width space, a non‑breaking hyphen and a BOM:﻿\n\nCafé vs Café look identical — but ‮are not‬.\r\nEmoji: 👨‍👩‍👧 🇩🇪 ❤️. Done?\tYes!";

const text = ref("");
const showWs = ref(false);

const seg = (g: "grapheme" | "word" | "sentence") => {
    const S = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string; isWordLike?: boolean }> } }).Segmenter;
    return S ? new S(undefined, { granularity: g }) : null;
};

const stats = computed(() => {
    const t = text.value;
    const enc = new TextEncoder();
    const gs = seg("grapheme");
    const ws = seg("word");
    const ss = seg("sentence");
    const chars = Array.from(t);
    const graphemes = gs ? Array.from(gs.segment(t)).length : chars.length;
    const words = ws ? Array.from(ws.segment(t)).filter((x) => x.isWordLike).length : (t.match(/\S+/g) ?? []).length;
    const sentences = ss ? Array.from(ss.segment(t)).filter((x) => x.segment.trim()).length : (t.match(/[^.!?]+[.!?]*/g) ?? []).filter((x) => x.trim()).length;
    const lines = t ? t.split(/\r\n|\r|\n/).length : 0;
    const paragraphs = t.split(/(?:\r?\n){2,}/).filter((p) => p.trim()).length;
    const readMin = words / 238;
    const fmtTime = (m: number) => {
        const s = Math.round(m * 60);
        return s < 60 ? `${s} sec` : `${Math.floor(s / 60)} min ${s % 60} sec`;
    };
    return [
        ["Characters (UTF-16 units)", t.length],
        ["Code points", chars.length],
        ["Graphemes", graphemes],
        ["Words", words],
        ["Lines", lines],
        ["Sentences", sentences],
        ["Paragraphs", paragraphs],
        ["UTF-8 bytes", enc.encode(t).length],
        ["UTF-16 bytes", t.length * 2],
        ["Reading time", t.trim() ? fmtTime(readMin) : "0 sec"],
        ["Speaking time", t.trim() ? fmtTime(words / 150) : "0 sec"],
        ["Non-whitespace chars", t.replace(/\s/g, "").length],
    ] as [string, string | number][];
});

// ---------- hidden characters ----------
interface Info { name: string; cat: string }
const NAMES: Record<number, Info> = {
    0x00a0: { name: "No-break space", cat: "Space" }, 0x00ad: { name: "Soft hyphen", cat: "Invisible" }, 0x034f: { name: "Combining grapheme joiner", cat: "Invisible" },
    0x061c: { name: "Arabic letter mark", cat: "Bidi" }, 0x115f: { name: "Hangul choseong filler", cat: "Invisible" }, 0x1680: { name: "Ogham space mark", cat: "Space" },
    0x180e: { name: "Mongolian vowel separator", cat: "Invisible" }, 0x200b: { name: "Zero width space", cat: "Zero-width" }, 0x200c: { name: "Zero width non-joiner", cat: "Zero-width" },
    0x200d: { name: "Zero width joiner", cat: "Zero-width" }, 0x200e: { name: "Left-to-right mark", cat: "Bidi" }, 0x200f: { name: "Right-to-left mark", cat: "Bidi" },
    0x2028: { name: "Line separator", cat: "Separator" }, 0x2029: { name: "Paragraph separator", cat: "Separator" }, 0x202a: { name: "Left-to-right embedding", cat: "Bidi" },
    0x202b: { name: "Right-to-left embedding", cat: "Bidi" }, 0x202c: { name: "Pop directional formatting", cat: "Bidi" }, 0x202d: { name: "Left-to-right override", cat: "Bidi" },
    0x202e: { name: "Right-to-left override", cat: "Bidi" }, 0x202f: { name: "Narrow no-break space", cat: "Space" }, 0x205f: { name: "Medium mathematical space", cat: "Space" },
    0x2060: { name: "Word joiner", cat: "Zero-width" }, 0x2061: { name: "Function application", cat: "Invisible" }, 0x2062: { name: "Invisible times", cat: "Invisible" },
    0x2063: { name: "Invisible separator", cat: "Invisible" }, 0x2064: { name: "Invisible plus", cat: "Invisible" }, 0x2066: { name: "Left-to-right isolate", cat: "Bidi" },
    0x2067: { name: "Right-to-left isolate", cat: "Bidi" }, 0x2068: { name: "First strong isolate", cat: "Bidi" }, 0x2069: { name: "Pop directional isolate", cat: "Bidi" },
    0x3000: { name: "Ideographic space", cat: "Space" }, 0x3164: { name: "Hangul filler", cat: "Invisible" }, 0xfeff: { name: "BOM / zero width no-break space", cat: "BOM" },
    0xfffd: { name: "Replacement character", cat: "Invalid" }, 0xfffc: { name: "Object replacement character", cat: "Invalid" },
};
const C0 = ["NUL", "SOH", "STX", "ETX", "EOT", "ENQ", "ACK", "BEL", "BS", "TAB", "LF", "VT", "FF", "CR", "SO", "SI", "DLE", "DC1", "DC2", "DC3", "DC4", "NAK", "SYN", "ETB", "CAN", "EM", "SUB", "ESC", "FS", "GS", "RS", "US"];

function describe(cp: number): Info | null {
    if (NAMES[cp]) return NAMES[cp];
    if (cp >= 0x2000 && cp <= 0x200a) return { name: "Typographic space", cat: "Space" };
    if (cp < 0x20) return { name: `Control: ${C0[cp]}`, cat: "Control" };
    if (cp === 0x7f) return { name: "Control: DEL", cat: "Control" };
    if (cp >= 0x80 && cp <= 0x9f) return { name: "C1 control", cat: "Control" };
    if (cp >= 0xe0000 && cp <= 0xe007f) return { name: "Tag character", cat: "Invisible" };
    if (cp >= 0xe0100 && cp <= 0xe01ef) return { name: "Variation selector supplement", cat: "Invisible" };
    if (cp >= 0xfe00 && cp <= 0xfe0f) return { name: cp === 0xfe0f ? "Variation selector-16 (emoji)" : cp === 0xfe0e ? "Variation selector-15 (text)" : "Variation selector", cat: "Variation" };
    return null;
}

interface Hit { index: number; cp: number; line: number; col: number; info: Info; label: string }

const hits = computed<Hit[]>(() => {
    const out: Hit[] = [];
    let line = 1, col = 1, idx = 0;
    const t = text.value;
    for (const ch of t) {
        const cp = ch.codePointAt(0) ?? 0;
        const isPlainWs = cp === 0x0a || cp === 0x09 || cp === 0x0d;
        const info = isPlainWs ? null : describe(cp);
        if (info) out.push({ index: idx, cp, line, col, info, label: label(cp) });
        if (cp === 0x0a) {
            line++;
            col = 1;
        } else col++;
        idx++;
    }
    return out;
});

function label(cp: number) {
    if (cp < 0x20) return C0[cp];
    return "U+" + cp.toString(16).toUpperCase().padStart(4, "0");
}
const hex = (cp: number) => "U+" + cp.toString(16).toUpperCase().padStart(4, "0");

const grouped = computed(() => {
    const m = new Map<number, number>();
    for (const h of hits.value) m.set(h.cp, (m.get(h.cp) ?? 0) + 1);
    return Array.from(m, ([cp, n]) => ({ cp, n, info: describe(cp) as Info })).sort((a, b) => b.n - a.n);
});

const preview = computed(() => {
    const out: { t: string; hidden?: string; title?: string }[] = [];
    let buf = "";
    let count = 0;
    for (const ch of text.value) {
        if (++count > 20000) break;
        const cp = ch.codePointAt(0) ?? 0;
        const info = cp === 0x0a || cp === 0x09 || cp === 0x0d ? null : describe(cp);
        if (info) {
            if (buf) out.push({ t: buf });
            buf = "";
            out.push({ t: "", hidden: label(cp), title: `${hex(cp)} ${info.name}` });
        } else buf += showWs.value ? ch.replace(/ /g, "·").replace(/\t/g, "→") : ch;
    }
    if (buf) out.push({ t: buf });
    return out;
});

function removeHidden() {
    let out = "";
    for (const ch of text.value) {
        const cp = ch.codePointAt(0) ?? 0;
        if (cp === 0x0a || cp === 0x09 || cp === 0x0d || !describe(cp)) out += ch;
        else if (cp === 0xa0 || (cp >= 0x2000 && cp <= 0x200a) || cp === 0x202f || cp === 0x205f || cp === 0x3000 || cp === 0x1680) out += " ";
    }
    text.value = out;
}

// ---------- normalization ----------
const FORMS = ["NFC", "NFD", "NFKC", "NFKD"] as const;
const normRows = computed(() =>
    FORMS.map((f) => {
        const n = text.value.normalize(f);
        return { form: f, same: n === text.value, len: Array.from(n).length, bytes: new TextEncoder().encode(n).length, value: n };
    }),
);
const NORM_HELP: Record<string, string> = {
    NFC: "Composed. Precomposed characters (é as one code point). Web standard.",
    NFD: "Decomposed. Base letter plus combining marks (e + ́).",
    NFKC: "Composed + compatibility mapping (ﬁ → fi, ① → 1, full-width → ASCII).",
    NFKD: "Decomposed + compatibility mapping.",
};

async function paste() {
    text.value = await readClipboard();
}
</script>

<template>
    <ToolPage>
        <Panel title="Text" flush>
            <template #actions>
                <Btn size="sm" variant="ghost" @click="text = SAMPLE"><Sparkles /> Sample</Btn>
                <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                <Btn size="sm" variant="ghost" :disabled="!text" @click="text = ''"><Trash2 /> Clear</Btn>
            </template>
            <CodeArea v-model="text" height="12rem" placeholder="Type or paste text to inspect…" />
        </Panel>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <div v-for="[label, value] in stats" :key="label" class="rounded-xl border border-line bg-surface p-3">
                <div class="text-xs text-muted">{{ label }}</div>
                <div class="text-lg font-semibold tabular-nums">{{ typeof value === "number" ? value.toLocaleString() : value }}</div>
            </div>
        </div>

        <Panel flush>
            <template #title>
                Hidden and special characters
                <span class="chip ml-1">{{ hits.length }}</span>
            </template>
            <template #actions>
                <Btn size="sm" variant="ghost" :disabled="!hits.length" @click="removeHidden"><Eraser /> Remove all</Btn>
            </template>
            <div v-if="!text" class="p-6 text-center text-sm text-muted">Nothing to inspect yet.</div>
            <div v-else-if="!hits.length" class="p-4"><Notice type="success">No zero-width, non-breaking, bidi or control characters found.</Notice></div>
            <template v-else>
                <div class="flex flex-wrap gap-1.5 border-b border-line p-4">
                    <span v-for="g in grouped" :key="g.cp" class="chip" :title="g.info.cat">{{ hex(g.cp) }} {{ g.info.name }} × {{ g.n }}</span>
                </div>
                <div class="border-b border-line p-4">
                    <div class="mb-2 flex items-center justify-between gap-2 text-xs text-muted">
                        <span>Visualized (hidden characters shown as tags)</span>
                        <label class="flex items-center gap-1.5"><input v-model="showWs" type="checkbox" class="checkbox" /> Show spaces/tabs</label>
                    </div>
                    <div class="max-h-48 overflow-auto rounded-lg bg-subtle p-3 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap">
                        <template v-for="(p, i) in preview" :key="i"><span v-if="p.hidden" class="mx-0.5 rounded bg-warning/20 px-1 text-[11px] text-warning" :title="p.title">{{ p.hidden }}</span><template v-else>{{ p.t }}</template></template>
                    </div>
                </div>
                <div class="max-h-72 overflow-auto">
                    <table class="w-full text-left text-sm">
                        <thead class="sticky top-0 bg-surface text-xs text-muted">
                            <tr><th class="px-4 py-2 font-medium">#</th><th class="px-2 py-2 font-medium">Position</th><th class="px-2 py-2 font-medium">Code point</th><th class="px-2 py-2 font-medium">Name</th><th class="px-4 py-2 font-medium">Type</th></tr>
                        </thead>
                        <tbody class="divide-y divide-line">
                            <tr v-for="(h, i) in hits.slice(0, 500)" :key="i">
                                <td class="px-4 py-1.5 text-muted tabular-nums">{{ i + 1 }}</td>
                                <td class="px-2 py-1.5 font-mono text-xs whitespace-nowrap">char {{ h.index + 1 }} · {{ h.line }}:{{ h.col }}</td>
                                <td class="px-2 py-1.5 font-mono text-xs">{{ hex(h.cp) }}</td>
                                <td class="px-2 py-1.5">{{ h.info.name }}</td>
                                <td class="px-4 py-1.5"><span class="chip">{{ h.info.cat }}</span></td>
                            </tr>
                        </tbody>
                    </table>
                    <p v-if="hits.length > 500" class="px-4 py-2 text-xs text-muted">Showing the first 500 of {{ hits.length }}.</p>
                </div>
            </template>
        </Panel>

        <Panel title="Unicode normalization" flush>
            <div v-if="!text" class="p-6 text-center text-sm text-muted">Nothing to inspect yet.</div>
            <div v-else class="divide-y divide-line">
                <div v-for="r in normRows" :key="r.form" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <div class="w-16 font-mono text-sm font-semibold">{{ r.form }}</div>
                    <span class="chip" :class="r.same ? '!text-success' : '!text-warning'">
                        <Check v-if="r.same" class="size-3" /> {{ r.same ? "Already normalized" : "Differs from input" }}
                    </span>
                    <span class="text-xs text-muted">{{ r.len }} code points · {{ r.bytes }} bytes</span>
                    <span class="hidden min-w-0 flex-1 text-xs text-muted md:block">{{ NORM_HELP[r.form] }}</span>
                    <div class="ml-auto flex gap-1">
                        <Btn size="sm" variant="secondary" :disabled="r.same" @click="text = r.value">Convert</Btn>
                        <CopyButton :text="r.value" />
                    </div>
                </div>
            </div>
        </Panel>
    </ToolPage>
</template>
