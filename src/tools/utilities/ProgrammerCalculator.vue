<script setup lang="ts">
import { computed, ref } from "vue";
import {
    CopyButton,
    Field,
    Notice,
    Panel,
    Tabs,
    ToolPage,
} from "@/components/ui";

const width = ref<8 | 16 | 32 | 64>(32);
const signed = ref(true);
const a = ref("0xFF");
const b = ref("4");

const mask = computed(() => (1n << BigInt(width.value)) - 1n);

// Accepts 255, -12, 0xFF, 0b1010, 0o17, 1_000 and 'A' (character code).
function parse(text: string): bigint | null {
    let t = text.trim().replace(/_/g, "").replace(/\s+/g, "");
    if (!t) return null;
    const ch = /^'(.)'$/u.exec(text.trim());
    if (ch) return BigInt(ch[1].codePointAt(0)!);
    let neg = false;
    if (t.startsWith("-")) {
        neg = true;
        t = t.slice(1);
    }
    if (!/^(0x[0-9a-f]+|0b[01]+|0o[0-7]+|\d+)$/i.test(t)) return null;
    try {
        const v = BigInt(t);
        return neg ? -v : v;
    } catch {
        return null;
    }
}

const wrap = (v: bigint) => v & mask.value;
const toSigned = (u: bigint) =>
    u >> BigInt(width.value - 1) ? u - (1n << BigInt(width.value)) : u;
const show = (u: bigint) => (signed.value ? toSigned(u) : u);

const pa = computed(() => parse(a.value));
const pb = computed(() => parse(b.value));
const ua = computed(() => (pa.value === null ? null : wrap(pa.value)));
const ub = computed(() => (pb.value === null ? null : wrap(pb.value)));

function overflow(p: bigint | null) {
    if (p === null) return false;
    const w = BigInt(width.value);
    return signed.value
        ? p < -(1n << (w - 1n)) || p > mask.value
        : p < 0n
          ? -p > 1n << (w - 1n)
          : p > mask.value;
}

function group(s: string, n: number, sep = " ") {
    const out: string[] = [];
    for (let i = s.length; i > 0; i -= n)
        out.unshift(s.slice(Math.max(0, i - n), i));
    return out.join(sep);
}
const hex = (u: bigint) =>
    u
        .toString(16)
        .toUpperCase()
        .padStart(width.value / 4, "0");
const bin = (u: bigint) => u.toString(2).padStart(width.value, "0");

const reps = computed(() => {
    const u = ua.value;
    if (u === null) return [];
    const ascii = (() => {
        const bytes = hex(u)
            .match(/../g)!
            .map((h) => parseInt(h, 16));
        return bytes
            .map((c) => (c >= 32 && c < 127 ? String.fromCharCode(c) : "·"))
            .join("");
    })();
    return [
        {
            k: "Decimal (signed)",
            v: toSigned(u).toString(),
            copy: toSigned(u).toString(),
        },
        { k: "Decimal (unsigned)", v: u.toString(), copy: u.toString() },
        { k: "Hex", v: "0x" + group(hex(u), 4), copy: "0x" + hex(u) },
        { k: "Octal", v: "0o" + u.toString(8), copy: "0o" + u.toString(8) },
        { k: "Binary", v: group(bin(u), 4), copy: "0b" + bin(u) },
        { k: "Bytes as ASCII", v: ascii, copy: ascii },
    ];
});

const bits = computed(() => {
    const u = ua.value ?? 0n;
    return Array.from({ length: width.value }, (_, i) => {
        const pos = width.value - 1 - i;
        return { pos, on: ((u >> BigInt(pos)) & 1n) === 1n };
    });
});
const bytes = computed(() => {
    const out: (typeof bits.value)[] = [];
    for (let i = 0; i < bits.value.length; i += 8)
        out.push(bits.value.slice(i, i + 8));
    return out;
});
const popcount = computed(() => bits.value.filter((x) => x.on).length);

const outBase = ref<"hex" | "dec">("hex");
function fmt(u: bigint) {
    return outBase.value === "hex" ? "0x" + hex(u) : show(u).toString();
}
function toggleBit(pos: number) {
    const u = (ua.value ?? 0n) ^ (1n << BigInt(pos));
    a.value = fmt(u);
}

const ops = computed(() => {
    const x = ua.value;
    const y = ub.value;
    if (x === null) return [];
    const w = BigInt(width.value);
    const rows: {
        op: string;
        label: string;
        r: bigint | null;
        note?: string;
    }[] = [
        { op: "~A", label: "NOT (one's complement)", r: wrap(~x) },
        { op: "-A", label: "Negate (two's complement)", r: wrap(-x) },
    ];
    if (y !== null) {
        const sh = y % w;
        const sx = toSigned(x);
        const sy = toSigned(y);
        const [dx, dy] = signed.value ? [sx, sy] : [x, y];
        rows.push(
            { op: "A & B", label: "AND", r: x & y },
            { op: "A | B", label: "OR", r: x | y },
            { op: "A ^ B", label: "XOR", r: x ^ y },
            { op: "A << B", label: "Shift left", r: wrap(x << sh) },
            {
                op: "A >> B",
                label: signed.value
                    ? "Arithmetic shift right"
                    : "Logical shift right",
                r: signed.value ? wrap(sx >> sh) : x >> sh,
            },
            { op: "A >>> B", label: "Logical shift right", r: x >> sh },
            {
                op: "rol(A, B)",
                label: "Rotate left",
                r: wrap((x << sh) | (x >> (w - sh))),
            },
            {
                op: "ror(A, B)",
                label: "Rotate right",
                r: wrap((x >> sh) | (x << (w - sh))),
            },
            { op: "A + B", label: "Add (wraps)", r: wrap(x + y) },
            { op: "A - B", label: "Subtract (wraps)", r: wrap(x - y) },
            { op: "A * B", label: "Multiply (wraps)", r: wrap(dx * dy) },
            {
                op: "A / B",
                label: "Integer divide",
                r: dy === 0n ? null : wrap(dx / dy),
                note: dy === 0n ? "division by zero" : undefined,
            },
            {
                op: "A % B",
                label: "Remainder",
                r: dy === 0n ? null : wrap(dx % dy),
                note: dy === 0n ? "division by zero" : undefined,
            },
        );
    }
    return rows;
});
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs
                v-model="width"
                :options="[
                    { value: 8, label: '8-bit' },
                    { value: 16, label: '16-bit' },
                    { value: 32, label: '32-bit' },
                    { value: 64, label: '64-bit' },
                ]"
            />
            <Tabs
                :model-value="signed ? 's' : 'u'"
                :options="[
                    { value: 's', label: 'Signed' },
                    { value: 'u', label: 'Unsigned' },
                ]"
                @update:model-value="signed = $event === 's'"
            />
        </template>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Operands">
                <div class="grid gap-3 sm:grid-cols-2">
                    <Field label="A">
                        <input
                            v-model="a"
                            class="input font-mono text-base"
                            :class="
                                a.trim() && pa === null ? 'border-danger!' : ''
                            "
                            spellcheck="false"
                            placeholder="0xFF"
                        />
                    </Field>
                    <Field label="B">
                        <input
                            v-model="b"
                            class="input font-mono text-base"
                            :class="
                                b.trim() && pb === null ? 'border-danger!' : ''
                            "
                            spellcheck="false"
                            placeholder="4"
                        />
                    </Field>
                </div>
                <p class="mt-2 text-xs text-muted">
                    Decimal, <code class="code">0x</code> hex,
                    <code class="code">0b</code> binary,
                    <code class="code">0o</code> octal, negative numbers and
                    <code class="code">'A'</code> characters are accepted.
                </p>
                <Notice
                    v-if="
                        (a.trim() && pa === null) || (b.trim() && pb === null)
                    "
                    type="error"
                    class="mt-3"
                    >Could not read {{ a.trim() && pa === null ? "A" : "B" }} as
                    an integer.</Notice
                >
                <Notice
                    v-else-if="overflow(pa) || overflow(pb)"
                    type="warning"
                    class="mt-3"
                    >{{ overflow(pa) ? "A" : "B" }} does not fit in {{ width }}
                    {{ signed ? "signed" : "unsigned" }} bits and was
                    truncated.</Notice
                >
            </Panel>

            <Panel title="A in every base" flush>
                <p v-if="!reps.length" class="p-4 text-sm text-muted">
                    Enter a value for A.
                </p>
                <dl v-else class="divide-y divide-line text-sm">
                    <div
                        v-for="r in reps"
                        :key="r.k"
                        class="flex items-center gap-3 px-4 py-1.5"
                    >
                        <dt class="w-36 shrink-0 text-muted">{{ r.k }}</dt>
                        <dd
                            class="min-w-0 flex-1 font-mono text-[13px] break-all"
                        >
                            {{ r.v }}
                        </dd>
                        <CopyButton :text="r.copy" icon-only />
                    </div>
                </dl>
            </Panel>
        </div>

        <Panel :title="`Bits of A (${popcount} set)`">
            <template #actions
                ><span class="text-xs text-muted"
                    >Click a bit to flip it</span
                ></template
            >
            <div class="flex flex-wrap gap-x-4 gap-y-3">
                <div v-for="(byte, bi) in bytes" :key="bi">
                    <div class="flex gap-0.5">
                        <button
                            v-for="bit in byte"
                            :key="bit.pos"
                            type="button"
                            :title="`Bit ${bit.pos}`"
                            :aria-label="`Bit ${bit.pos}: ${bit.on ? 1 : 0}`"
                            class="size-7 cursor-pointer rounded font-mono text-sm transition-colors"
                            :class="
                                bit.on
                                    ? 'bg-accent font-semibold text-accent-fg'
                                    : 'bg-subtle text-muted hover:text-fg'
                            "
                            @click="toggleBit(bit.pos)"
                        >
                            {{ bit.on ? 1 : 0 }}
                        </button>
                    </div>
                    <div
                        class="mt-1 flex justify-between px-1 font-mono text-[10px] text-muted"
                    >
                        <span>{{ byte[0].pos }}</span
                        ><span>{{ byte[7].pos }}</span>
                    </div>
                </div>
            </div>
        </Panel>

        <Panel title="Operations" flush>
            <template #actions
                ><Tabs
                    v-model="outBase"
                    size="sm"
                    :options="[
                        { value: 'hex', label: 'Hex' },
                        { value: 'dec', label: 'Decimal' },
                    ]"
            /></template>
            <p v-if="!ops.length" class="p-4 text-sm text-muted">
                Enter a value for A.
            </p>
            <div v-else class="grid sm:grid-cols-2">
                <div
                    v-for="o in ops"
                    :key="o.op"
                    class="flex items-center gap-3 border-b border-line px-4 py-2 text-sm"
                >
                    <code class="code w-24 shrink-0 text-center">{{
                        o.op
                    }}</code>
                    <span
                        class="hidden w-40 shrink-0 text-xs text-muted xl:block"
                        >{{ o.label }}</span
                    >
                    <span
                        class="min-w-0 flex-1 font-mono break-all"
                        :title="o.label"
                        >{{ o.r === null ? o.note : fmt(o.r) }}</span
                    >
                    <button
                        v-if="o.r !== null"
                        type="button"
                        class="cursor-pointer text-xs text-muted hover:text-fg"
                        title="Use as A"
                        @click="a = fmt(o.r)"
                    >
                        → A
                    </button>
                    <CopyButton
                        v-if="o.r !== null"
                        :text="fmt(o.r)"
                        icon-only
                    />
                </div>
            </div>
        </Panel>
    </ToolPage>
</template>
