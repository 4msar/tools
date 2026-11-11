<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowLeftRight, ClipboardPaste, Sparkles, Trash2 } from "lucide-vue-next";
import { dump, loadAll } from "js-yaml";
import JSON5 from "json5";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { Btn, CodeArea, CopyButton, Notice, Panel, ToolPage } from "@/components/ui";
import { readClipboard } from "@/composables/useClipboard";

type Fmt = "json" | "json5" | "yaml" | "toml" | "env";
const fmts: { value: Fmt; label: string }[] = [
    { value: "json", label: "JSON" },
    { value: "json5", label: "JSON5" },
    { value: "yaml", label: "YAML" },
    { value: "toml", label: "TOML" },
    { value: "env", label: ".env" },
];

const from = ref<Fmt>("json");
const to = ref<Fmt>("yaml");
const input = ref("");
const indent = ref(2);
const multiDoc = ref(false);

const SAMPLES: Record<Fmt, string> = {
    json: JSON.stringify({ app: { name: "demo", port: 8080, debug: true }, database: { host: "localhost", pool: { min: 2, max: 10 } }, tags: ["web", "api"] }, null, 2),
    json5: "// JSON5 allows comments, unquoted keys and trailing commas\n{\n  app: { name: 'demo', port: 8080, debug: true },\n  tags: ['web', 'api',],\n}\n",
    yaml: "app:\n  name: demo\n  port: 8080\n  debug: true\ndatabase:\n  host: localhost\n  pool:\n    min: 2\n    max: 10\ntags:\n  - web\n  - api\n",
    toml: 'tags = ["web", "api"]\n\n[app]\nname = "demo"\nport = 8080\ndebug = true\n\n[database]\nhost = "localhost"\n\n[database.pool]\nmin = 2\nmax = 10\n',
    env: '# Application\nAPP_NAME=demo\nAPP_PORT=8080\nAPP_DEBUG=true\nDATABASE_HOST="localhost"\nexport SECRET_KEY=\'s3cr3t value\'\n',
};

function parseEnv(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("#")) continue;
        const m = line.match(/^(?:export\s+)?([A-Za-z_][\w.-]*)\s*=\s*(.*)$/);
        if (!m) throw new Error(`Line ${i + 1}: expected KEY=VALUE`);
        let v = m[2];
        const q = v[0];
        if (q === '"' || q === "'") {
            let end = v.indexOf(q, 1);
            // multi-line quoted values
            while (end < 0 && i + 1 < lines.length) { v += "\n" + lines[++i]; end = v.indexOf(q, 1); }
            if (end < 0) throw new Error(`Line ${i + 1}: unterminated quote`);
            v = v.slice(1, end);
            if (q === '"') v = v.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        } else {
            v = v.replace(/\s+#.*$/, "").trim();
        }
        out[m[1]] = v;
    }
    return out;
}

function flattenEnv(v: unknown, prefix: string, out: [string, string][]) {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        const entries = Object.entries(v);
        if (!entries.length && prefix) out.push([prefix, ""]);
        for (const [k, val] of entries) {
            flattenEnv(val, prefix ? `${prefix}_${k}` : k, out);
        }
    } else {
        const key = prefix.replace(/[^A-Za-z0-9_]+/g, "_").toUpperCase();
        const s = v === null || v === undefined ? "" : Array.isArray(v) ? JSON.stringify(v) : String(v);
        out.push([key, s]);
    }
}

function toEnv(v: unknown): string {
    if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error(".env output needs an object at the top level.");
    const pairs: [string, string][] = [];
    flattenEnv(v, "", pairs);
    return pairs.map(([k, s]) => (/^[\w./:@-]*$/.test(s) ? `${k}=${s}` : `${k}="${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`)).join("\n") + "\n";
}

function parseInput(text: string, f: Fmt): unknown {
    switch (f) {
        case "json": return JSON.parse(text);
        case "json5": return JSON5.parse(text);
        case "yaml": {
            const docs = loadAll(text);
            return docs.length === 1 ? docs[0] : docs;
        }
        case "toml": return parseToml(text);
        case "env": return parseEnv(text);
    }
}

function stringify(v: unknown, f: Fmt): string {
    const ind = indent.value === 0 ? undefined : indent.value;
    switch (f) {
        case "json": return JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), ind) + "\n";
        case "json5": return JSON5.stringify(v, null, ind) + "\n";
        case "yaml":
            if (multiDoc.value && Array.isArray(v)) return v.map((d) => dump(d, { indent: indent.value || 2 })).join("---\n");
            return dump(v, { indent: indent.value || 2 });
        case "toml":
            if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error("TOML needs an object at the top level.");
            return stringifyToml(v as Record<string, unknown>) + "\n";
        case "env": return toEnv(v);
    }
}

// Minimal strict JSON scanner used only to find where invalid JSON goes wrong.
function locateJsonError(t: string): { pos: number; msg: string } | null {
    let i = 0;
    const fail = (msg: string, pos = i): never => {
        throw { pos, msg };
    };
    const ws = () => {
        while (i < t.length && " \t\n\r".includes(t[i])) i++;
    };
    const show = () => (i >= t.length ? "end of input" : `"${t[i]}"`);
    function value(): void {
        ws();
        const c = t[i];
        if (c === "{") {
            i++;
            ws();
            if (t[i] === "}") return void i++;
            for (;;) {
                ws();
                if (t[i] !== '"') fail(t[i] === "}" ? "Trailing comma before }" : `Expected a double-quoted key but found ${show()}`);
                string();
                ws();
                if (t[i] !== ":") fail(`Expected ":" after the key but found ${show()}`);
                i++;
                value();
                ws();
                if (t[i] === ",") { i++; continue; }
                if (t[i] === "}") return void i++;
                fail(`Expected "," or "}" but found ${show()}`);
            }
        }
        if (c === "[") {
            i++;
            ws();
            if (t[i] === "]") return void i++;
            for (;;) {
                ws();
                if (t[i] === "]") fail("Trailing comma before ]");
                value();
                ws();
                if (t[i] === ",") { i++; continue; }
                if (t[i] === "]") return void i++;
                fail(`Expected "," or "]" but found ${show()}`);
            }
        }
        if (c === '"') return string();
        const m = /^(-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?|true|false|null)/.exec(t.slice(i, i + 400));
        if (!m) fail(c === "'" ? "Strings must use double quotes" : `Unexpected ${show()}`);
        i += m![0].length;
    }
    function string(): void {
        const start = i++;
        for (; i < t.length; i++) {
            if (t[i] === "\\") i++;
            else if (t[i] === '"') return void i++;
            else if (t[i] === "\n") fail("Unterminated string", start);
        }
        fail("Unterminated string", start);
    }
    try {
        value();
        ws();
        if (i < t.length) fail(`Unexpected ${show()} after the end of the document`);
        return null;
    } catch (e) {
        return typeof (e as { pos?: number }).pos === "number" ? (e as { pos: number; msg: string }) : null;
    }
}

// Turn a parser error into "Line X, column Y: message" where the parser tells us the position.
function describeError(e: unknown, text: string, f: Fmt): string {
    const err = e as { message?: string; reason?: string; mark?: { line: number; column: number }; line?: number; column?: number; lineNumber?: number; columnNumber?: number };
    const msg = err.message ?? String(e);
    const at = (line: number, col: number, m: string) => `Line ${line}, column ${col}: ${m}`;
    if (f === "yaml" && err.mark) return at(err.mark.line + 1, err.mark.column + 1, err.reason ?? msg);
    if (f === "toml" && typeof err.line === "number") return at(err.line, err.column ?? 1, msg.split("\n")[0]);
    if (f === "json5" && typeof err.lineNumber === "number") return at(err.lineNumber, err.columnNumber ?? 1, msg.replace(/^JSON5: /, "").replace(/ at \d+:\d+$/, ""));
    if (f === "json") {
        const lc = /line (\d+) column (\d+)/.exec(msg);
        if (lc) return at(Number(lc[1]), Number(lc[2]), msg.replace(/ ?\(?line \d+ column \d+.*$/, "").replace(/ in JSON at position \d+/, ""));
        // Some engines give no position at all, so locate the first error with a strict scan.
        const found = locateJsonError(text);
        if (found && !/position (\d+)/.test(msg)) {
            const before = text.slice(0, found.pos);
            return at(before.split("\n").length, before.length - before.lastIndexOf("\n"), found.msg);
        }
        const pos = /position (\d+)/.exec(msg);
        if (pos) {
            const before = text.slice(0, Number(pos[1]));
            const line = before.split("\n").length;
            return at(line, before.length - before.lastIndexOf("\n"), msg.replace(/ (in JSON )?at position \d+.*$/, ""));
        }
    }
    return msg;
}

function summarize(v: unknown): string {
    if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? "" : "s"}`;
    if (v !== null && typeof v === "object") {
        const n = Object.keys(v).length;
        return `${n} top-level key${n === 1 ? "" : "s"}`;
    }
    return typeof v;
}

const result = computed<{ out: string; error?: string; parseError?: string; valid?: string }>(() => {
    if (!input.value.trim()) return { out: "" };
    let value: unknown;
    try {
        value = parseInput(input.value, from.value);
    } catch (e) {
        const parseError = describeError(e, input.value, from.value);
        return { out: "", parseError, error: `Invalid ${label(from.value)}. ${parseError}` };
    }
    const valid = `Valid ${label(from.value)} · ${summarize(value)}`;
    try {
        return { out: stringify(value, to.value), valid };
    } catch (e) {
        return { out: "", valid, error: `Cannot write ${label(to.value)}: ${(e as Error).message}` };
    }
});

function label(f: Fmt) { return fmts.find((x) => x.value === f)!.label; }

function swap() {
    const out = result.value.out;
    const f = from.value;
    from.value = to.value;
    to.value = f;
    if (out && !result.value.error) input.value = out;
}

async function paste() { input.value = await readClipboard(); }
</script>

<template>
    <ToolPage>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label class="flex items-center gap-2">
                <span class="text-muted">From</span>
                <select v-model="from" class="select !w-auto"><option v-for="f in fmts" :key="f.value" :value="f.value">{{ f.label }}</option></select>
            </label>
            <Btn size="sm" variant="secondary" title="Swap formats and move output to input" @click="swap"><ArrowLeftRight /> Swap</Btn>
            <label class="flex items-center gap-2">
                <span class="text-muted">To</span>
                <select v-model="to" class="select !w-auto"><option v-for="f in fmts" :key="f.value" :value="f.value">{{ f.label }}</option></select>
            </label>
            <label v-if="to === 'json' || to === 'json5' || to === 'yaml'" class="flex items-center gap-2">
                <span class="text-muted">Indent</span>
                <select v-model.number="indent" class="select !w-auto">
                    <option :value="2">2 spaces</option>
                    <option :value="4">4 spaces</option>
                    <option v-if="to === 'json' || to === 'json5'" :value="0">Minified</option>
                </select>
            </label>
            <label v-if="to === 'yaml'" class="flex items-center gap-2"><input v-model="multiDoc" type="checkbox" class="checkbox" /> Array as multi-document</label>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel :title="label(from)" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="input = SAMPLES[from]"><Sparkles /> Sample</Btn>
                    <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!input" @click="input = ''"><Trash2 /> Clear</Btn>
                </template>
                <CodeArea v-model="input" :wrap="false" :invalid="!!result.parseError" height="24rem" :placeholder="`Paste ${label(from)} here…`" />
                <div v-if="result.parseError || result.valid" class="border-t border-line px-4 py-2 text-xs" :class="result.parseError ? 'text-danger' : 'text-success'">{{ result.parseError ?? result.valid }}</div>
            </Panel>
            <Panel :title="label(to)" flush>
                <template #actions><CopyButton :text="result.out" /></template>
                <div v-if="result.error" class="p-4"><Notice type="error">{{ result.error }}</Notice></div>
                <CodeArea v-else :model-value="result.out" readonly :wrap="false" height="24rem" placeholder="Output appears here" />
            </Panel>
        </div>
        <p class="text-xs text-muted">The input is validated as you type, with the line and column of the first error. Multi-document YAML is read as an array. .env is flat KEY=VALUE: nested objects become KEY_SUBKEY, and values are strings.</p>
    </ToolPage>
</template>
