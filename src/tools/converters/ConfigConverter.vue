<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowLeftRight, ClipboardPaste, Sparkles, Trash2 } from "lucide-vue-next";
import { dump, loadAll } from "js-yaml";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { Btn, CodeArea, CopyButton, Notice, Panel, ToolPage } from "@/components/ui";
import { readClipboard } from "@/composables/useClipboard";

type Fmt = "json" | "yaml" | "toml" | "env";
const fmts: { value: Fmt; label: string }[] = [
    { value: "json", label: "JSON" },
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
        case "yaml":
            if (multiDoc.value && Array.isArray(v)) return v.map((d) => dump(d, { indent: indent.value || 2 })).join("---\n");
            return dump(v, { indent: indent.value || 2 });
        case "toml":
            if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error("TOML needs an object at the top level.");
            return stringifyToml(v as Record<string, unknown>) + "\n";
        case "env": return toEnv(v);
    }
}

const result = computed<{ out: string; error?: string }>(() => {
    if (!input.value.trim()) return { out: "" };
    let value: unknown;
    try {
        value = parseInput(input.value, from.value);
    } catch (e) {
        return { out: "", error: `Invalid ${label(from.value)}: ${(e as Error).message}` };
    }
    try {
        return { out: stringify(value, to.value) };
    } catch (e) {
        return { out: "", error: `Cannot write ${label(to.value)}: ${(e as Error).message}` };
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
            <label v-if="to === 'json' || to === 'yaml'" class="flex items-center gap-2">
                <span class="text-muted">Indent</span>
                <select v-model.number="indent" class="select !w-auto">
                    <option :value="2">2 spaces</option>
                    <option :value="4">4 spaces</option>
                    <option v-if="to === 'json'" :value="0">Minified</option>
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
                <CodeArea v-model="input" :wrap="false" :invalid="!!result.error" height="24rem" :placeholder="`Paste ${label(from)} here…`" />
            </Panel>
            <Panel :title="label(to)" flush>
                <template #actions><CopyButton :text="result.out" /></template>
                <div v-if="result.error" class="p-4"><Notice type="error">{{ result.error }}</Notice></div>
                <CodeArea v-else :model-value="result.out" readonly :wrap="false" height="24rem" placeholder="Output appears here" />
            </Panel>
        </div>
        <p class="text-xs text-muted">Multi-document YAML is read as an array. .env is flat KEY=VALUE: nested objects become KEY_SUBKEY, and values are strings.</p>
    </ToolPage>
</template>
