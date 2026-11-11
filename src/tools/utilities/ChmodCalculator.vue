<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Btn, CopyButton, Field, Notice, Panel, ToolPage } from "@/components/ui";

const mode = ref(0o755);

const rows = [
    { label: "Owner", r: 0o400, w: 0o200, x: 0o100 },
    { label: "Group", r: 0o040, w: 0o020, x: 0o010 },
    { label: "Others", r: 0o004, w: 0o002, x: 0o001 },
] as const;
const cols = [{ k: "r", label: "Read" }, { k: "w", label: "Write" }, { k: "x", label: "Execute" }] as const;
const specials = [
    { bit: 0o4000, label: "setuid", hint: "Run as file owner" },
    { bit: 0o2000, label: "setgid", hint: "Run as file group" },
    { bit: 0o1000, label: "sticky", hint: "Only owner may delete" },
];

const has = (bit: number) => (mode.value & bit) !== 0;
function toggle(bit: number) {
    mode.value ^= bit;
}

const octal = computed(() => {
    const m = mode.value;
    return m > 0o777 ? m.toString(8).padStart(4, "0") : m.toString(8).padStart(3, "0");
});

function symbolic(m: number) {
    const triple = (r: number, w: number, x: number, sp: number, ch: [string, string]) => {
        const xs = (m & x) !== 0;
        const s = (m & sp) !== 0;
        return `${m & r ? "r" : "-"}${m & w ? "w" : "-"}${s ? (xs ? ch[0] : ch[1]) : xs ? "x" : "-"}`;
    };
    return triple(0o400, 0o200, 0o100, 0o4000, ["s", "S"]) + triple(0o040, 0o020, 0o010, 0o2000, ["s", "S"]) + triple(0o004, 0o002, 0o001, 0o1000, ["t", "T"]);
}
const sym = computed(() => symbolic(mode.value));

function parseSym(s: string): number | null {
    const t = s.trim();
    const body = t.length === 10 ? t.slice(1) : t;
    if (!/^[r-][w-][xsS-][r-][w-][xsS-][r-][w-][xtT-]$/.test(body)) return null;
    let m = 0;
    const bits = [0o400, 0o200, 0o100, 0o040, 0o020, 0o010, 0o004, 0o002, 0o001];
    for (let i = 0; i < 9; i++) {
        const c = body[i];
        if (c === "-") continue;
        if (c === "r" || c === "w" || c === "x") m |= bits[i];
        else if (c === "s" || c === "S") {
            m |= i === 2 ? 0o4000 : 0o2000;
            if (c === "s") m |= bits[i];
        } else if (c === "t" || c === "T") {
            m |= 0o1000;
            if (c === "t") m |= bits[i];
        }
    }
    return m;
}

const octalText = ref(octal.value);
const symText = ref(sym.value);
watch(mode, () => {
    if (parseInt(octalText.value, 8) !== mode.value || !/^[0-7]{3,4}$/.test(octalText.value)) octalText.value = octal.value;
    if (parseSym(symText.value) !== mode.value) symText.value = sym.value;
}, { flush: "sync" });
const octalBad = computed(() => octalText.value !== "" && !/^[0-7]{3,4}$/.test(octalText.value));
const symBad = computed(() => symText.value !== "" && parseSym(symText.value) === null);
function onOctal() {
    if (/^[0-7]{3,4}$/.test(octalText.value)) mode.value = parseInt(octalText.value, 8);
}
function onSym() {
    const m = parseSym(symText.value);
    if (m !== null) mode.value = m;
}

// chmod expressions
const exprText = ref("");
const exprError = ref("");
function applyExpr() {
    exprError.value = "";
    let m = mode.value;
    const clauses = exprText.value.split(",").map((c) => c.trim()).filter(Boolean);
    if (!clauses.length) return;
    const shift = { u: 6, g: 3, o: 0 } as const;
    for (const c of clauses) {
        const mt = /^([ugoa]*)(?:([+\-=])([ugo]|[rwxXst]*))+$/.exec(c);
        if (!mt) {
            exprError.value = `Cannot parse "${c}". Example: u+x,g-w,o=r`;
            return;
        }
        const who = (/^[ugoa]*/.exec(c)![0] || "a").replace("a", "ugo");
        const ops = /([+\-=])([ugo]|[rwxXst]*)/g;
        let o: RegExpExecArray | null;
        while ((o = ops.exec(c.replace(/^[ugoa]*/, "")))) {
            const op = o[1];
            const spec = o[2];
            for (const cls of [...who]) {
                const sh = shift[cls as "u" | "g" | "o"];
                let add = 0;
                let special = 0;
                if (/^[ugo]$/.test(spec)) add = ((m >> shift[spec as "u" | "g" | "o"]) & 7) << sh;
                else {
                    if (spec.includes("r")) add |= 4 << sh;
                    if (spec.includes("w")) add |= 2 << sh;
                    if (spec.includes("x") || (spec.includes("X") && (m & 0o111) !== 0)) add |= 1 << sh;
                    if (spec.includes("s") && cls !== "o") special |= cls === "u" ? 0o4000 : 0o2000;
                    if (spec.includes("t")) special |= 0o1000;
                }
                const mask = 7 << sh;
                if (op === "+") m |= add | special;
                else if (op === "-") m &= ~(add | special);
                else {
                    m = (m & ~mask) | add;
                    if (cls === "u") m = (m & ~0o4000) | (special & 0o4000);
                    if (cls === "g") m = (m & ~0o2000) | (special & 0o2000);
                    m |= special & 0o1000;
                }
            }
        }
    }
    mode.value = m & 0o7777;
}

const file = ref("file");
const recursive = ref(false);
const target = computed(() => file.value.trim() || "file");
const flag = computed(() => (recursive.value ? "-R " : ""));

function who(r: number, w: number, x: number, sp: number, spName: string, m: number) {
    const parts = [m & r ? "read" : "", m & w ? "write" : "", m & x ? "execute" : ""].filter(Boolean);
    const base = parts.length ? parts.join(", ").replace(/, ([^,]*)$/, " and $1") : "no permissions";
    return m & sp ? `${base} (${spName})` : base;
}
const symCmd = computed(() => {
    const m = mode.value;
    const t = (sh: number, sp: number, ch: string) => {
        const p = `${(m >> sh) & 4 ? "r" : ""}${(m >> sh) & 2 ? "w" : ""}${(m >> sh) & 1 ? "x" : ""}${m & sp ? ch : ""}`;
        return p;
    };
    return `u=${t(6, 0o4000, "s")},g=${t(3, 0o2000, "s")},o=${t(0, 0o1000, "t")}`;
});
const summary = computed(() => {
    const m = mode.value;
    const lines = [
        `Owner can ${who(0o400, 0o200, 0o100, 0o4000, "setuid", m)}.`,
        `Group can ${who(0o040, 0o020, 0o010, 0o2000, "setgid", m)}.`,
        `Others can ${who(0o004, 0o002, 0o001, 0o1000, "sticky bit", m)}.`,
    ];
    return lines.map((l) => l.replace("can no permissions", "have no permissions"));
});

const presets = [
    { v: 0o644, note: "Files: owner rw, others read" },
    { v: 0o755, note: "Executables, directories" },
    { v: 0o600, note: "Private files (keys)" },
    { v: 0o700, note: "Private directories" },
    { v: 0o777, note: "Everyone, everything" },
    { v: 0o640, note: "Owner rw, group read" },
    { v: 0o4755, note: "setuid executable" },
    { v: 0o1777, note: "Shared dir (/tmp)" },
];
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Permissions">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-xs text-muted uppercase">
                            <th class="pb-2 text-left font-medium"></th>
                            <th v-for="c in cols" :key="c.k" class="pb-2 text-center font-medium">{{ c.label }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="r in rows" :key="r.label" class="border-t border-line">
                            <th class="py-2.5 text-left font-medium">{{ r.label }}</th>
                            <td v-for="c in cols" :key="c.k" class="py-2.5 text-center">
                                <input type="checkbox" class="checkbox" :checked="has(r[c.k])" :aria-label="`${r.label} ${c.label}`" @change="toggle(r[c.k])" />
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div class="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-3">
                    <label v-for="s in specials" :key="s.label" class="flex items-center gap-2 text-sm" :title="s.hint">
                        <input type="checkbox" class="checkbox" :checked="has(s.bit)" @change="toggle(s.bit)" /> {{ s.label }}
                    </label>
                </div>
                <div class="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                    <Field label="Octal">
                        <input v-model="octalText" class="input font-mono" :class="octalBad ? '!border-danger' : ''" maxlength="4" inputmode="numeric" spellcheck="false" @input="onOctal" />
                    </Field>
                    <Field label="Symbolic">
                        <input v-model="symText" class="input font-mono" :class="symBad ? '!border-danger' : ''" maxlength="10" spellcheck="false" @input="onSym" />
                    </Field>
                </div>
                <Notice v-if="octalBad || symBad" type="error" class="mt-3">{{ octalBad ? "Octal must be 3 or 4 digits (0-7)." : "Symbolic must look like rwxr-xr-x." }}</Notice>
                <div class="mt-4 border-t border-line pt-4">
                    <Field label="Apply expression" hint="Examples: u+x,g-w,o=r · a+r · go-rwx · u+s">
                        <div class="flex gap-2">
                            <input v-model="exprText" class="input font-mono" placeholder="u+x,g-w,o=r" spellcheck="false" @keydown.enter.prevent="applyExpr" />
                            <Btn @click="applyExpr">Apply</Btn>
                        </div>
                    </Field>
                    <Notice v-if="exprError" type="error" class="mt-2">{{ exprError }}</Notice>
                </div>
            </Panel>

            <div class="flex min-w-0 flex-col gap-4">
                <Panel title="Command">
                    <div class="mb-3 flex flex-wrap items-center gap-3">
                        <input v-model="file" class="input max-w-48" placeholder="file" aria-label="File name" spellcheck="false" />
                        <label class="flex items-center gap-2 text-sm"><input v-model="recursive" type="checkbox" class="checkbox" /> Recursive (-R)</label>
                    </div>
                    <div class="flex flex-col gap-2">
                        <div v-for="c in [`chmod ${flag}${octal} ${target}`, `chmod ${flag}${symCmd} ${target}`]" :key="c" class="flex items-center justify-between gap-2 rounded-lg bg-subtle px-3 py-2">
                            <code class="min-w-0 font-mono text-sm break-all">{{ c }}</code>
                            <CopyButton :text="c" icon-only />
                        </div>
                    </div>
                </Panel>
                <Panel title="Summary">
                    <p class="mb-2 font-mono text-lg">{{ octal }} <span class="text-muted">{{ sym }}</span></p>
                    <ul class="space-y-1 text-sm">
                        <li v-for="l in summary" :key="l">{{ l }}</li>
                    </ul>
                </Panel>
                <Panel title="Presets" flush>
                    <ul class="divide-y divide-line">
                        <li v-for="p in presets" :key="p.v">
                            <button type="button" class="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left hover:bg-subtle" :class="mode === p.v ? 'bg-accent/10' : ''" @click="mode = p.v">
                                <span class="w-12 font-mono text-sm font-semibold">{{ p.v.toString(8).padStart(3, "0") }}</span>
                                <span class="w-24 font-mono text-xs text-muted">{{ symbolic(p.v) }}</span>
                                <span class="text-sm text-muted">{{ p.note }}</span>
                            </button>
                        </li>
                    </ul>
                </Panel>
            </div>
        </div>
    </ToolPage>
</template>
