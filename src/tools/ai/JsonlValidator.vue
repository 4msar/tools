<script setup lang="ts">
import { computed, ref } from "vue";
import { ClipboardPaste, Download, Sparkles, Trash2, Upload } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { downloadBlob, readClipboard } from "@/composables/useClipboard";

type Schema = "generic" | "chat" | "batch";
const schema = ref<Schema>("chat");
const filter = ref<"all" | "problems">("problems");

const SAMPLES: Record<Schema, string> = {
    generic: '{"id": 1, "text": "first record", "label": "a"}\n{"id": 2, "text": "second record", "label": "b"}\n{"id": 3, "text": "missing label"}\n{"id": 4, "text": "trailing comma",}\n',
    chat:
        '{"messages": [{"role": "system", "content": "You are a support agent."}, {"role": "user", "content": "Where is my order?"}, {"role": "assistant", "content": "Let me check that for you."}]}\n' +
        '{"messages": [{"role": "user", "content": "Cancel my plan"}, {"role": "assistant", "content": "Done. Your plan ends on the 30th."}]}\n' +
        '{"messages": [{"role": "user", "content": "Hi"}, {"role": "bot", "content": "Hello!"}]}\n' +
        '{"messages": [{"role": "user", "content": "No reply here"}]}\n' +
        '{"prompt": "old format", "completion": "not supported for chat models"}\n',
    batch:
        '{"custom_id": "req-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "Hello"}]}}\n' +
        '{"custom_id": "req-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "Bye"}]}}\n' +
        '{"custom_id": "req-2", "method": "GET", "url": "/v1/chat/completions", "body": {"messages": []}}\n',
};
const input = ref(SAMPLES.chat);

interface Issue { level: "error" | "warning"; text: string }
interface Line { n: number; raw: string; issues: Issue[]; value?: unknown }

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const ROLES = ["system", "developer", "user", "assistant", "tool", "function"];

function checkChat(v: unknown, issues: Issue[]) {
    const err = (text: string) => issues.push({ level: "error", text });
    const warn = (text: string) => issues.push({ level: "warning", text });
    if (!isObj(v)) return err("Each line must be a JSON object.");
    if (!Array.isArray(v.messages)) return err(isObj(v) && "prompt" in v ? 'Uses the old prompt/completion format. Chat models need a "messages" array.' : 'Missing a "messages" array.');
    if (!v.messages.length) return err('"messages" is empty.');
    v.messages.forEach((m, i) => {
        const at = `messages[${i}]`;
        if (!isObj(m)) return err(`${at} is not an object.`);
        if (typeof m.role !== "string") return err(`${at} has no "role".`);
        if (!ROLES.includes(m.role)) err(`${at} has unknown role "${m.role}".`);
        const hasCalls = Array.isArray(m.tool_calls) || isObj(m.function_call);
        if (m.content === undefined && !hasCalls) err(`${at} has no "content".`);
        else if (m.content !== null && m.content !== undefined && typeof m.content !== "string" && !Array.isArray(m.content)) err(`${at}.content must be a string or an array of parts.`);
        else if (typeof m.content === "string" && !m.content.trim() && !hasCalls) warn(`${at}.content is empty.`);
        if (m.role === "system" && i > 0) warn(`${at}: a system message is normally first.`);
    });
    const roles = v.messages.filter(isObj).map((m) => m.role);
    if (!roles.includes("user")) warn("No user message.");
    if (!roles.includes("assistant")) err("No assistant message: there is nothing for the model to learn.");
    else if (roles[roles.length - 1] !== "assistant") warn("The last message should be from the assistant.");
}

function checkBatch(v: unknown, issues: Issue[], ids: Map<string, number>, n: number) {
    const err = (text: string) => issues.push({ level: "error", text });
    if (!isObj(v)) return err("Each line must be a JSON object.");
    if (typeof v.custom_id !== "string" || !v.custom_id) err('Missing a string "custom_id".');
    else if (ids.has(v.custom_id)) err(`custom_id "${v.custom_id}" was already used on line ${ids.get(v.custom_id)}.`);
    else ids.set(v.custom_id, n);
    if (v.method !== "POST") err('"method" must be "POST".');
    if (typeof v.url !== "string" || !v.url.startsWith("/v1/")) err('"url" must be an endpoint path such as "/v1/chat/completions".');
    if (!isObj(v.body)) err('Missing a "body" object.');
    else if (typeof v.body.model !== "string") err('"body.model" is missing.');
}

const result = computed(() => {
    const lines: Line[] = [];
    const ids = new Map<string, number>();
    const keySets = new Map<string, number>();
    let empty = 0;
    input.value.split(/\r?\n/).forEach((raw, i) => {
        if (!raw.trim()) {
            if (i < input.value.split(/\r?\n/).length - 1 || raw) empty++;
            return;
        }
        const line: Line = { n: i + 1, raw, issues: [] };
        try {
            line.value = JSON.parse(raw);
        } catch (e) {
            line.issues.push({ level: "error", text: "Invalid JSON: " + (e as Error).message });
            lines.push(line);
            return;
        }
        if (schema.value === "chat") checkChat(line.value, line.issues);
        else if (schema.value === "batch") checkBatch(line.value, line.issues, ids, line.n);
        else if (isObj(line.value)) {
            const sig = Object.keys(line.value).sort().join(", ");
            keySets.set(sig, (keySets.get(sig) ?? 0) + 1);
        } else line.issues.push({ level: "warning", text: "This line is valid JSON but not an object." });
        lines.push(line);
    });
    // generic: flag lines whose keys differ from the most common shape
    if (schema.value === "generic" && keySets.size > 1) {
        const common = [...keySets.entries()].sort((a, b) => b[1] - a[1])[0][0];
        const want = new Set(common.split(", "));
        for (const l of lines) {
            if (!isObj(l.value)) continue;
            const have = new Set(Object.keys(l.value));
            const missing = [...want].filter((k) => !have.has(k));
            const extra = [...have].filter((k) => !want.has(k));
            if (missing.length) l.issues.push({ level: "warning", text: `Missing key${missing.length > 1 ? "s" : ""} found on most lines: ${missing.join(", ")}` });
            if (extra.length) l.issues.push({ level: "warning", text: `Extra key${extra.length > 1 ? "s" : ""} not on most lines: ${extra.join(", ")}` });
        }
    }
    const errors = lines.filter((l) => l.issues.some((x) => x.level === "error")).length;
    const warnings = lines.filter((l) => !l.issues.some((x) => x.level === "error") && l.issues.length).length;
    return { lines, errors, warnings, valid: lines.length - errors, empty };
});

const shown = computed(() => (filter.value === "all" ? result.value.lines : result.value.lines.filter((l) => l.issues.length)).slice(0, 500));
const cleaned = computed(() => result.value.lines.filter((l) => !l.issues.some((x) => x.level === "error")).map((l) => JSON.stringify(l.value)).join("\n") + (result.value.valid ? "\n" : ""));
const chars = computed(() => result.value.lines.reduce((n, l) => n + l.raw.length, 0));

function setSchema(s: Schema) {
    if (Object.values(SAMPLES).includes(input.value)) input.value = SAMPLES[s];
    schema.value = s;
}
async function paste() {
    input.value = await readClipboard();
}
async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) input.value = await f.text();
    (e.target as HTMLInputElement).value = "";
}
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs :model-value="schema" :options="[{ value: 'chat', label: 'Chat fine-tuning' }, { value: 'batch', label: 'Batch requests' }, { value: 'generic', label: 'Any JSONL' }]" @update:model-value="setSchema" />
        </template>

        <Notice v-if="!result.lines.length" type="info">Paste JSONL (one JSON object per line) or open a file.</Notice>
        <Notice v-else-if="!result.errors && !result.warnings" type="success">All {{ result.lines.length }} lines are valid.</Notice>
        <Notice v-else :type="result.errors ? 'error' : 'warning'">
            {{ result.valid }} of {{ result.lines.length }} lines are usable<template v-if="result.errors"> · {{ result.errors }} with errors</template><template v-if="result.warnings"> · {{ result.warnings }} with warnings</template>.
        </Notice>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="JSONL" flush>
                <template #actions>
                    <label class="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted hover:bg-subtle hover:text-fg">
                        <Upload class="size-3.5" /> Open<input type="file" class="hidden" accept=".jsonl,.ndjson,.json,.txt" @change="onFile" />
                    </label>
                    <Btn size="sm" variant="ghost" @click="input = SAMPLES[schema]"><Sparkles /> Sample</Btn>
                    <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!input" @click="input = ''"><Trash2 /> Clear</Btn>
                </template>
                <CodeArea v-model="input" :wrap="false" height="26rem" :invalid="result.errors > 0" placeholder='{"messages": [...]}&#10;{"messages": [...]}' />
                <div class="flex flex-wrap gap-x-4 border-t border-line px-4 py-2 text-xs text-muted">
                    <span>{{ result.lines.length }} records</span><span v-if="result.empty">{{ result.empty }} blank lines</span><span>{{ chars.toLocaleString() }} characters</span><span>about {{ Math.ceil(chars / 4).toLocaleString() }} tokens</span>
                </div>
            </Panel>

            <Panel title="Lines" flush>
                <template #actions>
                    <Tabs v-model="filter" size="sm" :options="[{ value: 'problems', label: 'Problems' }, { value: 'all', label: 'All' }]" />
                    <Btn size="sm" variant="ghost" :disabled="!result.valid" title="Download only the lines without errors" @click="downloadBlob(cleaned, 'cleaned.jsonl', 'application/x-ndjson')"><Download /> Valid lines</Btn>
                    <CopyButton :text="cleaned" label="Copy valid" />
                </template>
                <p v-if="!shown.length" class="p-4 text-sm text-muted">{{ result.lines.length ? "No problems found." : "Nothing to check yet." }}</p>
                <ol v-else class="max-h-[28.5rem] divide-y divide-line overflow-auto">
                    <li v-for="l in shown" :key="l.n" class="px-4 py-2.5">
                        <div class="flex items-baseline gap-2">
                            <span class="w-14 shrink-0 font-mono text-xs" :class="l.issues.some((x) => x.level === 'error') ? 'text-danger' : l.issues.length ? 'text-warning' : 'text-success'">Line {{ l.n }}</span>
                            <code class="min-w-0 flex-1 truncate font-mono text-xs text-muted" :title="l.raw">{{ l.raw }}</code>
                        </div>
                        <ul v-if="l.issues.length" class="mt-1 ml-16 space-y-0.5 text-sm">
                            <li v-for="(x, i) in l.issues" :key="i" :class="x.level === 'error' ? 'text-danger' : 'text-warning'">{{ x.text }}</li>
                        </ul>
                    </li>
                </ol>
                <div v-if="result.lines.length > 500" class="border-t border-line px-4 py-2 text-xs text-muted">Showing the first 500 lines.</div>
            </Panel>
        </div>
        <p class="text-xs text-muted">
            <template v-if="schema === 'chat'">Checks the OpenAI-style chat fine-tuning format: one object per line with a <code class="code">messages</code> array of role and content pairs.</template>
            <template v-else-if="schema === 'batch'">Checks the OpenAI Batch API input format: <code class="code">custom_id</code>, <code class="code">method</code>, <code class="code">url</code> and <code class="code">body</code> on every line, with unique IDs.</template>
            <template v-else>Checks that every line is valid JSON and flags lines whose keys differ from the rest.</template>
            Format rules change; check your provider's documentation before uploading.
        </p>
    </ToolPage>
</template>
