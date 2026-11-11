<script setup lang="ts">
import { computed, ref } from "vue";
import { ClipboardPaste, Download, Sparkles, Trash2 } from "lucide-vue-next";
import { format } from "sql-formatter";
import type { SqlLanguage } from "sql-formatter";
import Papa from "papaparse";
import { Btn, CodeArea, CopyButton, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { downloadBlob, readClipboard } from "@/composables/useClipboard";

type Mode = "format" | "minify" | "data";
const mode = ref<Mode>("format");

const SAMPLE_QUERY =
    "select u.id, u.name, count(o.id) as orders, sum(o.total) as revenue from users u left join orders o on o.user_id = u.id where u.created_at >= '2026-01-01' and u.status in ('active','trial') group by u.id, u.name having count(o.id) > 3 order by revenue desc limit 20;";
const SAMPLE_INSERT = `INSERT INTO users (id, name, email, active, score) VALUES
  (1, 'Ada Lovelace', 'ada@example.com', TRUE, 9.5),
  (2, 'Alan Turing', 'alan@example.com', TRUE, NULL),
  (3, 'Grace O''Hara', 'grace@example.com', FALSE, 7);
INSERT INTO users (id, name, email, active, score) VALUES (4, 'Linus', 'linus@example.com', TRUE, 8.25);`;

const input = ref(SAMPLE_QUERY);
const dialect = ref<SqlLanguage>("sql");
const keywordCase = ref<"upper" | "lower" | "preserve">("upper");
const indent = ref(2);
const dataFmt = ref<"json" | "csv">("json");

const dialects: { value: SqlLanguage; label: string }[] = [
    { value: "sql", label: "Standard SQL" }, { value: "postgresql", label: "PostgreSQL" }, { value: "mysql", label: "MySQL" },
    { value: "mariadb", label: "MariaDB" }, { value: "sqlite", label: "SQLite" }, { value: "transactsql", label: "SQL Server (T-SQL)" },
    { value: "plsql", label: "Oracle PL/SQL" }, { value: "bigquery", label: "BigQuery" }, { value: "snowflake", label: "Snowflake" },
    { value: "redshift", label: "Redshift" }, { value: "spark", label: "Spark" }, { value: "trino", label: "Trino" },
];

// Remove comments and collapse whitespace without touching quoted strings or identifiers.
function minify(sql: string): string {
    let out = "";
    let i = 0;
    while (i < sql.length) {
        const c = sql[i];
        if (c === "'" || c === '"' || c === "`") {
            let j = i + 1;
            while (j < sql.length) {
                if (sql[j] === c && sql[j + 1] === c) j += 2;
                else if (sql[j] === "\\" && c !== '"') j += 2;
                else if (sql[j] === c) break;
                else j++;
            }
            out += sql.slice(i, j + 1);
            i = j + 1;
        } else if (c === "-" && sql[i + 1] === "-") {
            while (i < sql.length && sql[i] !== "\n") i++;
        } else if (c === "/" && sql[i + 1] === "*") {
            const end = sql.indexOf("*/", i + 2);
            i = end < 0 ? sql.length : end + 2;
            out += " ";
        } else if (/\s/.test(c)) {
            if (out && !out.endsWith(" ")) out += " ";
            i++;
        } else {
            out += c;
            i++;
        }
    }
    return out.replace(/ ?([(),;=<>]) ?/g, "$1").replace(/,/g, ", ").trim();
}

// ---- INSERT statements to rows ----
type Cell = string | number | boolean | null;

function parseInserts(sql: string): { table: string; cols: string[]; rows: Cell[][] } {
    const rows: Cell[][] = [];
    let cols: string[] = [];
    let table = "";
    const re = /insert\s+(?:ignore\s+)?into\s+((?:[`"[]?[\w$.]+[`"\]]?\.?)+)\s*(\(([^)]*)\))?\s*values/gi;
    let m: RegExpExecArray | null;
    let found = false;
    while ((m = re.exec(sql))) {
        found = true;
        table ||= m[1].replace(/[`"[\]]/g, "");
        const c = m[3] ? m[3].split(",").map((x) => x.trim().replace(/^[`"[]|[`"\]]$/g, "")) : [];
        if (c.length > cols.length) cols = c;
        let i = re.lastIndex;
        // read (…), (…) tuples until ; or the next statement
        for (;;) {
            while (i < sql.length && /[\s,]/.test(sql[i])) i++;
            if (sql[i] !== "(") break;
            i++;
            const row: Cell[] = [];
            let cur = "";
            let quoted = false;
            let depth = 0;
            for (;;) {
                if (i >= sql.length) throw new Error("Unterminated VALUES list.");
                const ch = sql[i];
                if (ch === "'") {
                    // drop whitespace and string prefixes (N'…', E'…') before the opening quote
                    if (!quoted && /^\s*[NnEeXxBb]?$/.test(cur)) cur = "";
                    quoted = true;
                    i++;
                    for (;;) {
                        if (i >= sql.length) throw new Error("Unterminated string literal.");
                        if (sql[i] === "'" && sql[i + 1] === "'") { cur += "'"; i += 2; }
                        else if (sql[i] === "\\" && i + 1 < sql.length) { cur += sql[i + 1] === "n" ? "\n" : sql[i + 1] === "t" ? "\t" : sql[i + 1]; i += 2; }
                        else if (sql[i] === "'") { i++; break; }
                        else cur += sql[i++];
                    }
                } else if (ch === "(") { depth++; cur += ch; i++; }
                else if (ch === ")" && depth > 0) { depth--; cur += ch; i++; }
                else if (ch === "," && depth === 0) { row.push(toCell(cur, quoted)); cur = ""; quoted = false; i++; }
                else if (ch === ")") { row.push(toCell(cur, quoted)); i++; break; }
                else { if (!(quoted && /\s/.test(ch))) cur += ch; i++; }
            }
            rows.push(row);
        }
        re.lastIndex = i;
    }
    if (!found) throw new Error("No INSERT INTO … VALUES statement found.");
    const width = rows.reduce((n, r) => Math.max(n, r.length), cols.length);
    while (cols.length < width) cols.push(`column_${cols.length + 1}`);
    return { table, cols, rows };
}

function toCell(raw: string, quoted: boolean): Cell {
    if (quoted) return raw;
    const t = raw.trim();
    if (/^null$/i.test(t)) return null;
    if (/^true$/i.test(t)) return true;
    if (/^false$/i.test(t)) return false;
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) return Number(t);
    return t;
}

const result = computed<{ out: string; error?: string; note?: string }>(() => {
    const sql = input.value;
    if (!sql.trim()) return { out: "" };
    try {
        if (mode.value === "format") {
            return { out: format(sql, { language: dialect.value, keywordCase: keywordCase.value, tabWidth: indent.value, linesBetweenQueries: 2 }) };
        }
        if (mode.value === "minify") {
            const out = minify(sql);
            return { out, note: `${sql.length} → ${out.length} characters` };
        }
        const { table, cols, rows } = parseInserts(sql);
        const objects = rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? null])));
        const out = dataFmt.value === "json" ? JSON.stringify(objects, null, 2) : Papa.unparse(objects, { newline: "\n" });
        return { out, note: `${rows.length} row${rows.length === 1 ? "" : "s"} from ${table}` };
    } catch (e) {
        return { out: "", error: (e as Error).message };
    }
});

function sample() {
    input.value = mode.value === "data" ? SAMPLE_INSERT : SAMPLE_QUERY;
}
function setMode(m: Mode) {
    if (m === "data" && input.value === SAMPLE_QUERY) input.value = SAMPLE_INSERT;
    else if (m !== "data" && input.value === SAMPLE_INSERT) input.value = SAMPLE_QUERY;
    mode.value = m;
}
async function paste() {
    input.value = await readClipboard();
}
function download() {
    if (mode.value === "data") downloadBlob(result.value.out, dataFmt.value === "json" ? "data.json" : "data.csv", dataFmt.value === "json" ? "application/json" : "text/csv");
    else downloadBlob(result.value.out, "query.sql", "application/sql");
}
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs :model-value="mode" :options="[{ value: 'format', label: 'Format' }, { value: 'minify', label: 'Minify' }, { value: 'data', label: 'INSERT → JSON / CSV' }]" @update:model-value="setMode" />
        </template>

        <div v-if="mode !== 'minify'" class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <template v-if="mode === 'format'">
                <label class="flex items-center gap-2"><span class="text-muted">Dialect</span>
                    <select v-model="dialect" class="select !w-auto"><option v-for="d in dialects" :key="d.value" :value="d.value">{{ d.label }}</option></select>
                </label>
                <label class="flex items-center gap-2"><span class="text-muted">Keywords</span>
                    <select v-model="keywordCase" class="select !w-auto"><option value="upper">UPPERCASE</option><option value="lower">lowercase</option><option value="preserve">Preserve</option></select>
                </label>
                <label class="flex items-center gap-2"><span class="text-muted">Indent</span>
                    <select v-model.number="indent" class="select !w-auto"><option :value="2">2 spaces</option><option :value="4">4 spaces</option></select>
                </label>
            </template>
            <label v-else class="flex items-center gap-2"><span class="text-muted">Output</span>
                <select v-model="dataFmt" class="select !w-auto"><option value="json">JSON</option><option value="csv">CSV</option></select>
            </label>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="SQL" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="sample"><Sparkles /> Sample</Btn>
                    <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!input" @click="input = ''"><Trash2 /> Clear</Btn>
                </template>
                <CodeArea v-model="input" height="26rem" :invalid="!!result.error" :placeholder="mode === 'data' ? 'Paste INSERT INTO … VALUES statements…' : 'Paste SQL here…'" />
            </Panel>
            <Panel :title="mode === 'format' ? 'Formatted' : mode === 'minify' ? 'Minified' : dataFmt.toUpperCase()" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" :disabled="!result.out" @click="download"><Download /> Download</Btn>
                    <CopyButton :text="result.out" />
                </template>
                <div v-if="result.error" class="p-4"><Notice type="error">{{ result.error }}</Notice></div>
                <CodeArea v-else :model-value="result.out" readonly :wrap="mode === 'minify'" height="26rem" placeholder="Output appears here" />
                <div v-if="result.note" class="border-t border-line px-4 py-2 text-xs text-muted">{{ result.note }}</div>
            </Panel>
        </div>
        <p v-if="mode === 'data'" class="text-xs text-muted">Reads the column list and every VALUES tuple from INSERT statements. Expressions such as NOW() are kept as text.</p>
    </ToolPage>
</template>
