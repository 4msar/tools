<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Download, Sparkles, Trash2 } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";

const SAMPLES: { name: string; text: string; values: Record<string, string> }[] = [
    {
        name: "Code review",
        text: "You are a senior {{language}} engineer reviewing a pull request.\n\nReview the code below for {{focus | correctness, readability and security}}.\nReply as a list of findings, most severe first. For each finding give the line, the problem and a fix.\n\n<code>\n{{code}}\n</code>",
        values: { language: "TypeScript", code: "function add(a, b) {\n  return a - b;\n}" },
    },
    {
        name: "Summarize",
        text: "Summarize the text below for {{audience | a busy executive}} in {{length | 3}} bullet points.\nKeep every number and name exactly as written.\n\n<text>\n{{text}}\n</text>",
        values: { text: "Paste the document here." },
    },
    {
        name: "Extract JSON",
        text: "Extract the following fields from the message and reply with JSON only, no prose:\n{{fields}}\n\nUse null for anything that is not stated.\n\n<message>\n{{message}}\n</message>",
        values: { fields: "- name (string)\n- email (string)\n- order_id (string)", message: "Hi, this is Dana (dana@example.com). Order A-1042 arrived damaged." },
    },
];

const template = ref(SAMPLES[0].text);
const values = reactive<Record<string, string>>({ ...SAMPLES[0].values });
const syntax = ref<"double" | "single" | "dollar">("double");
const exportAs = ref<"text" | "js" | "python" | "json">("text");

const PATTERNS = {
    double: /\{\{\s*([A-Za-z_][\w.-]*)\s*(?:\|\s*([^}]*?))?\s*\}\}/g,
    single: /\{([A-Za-z_][\w.-]*)(?:\|([^}]*?))?\}/g,
    dollar: /\$\{\s*([A-Za-z_][\w.-]*)\s*(?:\|\s*([^}]*?))?\s*\}/g,
};
const wrap = (n: string) => (syntax.value === "double" ? `{{${n}}}` : syntax.value === "single" ? `{${n}}` : `\${${n}}`);

// Variables in order of first appearance, with an optional "| default" taken from the template.
const vars = computed(() => {
    const seen = new Map<string, { name: string; fallback: string; count: number }>();
    for (const m of template.value.matchAll(PATTERNS[syntax.value])) {
        const v = seen.get(m[1]);
        if (v) {
            v.count++;
            v.fallback ||= (m[2] ?? "").trim();
        } else seen.set(m[1], { name: m[1], fallback: (m[2] ?? "").trim(), count: 1 });
    }
    return [...seen.values()];
});
watch(vars, (list) => {
    for (const v of list) if (!(v.name in values)) values[v.name] = "";
}, { immediate: true });

const missing = computed(() => vars.value.filter((v) => !values[v.name] && !v.fallback).map((v) => v.name));
const output = computed(() => template.value.replace(PATTERNS[syntax.value], (whole, name: string, fallback?: string) => values[name] || (fallback ?? "").trim() || whole));

// Rendered preview with filled values highlighted.
const segments = computed(() => {
    const out: { text: string; kind: "plain" | "filled" | "empty" }[] = [];
    let last = 0;
    for (const m of template.value.matchAll(PATTERNS[syntax.value])) {
        if (m.index > last) out.push({ text: template.value.slice(last, m.index), kind: "plain" });
        const v = values[m[1]] || (m[2] ?? "").trim();
        out.push(v ? { text: v, kind: "filled" } : { text: m[0], kind: "empty" });
        last = m.index + m[0].length;
    }
    if (last < template.value.length) out.push({ text: template.value.slice(last), kind: "plain" });
    return out;
});

const stats = computed(() => {
    const t = output.value;
    return `${t.length.toLocaleString()} characters · about ${Math.ceil(t.length / 4).toLocaleString()} tokens`;
});

const exported = computed(() => {
    const names = vars.value.map((v) => v.name);
    const plain = template.value.replace(PATTERNS[syntax.value], (_w, n: string) => `\u0000${n}\u0000`);
    switch (exportAs.value) {
        case "js": {
            const body = plain.replace(/[`\\]|\$\{/g, (c) => "\\" + c).replace(/\u0000([\w.-]+)\u0000/g, (_m, n: string) => `\${${/^[A-Za-z_$][\w$]*$/.test(n) ? n : `vars[${JSON.stringify(n)}]`}}`);
            const ok = names.every((n) => /^[A-Za-z_$][\w$]*$/.test(n));
            return `export function buildPrompt(${ok ? `{ ${names.join(", ")} }` : "vars"}) {\n  return \`${body}\`;\n}`;
        }
        case "python": {
            const body = plain.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"').replace(/[{}]/g, (c) => c + c).replace(/\u0000([\w.-]+)\u0000/g, (_m, n: string) => `{${n.replace(/[.-]/g, "_")}}`);
            return `def build_prompt(${names.map((n) => `${n.replace(/[.-]/g, "_")}: str`).join(", ")}) -> str:\n    return f"""${body}"""`;
        }
        case "json":
            return JSON.stringify({ template: template.value, variables: Object.fromEntries(vars.value.map((v) => [v.name, values[v.name] || v.fallback])) }, null, 2);
        default:
            return output.value;
    }
});

function load(s: (typeof SAMPLES)[number]) {
    for (const k of Object.keys(values)) delete values[k];
    Object.assign(values, s.values);
    syntax.value = "double";
    template.value = s.text;
}
function clearValues() {
    for (const k of Object.keys(values)) values[k] = "";
}
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="syntax" :options="[{ value: 'double', label: '{{name}}' }, { value: 'single', label: '{name}' }, { value: 'dollar', label: '${name}' }]" />
        </template>

        <div class="grid gap-4 lg:grid-cols-2">
            <div class="flex min-w-0 flex-col gap-4">
                <Panel title="Template" flush>
                    <template #actions>
                        <Btn v-for="s in SAMPLES" :key="s.name" size="sm" variant="ghost" @click="load(s)"><Sparkles /> {{ s.name }}</Btn>
                    </template>
                    <CodeArea v-model="template" height="17rem" :placeholder="`Write a prompt with ${wrap('variables')}…`" />
                    <div class="border-t border-line px-4 py-2 text-xs text-muted">Add a default with a pipe: <code class="code">{{ wrap("tone | friendly") }}</code></div>
                </Panel>

                <Panel :title="`Variables (${vars.length})`">
                    <template #actions><Btn size="sm" variant="ghost" :disabled="!vars.length" @click="clearValues"><Trash2 /> Clear values</Btn></template>
                    <p v-if="!vars.length" class="text-sm text-muted">No variables yet. Add one such as <code class="code">{{ wrap("topic") }}</code> to the template.</p>
                    <div v-else class="flex flex-col gap-3">
                        <Field v-for="v in vars" :key="v.name" :label="v.name + (v.count > 1 ? ` (used ${v.count} times)` : '')">
                            <textarea v-model="values[v.name]" class="input min-h-[38px] font-mono text-[13px]" :rows="Math.min(8, Math.max(1, (values[v.name] ?? '').split('\n').length))" spellcheck="false" :placeholder="v.fallback ? `Default: ${v.fallback}` : 'Value'" />
                        </Field>
                    </div>
                </Panel>
            </div>

            <div class="flex min-w-0 flex-col gap-4">
                <Notice v-if="missing.length" type="warning">Not filled in yet: {{ missing.join(", ") }}</Notice>
                <Panel title="Prompt" flush>
                    <template #actions><CopyButton :text="output" /></template>
                    <div class="max-h-[26rem] min-h-40 overflow-auto p-4 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap"><template v-for="(s, i) in segments" :key="i"><span v-if="s.kind === 'plain'">{{ s.text }}</span><mark v-else class="rounded-sm px-0.5 text-fg" :class="s.kind === 'filled' ? 'bg-accent/25' : 'bg-warning/30'">{{ s.text }}</mark></template></div>
                    <div class="border-t border-line px-4 py-2 text-xs text-muted">{{ stats }}</div>
                </Panel>

                <Panel title="Export" flush>
                    <template #actions>
                        <Tabs v-model="exportAs" size="sm" :options="[{ value: 'text', label: 'Text' }, { value: 'js', label: 'JavaScript' }, { value: 'python', label: 'Python' }, { value: 'json', label: 'JSON' }]" />
                        <Btn size="sm" variant="ghost" @click="downloadBlob(exported, { text: 'prompt.txt', js: 'prompt.js', python: 'prompt.py', json: 'prompt.json' }[exportAs])"><Download /> Download</Btn>
                        <CopyButton :text="exported" />
                    </template>
                    <pre class="max-h-64 overflow-auto p-4 font-mono text-xs break-words whitespace-pre-wrap">{{ exported }}</pre>
                </Panel>
            </div>
        </div>
    </ToolPage>
</template>
