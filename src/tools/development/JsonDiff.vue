<script setup lang="ts">
import { computed, ref } from "vue";
import * as yaml from "js-yaml";
import { ArrowRight, FileJson } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, ToolPage } from "@/components/ui";

const A = `{
  "name": "tools",
  "version": "1.0.0",
  "tags": ["a", "b", "c"],
  "author": { "name": "Ada", "email": "ada@example.com" },
  "private": true
}`;
const B = `name: tools
version: 1.1.0
tags: [c, a, d]
author:
  name: Ada
  url: https://example.com
`;

const left = ref(A);
const right = ref(B);
const ignoreOrder = ref(false);

function parse(text: string): { value?: unknown; error?: string; empty?: boolean } {
    if (!text.trim()) return { empty: true };
    try {
        return { value: JSON.parse(text) };
    } catch (jsonErr) {
        try {
            return { value: yaml.load(text) };
        } catch (yamlErr) {
            return { error: ((/^\s*[[{]/.test(text) ? jsonErr : yamlErr) as Error).message };
        }
    }
}

type Kind = "add" | "remove" | "change";
interface Change {
    kind: Kind;
    path: string[];
    oldV?: unknown;
    newV?: unknown;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function canon(v: unknown): string {
    if (Array.isArray(v)) return "[" + v.map(canon).sort().join(",") + "]";
    if (isObj(v)) return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
    return JSON.stringify(v) ?? "undefined";
}
const same = (a: unknown, b: unknown, unordered: boolean) =>
    unordered ? canon(a) === canon(b) : JSON.stringify(a) === JSON.stringify(b);

function diff(a: unknown, b: unknown, path: string[], out: Change[], unordered: boolean) {
    if (Array.isArray(a) && Array.isArray(b)) {
        if (unordered) {
            // match by canonical form; leftovers are removals/additions
            const pool = b.map((v, i) => ({ v, i, c: canon(v), used: false }));
            const unmatched: { v: unknown; i: number }[] = [];
            a.forEach((v, i) => {
                const c = canon(v);
                const hit = pool.find((p) => !p.used && p.c === c);
                if (hit) hit.used = true;
                else unmatched.push({ v, i });
            });
            const rest = pool.filter((p) => !p.used);
            const n = Math.min(unmatched.length, rest.length);
            for (let k = 0; k < n; k++) diff(unmatched[k]!.v, rest[k]!.v, [...path, String(unmatched[k]!.i)], out, unordered);
            for (let k = n; k < unmatched.length; k++) out.push({ kind: "remove", path: [...path, String(unmatched[k]!.i)], oldV: unmatched[k]!.v });
            for (let k = n; k < rest.length; k++) out.push({ kind: "add", path: [...path, String(rest[k]!.i)], newV: rest[k]!.v });
            return;
        }
        const n = Math.max(a.length, b.length);
        for (let i = 0; i < n; i++) {
            if (i >= a.length) out.push({ kind: "add", path: [...path, String(i)], newV: b[i] });
            else if (i >= b.length) out.push({ kind: "remove", path: [...path, String(i)], oldV: a[i] });
            else diff(a[i], b[i], [...path, String(i)], out, unordered);
        }
        return;
    }
    if (isObj(a) && isObj(b)) {
        for (const k of Object.keys(a)) {
            if (!(k in b)) out.push({ kind: "remove", path: [...path, k], oldV: a[k] });
            else diff(a[k], b[k], [...path, k], out, unordered);
        }
        for (const k of Object.keys(b)) if (!(k in a)) out.push({ kind: "add", path: [...path, k], newV: b[k] });
        return;
    }
    if (!same(a, b, unordered)) out.push({ kind: "change", path, oldV: a, newV: b });
}

const parsed = computed(() => ({ a: parse(left.value), b: parse(right.value) }));

const changes = computed<Change[]>(() => {
    const { a, b } = parsed.value;
    if (a.error || b.error || a.empty || b.empty) return [];
    const out: Change[] = [];
    diff(a.value, b.value, [], out, ignoreOrder.value);
    return out;
});

const counts = computed(() => ({
    add: changes.value.filter((c) => c.kind === "add").length,
    remove: changes.value.filter((c) => c.kind === "remove").length,
    change: changes.value.filter((c) => c.kind === "change").length,
}));

const ptr = (p: string[]) => p.map((s) => "/" + s.replace(/~/g, "~0").replace(/\//g, "~1")).join("");
const dispPath = (p: string[]) => (p.length ? p.map((s) => (/^\d+$/.test(s) ? `[${s}]` : "." + s)).join("").replace(/^\./, "") : "(root)");
const show = (v: unknown) => (v === undefined ? "undefined" : JSON.stringify(v));

const patch = computed(() => {
    // Remove ops on arrays must run from the highest index down so indices stay valid.
    const ops = changes.value.map((c) => {
        if (c.kind === "add") return { op: "add", path: ptr(c.path), value: c.newV };
        if (c.kind === "remove") return { op: "remove", path: ptr(c.path) };
        return { op: "replace", path: ptr(c.path), value: c.newV };
    });
    const removes = ops.filter((o) => o.op === "remove").sort((x, y) => y.path.localeCompare(x.path, undefined, { numeric: true }));
    const rest = ops.filter((o) => o.op !== "remove");
    return JSON.stringify([...rest, ...removes], null, 2);
});

const err = computed(() => parsed.value.a.error ?? parsed.value.b.error);

const style: Record<Kind, string> = {
    add: "bg-success/10 text-success",
    remove: "bg-danger/10 text-danger",
    change: "bg-warning/10 text-warning",
};
const sym: Record<Kind, string> = { add: "+ added", remove: "− removed", change: "~ changed" };
</script>

<template>
    <ToolPage>
        <label class="flex w-fit items-center gap-2 text-sm"><input v-model="ignoreOrder" type="checkbox" class="checkbox" /> Ignore array order</label>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Original (JSON or YAML)" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="((left = A), (right = B))"><FileJson /> Sample</Btn>
                </template>
                <CodeArea v-model="left" :wrap="false" height="16rem" placeholder="Original…" :invalid="!!parsed.a.error" />
            </Panel>
            <Panel title="Modified (JSON or YAML)" flush>
                <CodeArea v-model="right" :wrap="false" height="16rem" placeholder="Modified…" :invalid="!!parsed.b.error" />
            </Panel>
        </div>

        <Notice v-if="parsed.a.error" type="error">Original: {{ parsed.a.error }}</Notice>
        <Notice v-if="parsed.b.error" type="error">Modified: {{ parsed.b.error }}</Notice>

        <Panel v-if="!err" title="Differences" flush>
            <template #actions>
                <span class="chip text-success">+{{ counts.add }}</span>
                <span class="chip text-danger">−{{ counts.remove }}</span>
                <span class="chip text-warning">~{{ counts.change }}</span>
                <CopyButton :text="patch" label="Copy JSON Patch" />
            </template>
            <p v-if="!changes.length" class="p-4 text-sm text-muted">
                {{ parsed.a.empty || parsed.b.empty ? "Enter both documents to compare." : "No differences. The documents are equal." }}
            </p>
            <ul v-else class="divide-y divide-line">
                <li v-for="(c, i) in changes" :key="i" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                    <span class="w-24 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-medium" :class="style[c.kind]">{{ sym[c.kind] }}</span>
                    <code class="code break-all">{{ dispPath(c.path) }}</code>
                    <span class="flex min-w-0 flex-wrap items-center gap-1.5 font-mono text-xs">
                        <template v-if="c.kind === 'change'">
                            <span class="text-danger break-all">{{ show(c.oldV) }}</span>
                            <ArrowRight class="size-3.5 text-muted" />
                            <span class="text-success break-all">{{ show(c.newV) }}</span>
                        </template>
                        <span v-else-if="c.kind === 'add'" class="text-success break-all">{{ show(c.newV) }}</span>
                        <span v-else class="text-danger break-all">{{ show(c.oldV) }}</span>
                    </span>
                </li>
            </ul>
        </Panel>
    </ToolPage>
</template>
