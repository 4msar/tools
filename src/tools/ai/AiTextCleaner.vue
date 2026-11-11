<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ClipboardPaste, FileText, Trash2 } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Panel, Tabs, ToolPage } from "@/components/ui";
import { readClipboard } from "@/composables/useClipboard";

interface Rule {
    id: string;
    label: string;
    hint?: string;
    group: "chars" | "citations" | "markdown" | "punct" | "space";
    on: boolean;
    apply: (text: string) => { out: string; n: number };
}

/** Replace with a counter so every rule can report how many changes it made. */
function sub(text: string, re: RegExp, to: string | ((...args: string[]) => string)) {
    let n = 0;
    const out = text.replace(re, (...args: unknown[]) => {
        n++;
        const m = args as string[];
        return typeof to === "function" ? to(...m) : to.replace(/\$(\d)/g, (_, d: string) => m[Number(d)] ?? "");
    });
    return { out, n };
}

function chain(text: string, steps: [RegExp, string | ((...args: string[]) => string)][]) {
    let n = 0;
    let out = text;
    for (const [re, to] of steps) {
        const r = sub(out, re, to);
        out = r.out;
        n += r.n;
    }
    return { out, n };
}

const dashStyle = ref<"-" | " - ">(" - ");

const rules: Rule[] = reactive([
    {
        id: "invisible", group: "chars", on: true, label: "Remove zero-width / invisible characters",
        apply: (t) => sub(t, /[​-‏⁠-⁤﻿­‪-‮⁦-⁩]/g, ""),
    },
    {
        id: "nbsp", group: "chars", on: true, label: "Non-breaking spaces to normal spaces",
        apply: (t) => sub(t, /[     ]/g, " "),
    },
    {
        id: "cite-brackets", group: "citations", on: true, label: "Remove [1], [2, 3] and 【4:0†source】 citations",
        apply: (t) => chain(t, [
            [/[ \t]?【[^】]*】/g, ""],
            [/[ \t]?[^]*/g, ""],
            [/[ \t]?\bturn\d+(?:search|view|news|image|file)\d+\b/g, ""],
            [/[ \t]?\[\d+(?:\s*[,–-]\s*\d+)*\]/g, ""],
        ]),
    },
    {
        id: "cite-source", group: "citations", on: true, label: "Remove (source) / (sources) markers",
        apply: (t) => sub(t, /[ \t]?\((?:sources?|citation needed)\)/gi, ""),
    },
    {
        id: "cite-caret", group: "citations", on: true, label: "Remove ^1 footnote markers", hint: "May also remove exponents like x^2.",
        apply: (t) => sub(t, /(?<=\S)\^\d+(?!\w)/g, ""),
    },
    {
        id: "md-code", group: "markdown", on: false, label: "Strip code fences and inline code",
        apply: (t) => chain(t, [
            [/^[ \t]*(```|~~~)[^\n]*\n?/gm, ""],
            [/`([^`\n]+)`/g, "$1"],
        ]),
    },
    {
        id: "md-headings", group: "markdown", on: false, label: "Strip heading markers (#)",
        apply: (t) => sub(t, /^[ \t]{0,3}#{1,6}[ \t]+/gm, ""),
    },
    {
        id: "md-emphasis", group: "markdown", on: false, label: "Strip bold, italic and strikethrough",
        apply: (t) => chain(t, [
            [/(\*\*|__)(?=\S)([\s\S]+?)(?<=\S)\1/g, "$2"],
            [/~~(?=\S)([^\n]+?)(?<=\S)~~/g, "$1"],
            [/(?<![*\w])\*(?![\s*])([^*\n]+?)(?<![\s*])\*(?![*\w])/g, "$1"],
            [/(?<![\w_])_(?![\s_])([^_\n]+?)(?<![\s_])_(?![\w_])/g, "$1"],
        ]),
    },
    {
        id: "md-links", group: "markdown", on: false, label: "Links and images to plain text",
        apply: (t) => chain(t, [
            [/!\[([^\]]*)\]\([^)]*\)/g, "$1"],
            [/\[([^\]]+)\]\([^)]*\)/g, "$1"],
        ]),
    },
    {
        id: "md-lists", group: "markdown", on: false, label: "Strip bullets and blockquote markers",
        apply: (t) => chain(t, [
            [/^([ \t]*)[-*+][ \t]+/gm, "$1"],
            [/^[ \t]*>[ \t]?/gm, ""],
        ]),
    },
    {
        id: "quotes", group: "punct", on: true, label: "Straighten smart quotes",
        apply: (t) => chain(t, [
            [/[‘’‚‛′]/g, "'"],
            [/[“”„‟″]/g, '"'],
        ]),
    },
    {
        id: "dashes", group: "punct", on: true, label: "Convert em / en dashes",
        apply: (t) => {
            const a = sub(t, /(?<=\d)\s*–\s*(?=\d)/g, "-");
            const b = dashStyle.value === " - " ? sub(a.out, /[ \t]*[—–―][ \t]*/g, " - ") : sub(a.out, /[—–―]/g, "-");
            return { out: b.out, n: a.n + b.n };
        },
    },
    {
        id: "ellipsis", group: "punct", on: true, label: "Ellipsis character to three dots",
        apply: (t) => sub(t, /…/g, "..."),
    },
    {
        id: "spaces", group: "space", on: true, label: "Collapse repeated spaces and trim line ends",
        apply: (t) => chain(t, [
            [/(\S)[ \t]{2,}/g, "$1 "],
            [/[ \t]+$/gm, ""],
        ]),
    },
    {
        id: "blank", group: "space", on: true, label: "Collapse extra blank lines",
        apply: (t) => sub(t, /\n{3,}/g, "\n\n"),
    },
]);

const groups: { id: Rule["group"]; title: string }[] = [
    { id: "chars", title: "Invisible characters" },
    { id: "citations", title: "Citations" },
    { id: "markdown", title: "Markdown" },
    { id: "punct", title: "Punctuation" },
    { id: "space", title: "Whitespace" },
];

const input = ref("");

const SAMPLE = `# Summary of findings

The study​ found that **remote work** improves focus [1][2]. Researchers note “results vary” — especially across roles… 【4:0†source】

- Output rose 12–18% (source)
- See [the report](https://example.com/report) for more^1

\`\`\`js
console.log("hello");
\`\`\`



That's it.`;

const result = computed(() => {
    let text = input.value;
    const counts: Record<string, number> = {};
    for (const r of rules) {
        if (!r.on) continue;
        const res = r.apply(text);
        text = res.out;
        counts[r.id] = res.n;
    }
    return { out: text, counts };
});

const totalChanges = computed(() => Object.values(result.value.counts).reduce((a, b) => a + b, 0));

async function paste() {
    input.value = await readClipboard();
}
</script>

<template>
    <ToolPage>
        <Panel title="Cleaning rules">
            <div class="grid gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
                <div v-for="g in groups" :key="g.id">
                    <div class="label">{{ g.title }}</div>
                    <div class="space-y-2 text-sm">
                        <template v-for="r in rules.filter((x) => x.group === g.id)" :key="r.id">
                            <label class="flex items-start gap-2" :title="r.hint">
                                <input v-model="r.on" type="checkbox" class="checkbox mt-0.5 shrink-0" />
                                <span class="min-w-0 flex-1">{{ r.label }}</span>
                                <span v-if="r.on && input" class="chip shrink-0" :class="result.counts[r.id] ? 'text-accent' : ''">{{ result.counts[r.id] ?? 0 }}</span>
                            </label>
                            <div v-if="r.id === 'dashes' && r.on" class="pl-6">
                                <Tabs v-model="dashStyle" size="sm" :options="[{ value: ' - ', label: 'Spaced ( - )' }, { value: '-', label: 'Plain (-)' }]" />
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </Panel>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="AI text" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                    <Btn size="sm" variant="ghost" @click="input = SAMPLE"><FileText /> Sample</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!input" @click="input = ''"><Trash2 /> Clear</Btn>
                </template>
                <CodeArea v-model="input" placeholder="Paste AI-generated text here…" />
                <div class="border-t border-line px-4 py-2 text-xs text-muted">{{ input.length }} characters</div>
            </Panel>

            <Panel title="Cleaned" flush>
                <template #actions><CopyButton :text="result.out" /></template>
                <CodeArea :model-value="result.out" readonly placeholder="Cleaned text appears here" />
                <div class="border-t border-line px-4 py-2 text-xs text-muted">{{ result.out.length }} characters · {{ totalChanges }} change{{ totalChanges === 1 ? "" : "s" }}</div>
            </Panel>
        </div>
    </ToolPage>
</template>
