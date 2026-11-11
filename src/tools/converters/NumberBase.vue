<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Btn, CopyButton, Panel, Tabs, ToolPage } from "@/components/ui";

type FieldId = "bin" | "oct" | "dec" | "hex" | "custom" | "roman";

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

function parseBig(raw: string, base: number): bigint | null {
    let s = raw.trim().replace(/[_\s]/g, "").toLowerCase();
    if (!s) return null;
    let neg = false;
    if (s[0] === "-" || s[0] === "+") { neg = s[0] === "-"; s = s.slice(1); }
    const pre = s.match(/^0([xbo])/);
    if (pre) { base = pre[1] === "x" ? 16 : pre[1] === "b" ? 2 : 8; s = s.slice(2); }
    if (!s) return null;
    let n = 0n;
    const b = BigInt(base);
    for (const ch of s) {
        const d = DIGITS.indexOf(ch);
        if (d < 0 || d >= base) return null;
        n = n * b + BigInt(d);
    }
    return neg ? -n : n;
}

const ROMAN: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];

function toRoman(n: bigint): string {
    if (n < 1n || n > 3999n) return "";
    let x = Number(n);
    let out = "";
    for (const [v, s] of ROMAN) while (x >= v) { out += s; x -= v; }
    return out;
}

function fromRoman(s: string): bigint | null {
    const t = s.trim().toUpperCase();
    if (!/^[MDCLXVI]+$/.test(t)) return null;
    let total = 0;
    for (let i = 0; i < t.length; i++) {
        const v = ROMAN.find(([, r]) => r.length === 1 && r === t[i])![0];
        const nx = i + 1 < t.length ? ROMAN.find(([, r]) => r.length === 1 && r === t[i + 1])![0] : 0;
        total += v < nx ? -v : v;
    }
    if (total < 1 || total > 3999 || toRoman(BigInt(total)) !== t) return null;
    return BigInt(total);
}

const customBase = ref(36);
const value = ref<bigint>(0n);
const texts = reactive<Record<FieldId, string>>({ bin: "", oct: "", dec: "", hex: "", custom: "", roman: "" });
const invalid = reactive<Record<FieldId, boolean>>({ bin: false, oct: false, dec: false, hex: false, custom: false, roman: false });
const empty = ref(false);

const baseOf = (id: FieldId) => (id === "bin" ? 2 : id === "oct" ? 8 : id === "dec" ? 10 : id === "hex" ? 16 : customBase.value);

function fmt(n: bigint, base: number) {
    return n.toString(base);
}

function sync(except?: FieldId) {
    const n = value.value;
    for (const id of ["bin", "oct", "dec", "hex", "custom"] as const) {
        if (id !== except) texts[id] = id === "hex" || id === "custom" ? fmt(n, baseOf(id)).toUpperCase() : fmt(n, baseOf(id));
        invalid[id] = false;
    }
    if (except !== "roman") texts.roman = toRoman(n);
    invalid.roman = false;
    empty.value = false;
}

function onInput(id: FieldId) {
    const raw = texts[id];
    if (!raw.trim()) {
        empty.value = true;
        for (const k of Object.keys(texts) as FieldId[]) if (k !== id) { texts[k] = ""; }
        for (const k of Object.keys(invalid) as FieldId[]) invalid[k] = false;
        value.value = 0n;
        return;
    }
    const n = id === "roman" ? fromRoman(raw) : parseBig(raw, baseOf(id));
    if (n === null) { invalid[id] = true; return; }
    value.value = n;
    sync(id);
}

watch(customBase, (b) => {
    if (!b || b < 2 || b > 36) return;
    if (!empty.value) { texts.custom = fmt(value.value, b).toUpperCase(); invalid.custom = false; }
});

value.value = 255n;
sync();

const fields = computed(() => [
    { id: "bin" as const, label: "Binary (2)", ph: "0b1010" },
    { id: "oct" as const, label: "Octal (8)", ph: "0o755" },
    { id: "dec" as const, label: "Decimal (10)", ph: "255" },
    { id: "hex" as const, label: "Hexadecimal (16)", ph: "0xFF" },
]);

// Two's complement & bit grid
const width = ref<8 | 16 | 32 | 64>(32);
const widthOptions = [8, 16, 32, 64].map((w) => ({ value: w as 8 | 16 | 32 | 64, label: `${w}-bit` }));
const signed = ref(false);

const fits = computed(() => {
    const w = BigInt(width.value);
    return value.value >= -(1n << (w - 1n)) && value.value < 1n << w;
});
const unsigned = computed(() => BigInt.asUintN(width.value, value.value));
const signedVal = computed(() => BigInt.asIntN(width.value, value.value));
const bitStr = computed(() => unsigned.value.toString(2).padStart(width.value, "0"));
const hexStr = computed(() => unsigned.value.toString(16).toUpperCase().padStart(width.value / 4, "0"));
const bitRows = computed(() => {
    const bits = bitStr.value.split("");
    const rows: { bit: string; index: number }[][] = [];
    for (let i = 0; i < bits.length; i += 8) {
        rows.push(bits.slice(i, i + 8).map((bit, j) => ({ bit, index: width.value - 1 - (i + j) })));
    }
    return rows;
});

function toggle(index: number) {
    const u = unsigned.value ^ (1n << BigInt(index));
    value.value = signed.value ? BigInt.asIntN(width.value, u) : u;
    sync();
}

const roman = computed(() => toRoman(value.value));
</script>

<template>
    <ToolPage>
        <Panel title="Number">
            <div class="grid gap-4 sm:grid-cols-2">
                <label v-for="f in fields" :key="f.id" class="block min-w-0">
                    <span class="label">{{ f.label }}</span>
                    <div class="flex gap-1">
                        <input v-model="texts[f.id]" class="input min-w-0 flex-1 font-mono" :class="invalid[f.id] ? 'border-danger' : ''" :placeholder="f.ph" spellcheck="false" autocomplete="off" @input="onInput(f.id)" />
                        <CopyButton :text="texts[f.id]" icon-only />
                    </div>
                    <span v-if="invalid[f.id]" class="mt-1 block text-xs text-danger">Not a valid base-{{ baseOf(f.id) }} number</span>
                </label>

                <div class="block min-w-0">
                    <span class="label flex items-center gap-2">
                        Custom base
                        <input v-model.number="customBase" type="number" min="2" max="36" class="input !h-7 w-16 !px-2 text-xs" aria-label="Custom base" />
                    </span>
                    <div class="flex gap-1">
                        <input v-model="texts.custom" class="input min-w-0 flex-1 font-mono" :class="invalid.custom ? 'border-danger' : ''" :disabled="!(customBase >= 2 && customBase <= 36)" spellcheck="false" autocomplete="off" aria-label="Custom base value" @input="onInput('custom')" />
                        <CopyButton :text="texts.custom" icon-only />
                    </div>
                    <span v-if="invalid.custom" class="mt-1 block text-xs text-danger">Not a valid base-{{ customBase }} number</span>
                    <span v-else-if="!(customBase >= 2 && customBase <= 36)" class="mt-1 block text-xs text-danger">Base must be 2–36</span>
                </div>

                <label class="block min-w-0">
                    <span class="label">Roman numeral (1–3999)</span>
                    <div class="flex gap-1">
                        <input v-model="texts.roman" class="input min-w-0 flex-1 font-mono" :class="invalid.roman ? 'border-danger' : ''" placeholder="CCLV" spellcheck="false" autocomplete="off" @input="onInput('roman')" />
                        <CopyButton :text="texts.roman" icon-only />
                    </div>
                    <span v-if="invalid.roman" class="mt-1 block text-xs text-danger">Not a valid Roman numeral</span>
                    <span v-else-if="!roman && !empty" class="mt-1 block text-xs text-muted">Only 1–3999 can be written in Roman numerals</span>
                </label>
            </div>
            <p class="mt-3 text-xs text-muted">Accepts <span class="kbd">0x</span> <span class="kbd">0b</span> <span class="kbd">0o</span> prefixes, underscores and a leading minus. Arbitrarily large values are supported.</p>
        </Panel>

        <Panel title="Two's complement & bits">
            <template #actions>
                <Tabs v-model="width" size="sm" :options="widthOptions" />
            </template>
            <div class="space-y-4">
                <div v-if="!fits" class="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">Value does not fit in {{ width }} bits; showing the low {{ width }} bits.</div>
                <div class="grid gap-3 text-sm sm:grid-cols-2">
                    <div><div class="text-xs text-muted">Binary</div><div class="font-mono break-all">{{ bitStr }}</div></div>
                    <div><div class="text-xs text-muted">Hex</div><div class="font-mono">0x{{ hexStr }}</div></div>
                    <div><div class="text-xs text-muted">Unsigned</div><div class="font-mono break-all">{{ unsigned }}</div></div>
                    <div><div class="text-xs text-muted">Signed (two's complement)</div><div class="font-mono break-all">{{ signedVal }}</div></div>
                </div>
                <div>
                    <div class="mb-2 flex items-center justify-between gap-2">
                        <span class="text-xs text-muted">Click a bit to toggle it</span>
                        <label class="flex items-center gap-2 text-xs"><input v-model="signed" type="checkbox" class="checkbox" /> Treat as signed</label>
                    </div>
                    <div class="space-y-1.5 overflow-x-auto">
                        <div v-for="(row, ri) in bitRows" :key="ri" class="flex gap-1">
                            <button
                                v-for="b in row"
                                :key="b.index"
                                type="button"
                                class="flex h-9 min-w-8 flex-1 cursor-pointer flex-col items-center justify-center rounded-md border font-mono text-sm leading-none transition"
                                :class="b.bit === '1' ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-subtle text-muted hover:text-fg'"
                                :aria-label="`Bit ${b.index}: ${b.bit}`"
                                :aria-pressed="b.bit === '1'"
                                @click="toggle(b.index)"
                            >
                                {{ b.bit }}
                                <span class="mt-0.5 text-[8px] opacity-70">{{ b.index }}</span>
                            </button>
                        </div>
                    </div>
                </div>
                <Btn size="sm" variant="secondary" @click="() => { value = 0n; sync(); }">Reset to 0</Btn>
            </div>
        </Panel>
    </ToolPage>
</template>
