<script setup lang="ts">
import { computed, ref } from "vue";
import { FileJson } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

type F = { t: T; opt: boolean };
type T =
    | { k: "str" | "int" | "num" | "bool" | "null" | "unk" }
    | { k: "arr"; e: T }
    | { k: "obj"; f: Map<string, F> }
    | { k: "union"; u: T[] };

const SAMPLE = `{
  "id": 42,
  "name": "Ada Lovelace",
  "email": null,
  "active": true,
  "score": 9.5,
  "tags": ["math", "poetry"],
  "address": { "city": "London", "zip": "N1" },
  "projects": [
    { "title": "Analytical Engine", "year": 1843 },
    { "title": "Notes", "year": 1843, "url": "https://example.com" }
  ]
}`;

const input = ref(SAMPLE);
const rootName = ref("Root");
const lang = ref<"ts" | "go" | "py" | "schema">("ts");
const pyStyle = ref<"dataclass" | "typeddict">("dataclass");

function infer(v: unknown): T {
    if (v === null) return { k: "null" };
    if (typeof v === "string") return { k: "str" };
    if (typeof v === "boolean") return { k: "bool" };
    if (typeof v === "number") return { k: Number.isInteger(v) ? "int" : "num" };
    if (Array.isArray(v)) return { k: "arr", e: v.reduce<T>((acc, x) => merge(acc, infer(x)), { k: "unk" }) };
    if (typeof v === "object") {
        const f = new Map<string, F>();
        for (const [key, val] of Object.entries(v as Record<string, unknown>)) f.set(key, { t: infer(val), opt: false });
        return { k: "obj", f };
    }
    return { k: "unk" };
}

function members(t: T): T[] {
    return t.k === "union" ? t.u : [t];
}

function merge(a: T, b: T): T {
    if (a.k === "unk") return b;
    if (b.k === "unk") return a;
    if (a.k === "arr" && b.k === "arr") return { k: "arr", e: merge(a.e, b.e) };
    if (a.k === "obj" && b.k === "obj") {
        const f = new Map<string, F>();
        for (const [k, v] of a.f) {
            const o = b.f.get(k);
            f.set(k, o ? { t: merge(v.t, o.t), opt: v.opt || o.opt } : { t: v.t, opt: true });
        }
        for (const [k, v] of b.f) if (!a.f.has(k)) f.set(k, { t: v.t, opt: true });
        return { k: "obj", f };
    }
    if (a.k === b.k && a.k !== "union") return a;
    const out: T[] = [];
    for (const m of [...members(a), ...members(b)]) {
        const i = out.findIndex((x) => x.k === m.k || (isNum(x) && isNum(m)));
        if (i < 0) out.push(m);
        else if (isNum(m) && isNum(out[i]!)) out[i] = { k: out[i]!.k === "num" || m.k === "num" ? "num" : "int" } as T;
        else out[i] = merge(out[i]!, m);
    }
    return out.length === 1 ? out[0]! : { k: "union", u: out };
}
function isNum(t: T) {
    return t.k === "int" || t.k === "num";
}

// ---- naming helpers
function pascal(s: string) {
    const w = s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[^A-Za-z0-9]+/).filter(Boolean);
    let r = w.map((x) => x[0]!.toUpperCase() + x.slice(1)).join("");
    if (!r) r = "Item";
    return /^\d/.test(r) ? "_" + r : r;
}
function singular(s: string) {
    if (/ies$/i.test(s) && s.length > 4) return s.slice(0, -3) + "y";
    if (/(ss|us)$/i.test(s)) return s;
    if (/s$/i.test(s) && s.length > 3) return s.slice(0, -1);
    return s;
}
function snake(s: string) {
    const r = s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
    return /^\d/.test(r) || !r ? "_" + r : r;
}
const PY_KW = new Set(["class", "def", "from", "import", "global", "in", "is", "lambda", "not", "or", "pass", "return", "None", "True", "False", "and", "as", "if", "else", "for", "while", "with", "try", "raise", "yield", "del", "elif", "except", "finally", "assert", "break", "continue", "nonlocal", "async", "await"]);
const isIdent = (s: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) && !PY_KW.has(s);

interface Ctx {
    decls: string[];
    used: Set<string>;
}
function uniq(ctx: Ctx, base: string) {
    let n = base;
    let i = 2;
    while (ctx.used.has(n)) n = base + i++;
    ctx.used.add(n);
    return n;
}
const q = (s: string) => JSON.stringify(s);

type Gen = (t: T, hint: string, ctx: Ctx) => string;

// ---- TypeScript
function genTs(root: T, name: string) {
    const ctx: Ctx = { decls: [], used: new Set() };
    const ref_: Gen = (t, hint) => {
        switch (t.k) {
            case "str": return "string";
            case "int": case "num": return "number";
            case "bool": return "boolean";
            case "null": return "null";
            case "unk": return "unknown";
            case "arr": {
                const e = ref_(t.e, singular(hint), ctx);
                return t.e.k === "union" ? `(${e})[]` : `${e}[]`;
            }
            case "union": return t.u.map((x) => ref_(x, hint, ctx)).join(" | ");
            case "obj": {
                const n = uniq(ctx, pascal(hint));
                const lines = [...t.f].map(([k, f]) => `  ${isIdent(k) ? k : q(k)}${f.opt ? "?" : ""}: ${ref_(f.t, k, ctx)};`);
                ctx.decls.push(`export interface ${n} {\n${lines.join("\n")}\n}`);
                return n;
            }
        }
    };
    const rn = pascal(name);
    if (root.k === "obj") {
        ctx.used.add(rn);
        const lines = [...root.f].map(([k, f]) => `  ${isIdent(k) ? k : q(k)}${f.opt ? "?" : ""}: ${ref_(f.t, k, ctx)};`);
        ctx.decls.push(`export interface ${rn} {\n${lines.join("\n")}\n}`);
        // keep root first
        ctx.decls.unshift(ctx.decls.pop()!);
    } else {
        ctx.used.add(rn);
        ctx.decls.unshift(`export type ${rn} = ${ref_(root, rn + "Item", ctx)};`);
        const first = ctx.decls.shift()!;
        ctx.decls.unshift(first);
    }
    return ctx.decls.join("\n\n");
}

// ---- Go
function genGo(root: T, name: string) {
    const ctx: Ctx = { decls: [], used: new Set() };
    const structBody = (t: Extract<T, { k: "obj" }>) => {
        const rows = [...t.f].map(([k, f]) => {
            let ty = ref_(f.t, k, ctx);
            const nullable = f.t.k === "null" || (f.t.k === "union" && f.t.u.some((x) => x.k === "null"));
            if (f.opt && !ty.startsWith("*") && !ty.startsWith("[]") && ty !== "any") ty = "*" + ty;
            void nullable;
            const tag = `\`json:"${k}${f.opt ? ",omitempty" : ""}"\``;
            return [pascal(k), ty, tag] as const;
        });
        const w1 = Math.max(0, ...rows.map((r) => r[0].length));
        const w2 = Math.max(0, ...rows.map((r) => r[1].length));
        return rows.map((r) => `\t${r[0].padEnd(w1)} ${r[1].padEnd(w2)} ${r[2]}`).join("\n");
    };
    const ref_: Gen = (t, hint) => {
        switch (t.k) {
            case "str": return "string";
            case "int": return "int64";
            case "num": return "float64";
            case "bool": return "bool";
            case "null": case "unk": return "any";
            case "arr": return "[]" + ref_(t.e, singular(hint), ctx);
            case "union": {
                const nn = t.u.filter((x) => x.k !== "null");
                if (nn.length === 1) {
                    const r = ref_(nn[0]!, hint, ctx);
                    return r.startsWith("[]") || r === "any" || r.startsWith("*") ? r : "*" + r;
                }
                return "any";
            }
            case "obj": {
                const n = uniq(ctx, pascal(hint));
                ctx.decls.push(`type ${n} struct {\n${structBody(t)}\n}`);
                return n;
            }
        }
    };
    const rn = pascal(name);
    ctx.used.add(rn);
    if (root.k === "obj") {
        const body = structBody(root);
        ctx.decls.unshift(`type ${rn} struct {\n${body}\n}`);
    } else {
        const r = ref_(root, rn + "Item", ctx);
        ctx.decls.unshift(`type ${rn} ${r}`);
    }
    return ctx.decls.join("\n\n");
}

// ---- Python
function genPy(root: T, name: string, style: "dataclass" | "typeddict") {
    const ctx: Ctx = { decls: [], used: new Set() };
    let usesAny = false;
    let usesNR = false;
    const emit = (n: string, t: Extract<T, { k: "obj" }>) => {
        const entries = [...t.f].map(([k, f]) => ({ k, f, ty: ref_(f.t, k, ctx) }));
        if (style === "typeddict") {
            if (entries.every((e) => isIdent(e.k))) {
                const lines = entries.map((e) => {
                    if (e.f.opt) usesNR = true;
                    return `    ${e.k}: ${e.f.opt ? `NotRequired[${e.ty}]` : e.ty}`;
                });
                return `class ${n}(TypedDict):\n${lines.join("\n") || "    pass"}`;
            }
            const lines = entries.map((e) => {
                if (e.f.opt) usesNR = true;
                return `    ${q(e.k)}: ${e.f.opt ? `NotRequired[${e.ty}]` : e.ty},`;
            });
            return `${n} = TypedDict(${q(n)}, {\n${lines.join("\n")}\n})`;
        }
        const used = new Set<string>();
        const line = (e: (typeof entries)[number], optional: boolean) => {
            let id = snake(e.k);
            if (PY_KW.has(id)) id += "_";
            while (used.has(id)) id += "_";
            used.add(id);
            const comment = id !== e.k ? `  # JSON key: ${e.k}` : "";
            return optional ? `    ${id}: ${e.ty} | None = None${comment}` : `    ${id}: ${e.ty}${comment}`;
        };
        const lines = [
            ...entries.filter((e) => !e.f.opt).map((e) => line(e, false)),
            ...entries.filter((e) => e.f.opt).map((e) => line(e, true)),
        ];
        return `@dataclass\nclass ${n}:\n${lines.join("\n") || "    pass"}`;
    };
    const ref_: Gen = (t, hint) => {
        switch (t.k) {
            case "str": return "str";
            case "int": return "int";
            case "num": return "float";
            case "bool": return "bool";
            case "null": return "None";
            case "unk": usesAny = true; return "Any";
            case "arr": return `list[${ref_(t.e, singular(hint), ctx)}]`;
            case "union": return t.u.map((x) => ref_(x, hint, ctx)).join(" | ");
            case "obj": {
                const n = uniq(ctx, pascal(hint));
                ctx.decls.push(emit(n, t));
                return n;
            }
        }
    };
    const rn = pascal(name);
    ctx.used.add(rn);
    let last: string;
    if (root.k === "obj") last = emit(rn, root);
    else last = `${rn} = ${ref_(root, rn + "Item", ctx)}`;
    // children were pushed first, so dependencies precede the root
    const body = [...ctx.decls, last].join("\n\n\n");
    const imports = ["from __future__ import annotations", ""];
    if (style === "dataclass") imports.push("from dataclasses import dataclass");
    const typing: string[] = [];
    if (usesAny) typing.push("Any");
    if (style === "typeddict") {
        typing.push("TypedDict");
        if (usesNR) typing.push("NotRequired");
    }
    if (typing.length) imports.push(`from typing import ${typing.join(", ")}`);
    return `${imports.join("\n")}\n\n\n${body}`;
}

// ---- JSON Schema
function schemaOf(t: T): Record<string, unknown> {
    switch (t.k) {
        case "str": return { type: "string" };
        case "int": return { type: "integer" };
        case "num": return { type: "number" };
        case "bool": return { type: "boolean" };
        case "null": return { type: "null" };
        case "unk": return {};
        case "arr": return { type: "array", items: schemaOf(t.e) };
        case "union": return { anyOf: t.u.map(schemaOf) };
        case "obj": {
            const properties: Record<string, unknown> = {};
            const required: string[] = [];
            for (const [k, f] of t.f) {
                properties[k] = schemaOf(f.t);
                if (!f.opt) required.push(k);
            }
            const o: Record<string, unknown> = { type: "object", properties };
            if (required.length) o.required = required;
            return o;
        }
    }
}
function genSchema(root: T, name: string) {
    return JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", title: name, ...schemaOf(root) }, null, 2);
}

const result = computed<{ out: string; error?: string }>(() => {
    if (!input.value.trim()) return { out: "" };
    let data: unknown;
    try {
        data = JSON.parse(input.value);
    } catch (e) {
        return { out: "", error: (e as Error).message };
    }
    const t = infer(data);
    const name = rootName.value.trim() || "Root";
    switch (lang.value) {
        case "ts": return { out: genTs(t, name) };
        case "go": return { out: "package main\n\n" + genGo(t, name) };
        case "py": return { out: genPy(t, name, pyStyle.value) };
        default: return { out: genSchema(t, name) };
    }
});
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs
                v-model="lang"
                :options="[
                    { value: 'ts', label: 'TypeScript' },
                    { value: 'go', label: 'Go' },
                    { value: 'py', label: 'Python' },
                    { value: 'schema', label: 'JSON Schema' },
                ]"
            />
        </template>

        <div class="flex flex-wrap items-end gap-x-5 gap-y-3">
            <div class="w-48">
                <label class="label" for="j2c-root">Root name</label>
                <input id="j2c-root" v-model="rootName" class="input" placeholder="Root" />
            </div>
            <div v-if="lang === 'py'">
                <span class="label">Python style</span>
                <Tabs v-model="pyStyle" size="sm" :options="[{ value: 'dataclass', label: 'dataclass' }, { value: 'typeddict', label: 'TypedDict' }]" />
            </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="JSON" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="input = SAMPLE"><FileJson /> Sample</Btn>
                </template>
                <CodeArea v-model="input" :wrap="false" placeholder="Paste JSON here…" :invalid="!!result.error" />
            </Panel>
            <Panel title="Output" flush>
                <template #actions><CopyButton :text="result.out" /></template>
                <div v-if="result.error" class="p-4"><Notice type="error">{{ result.error }}</Notice></div>
                <CodeArea v-else :model-value="result.out" readonly :wrap="false" placeholder="Generated code appears here" />
            </Panel>
        </div>
    </ToolPage>
</template>
