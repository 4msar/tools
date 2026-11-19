<script setup lang="ts">
import { computed, ref } from "vue";
import { useStorage } from "@vueuse/core";
import { Download, RefreshCw } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

interface Brand {
    id: string;
    name: string;
    prefixes: [number, number][];
    length: number;
    cvv: number;
    detect: RegExp;
    lengths: number[];
    groups: number[];
}

const brands: Brand[] = [
    { id: "visa", name: "Visa", prefixes: [[4, 4]], length: 16, cvv: 3, detect: /^4/, lengths: [13, 16, 19], groups: [4, 4, 4, 4] },
    {
        id: "mastercard",
        name: "Mastercard",
        prefixes: [[51, 55], [2221, 2720]],
        length: 16,
        cvv: 3,
        detect: /^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d\d|27[01]\d|2720)/,
        lengths: [16],
        groups: [4, 4, 4, 4],
    },
    { id: "amex", name: "American Express", prefixes: [[34, 34], [37, 37]], length: 15, cvv: 4, detect: /^3[47]/, lengths: [15], groups: [4, 6, 5] },
    { id: "discover", name: "Discover", prefixes: [[6011, 6011], [644, 649], [65, 65]], length: 16, cvv: 3, detect: /^(6011|64[4-9]|65)/, lengths: [16, 17, 18, 19], groups: [4, 4, 4, 4] },
    { id: "jcb", name: "JCB", prefixes: [[3528, 3589]], length: 16, cvv: 3, detect: /^35(2[89]|[3-8]\d)/, lengths: [16, 17, 18, 19], groups: [4, 4, 4, 4] },
    { id: "diners", name: "Diners Club", prefixes: [[300, 305], [36, 36], [38, 38]], length: 14, cvv: 3, detect: /^(30[0-5]|36|38)/, lengths: [14, 15, 16, 17, 18, 19], groups: [4, 6, 4] },
    { id: "unionpay", name: "UnionPay", prefixes: [[62, 62]], length: 16, cvv: 3, detect: /^62/, lengths: [16, 17, 18, 19], groups: [4, 4, 4, 4] },
    {
        id: "maestro",
        name: "Maestro",
        prefixes: [[5018, 5018], [5020, 5020], [5038, 5038], [6304, 6304], [6759, 6759], [6761, 6763]],
        length: 16,
        cvv: 3,
        detect: /^(5018|5020|5038|6304|6759|676[1-3])/,
        lengths: [12, 13, 14, 15, 16, 17, 18, 19],
        groups: [4, 4, 4, 4],
    },
];
const brandById = new Map(brands.map((b) => [b.id, b]));
// Detection order matters: more specific patterns first.
const detectOrder = ["amex", "mastercard", "diners", "jcb", "discover", "unionpay", "maestro", "visa"];

const firstNames = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Avery", "Quinn", "Parker", "Sam", "Robin", "Drew", "Skyler", "Reese", "Cameron"];
const lastNames = ["Smith", "Johnson", "Lee", "Garcia", "Brown", "Davis", "Miller", "Wilson", "Moore", "Clark", "Lewis", "Walker", "Hall", "Young", "King", "Wright"];

interface Card { brand: string; number: string; expiry?: string; cvv?: string; name?: string }

function rnd(n: number) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return (a[0] as number) % n;
}

function luhnSum(d: string, startDouble: boolean) {
    let total = 0;
    let dbl = startDouble;
    for (let i = d.length - 1; i >= 0; i--) {
        let n = d.charCodeAt(i) - 48;
        if (dbl) {
            n *= 2;
            if (n > 9) n -= 9;
        }
        total += n;
        dbl = !dbl;
    }
    return total;
}

function makeNumber(b: Brand) {
    const range = b.prefixes[rnd(b.prefixes.length)] as [number, number];
    let s = String(range[0] + rnd(range[1] - range[0] + 1));
    while (s.length < b.length - 1) s += String(rnd(10));
    const check = (10 - (luhnSum(s, true) % 10)) % 10;
    return s + check;
}

const brandSel = useStorage("tools:card:brand", "visa");
const qty = useStorage("tools:card:qty", 5);
const withExpiry = useStorage("tools:card:expiry", true);
const withCvv = useStorage("tools:card:cvv", true);
const withName = useStorage("tools:card:name", false);
const group = useStorage("tools:card:group", false);
const format = useStorage<"list" | "json" | "csv">("tools:card:format", "list");

const cards = ref<Card[]>([]);

function regen() {
    const q = Math.min(100, Math.max(1, Math.floor(Number(qty.value) || 1)));
    const out: Card[] = [];
    for (let i = 0; i < q; i++) {
        const b = (brandSel.value === "random" ? brands[rnd(brands.length)] : brandById.get(brandSel.value) ?? brands[0]) as Brand;
        const c: Card = { brand: b.name, number: makeNumber(b) };
        if (withExpiry.value) c.expiry = `${String(rnd(12) + 1).padStart(2, "0")}/${String((new Date().getFullYear() + 1 + rnd(5)) % 100).padStart(2, "0")}`;
        if (withCvv.value) c.cvv = Array.from({ length: b.cvv }, () => rnd(10)).join("");
        if (withName.value) c.name = `${firstNames[rnd(firstNames.length)]} ${lastNames[rnd(lastNames.length)]}`.toUpperCase();
        out.push(c);
    }
    cards.value = out;
}
regen();

function detect(digits: string) {
    for (const id of detectOrder) {
        const b = brandById.get(id) as Brand;
        if (b.detect.test(digits)) return b;
    }
    return null;
}

function fmt(num: string) {
    if (!group.value) return num;
    const b = detect(num);
    const g = b?.groups ?? [4, 4, 4, 4];
    const parts: string[] = [];
    let p = 0;
    for (const n of g) {
        if (p >= num.length) break;
        parts.push(num.slice(p, p + n));
        p += n;
    }
    if (p < num.length) parts.push(num.slice(p));
    return parts.join(" ");
}

const output = computed(() => {
    const list = cards.value;
    if (format.value === "json") return JSON.stringify(list.map((c) => ({ ...c })), null, 2);
    if (format.value === "csv") {
        const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
        const head = ["brand", "number", ...(withExpiry.value ? ["expiry"] : []), ...(withCvv.value ? ["cvv"] : []), ...(withName.value ? ["name"] : [])];
        const rows = list.map((c) => [c.brand, c.number, ...(withExpiry.value ? [c.expiry ?? ""] : []), ...(withCvv.value ? [c.cvv ?? ""] : []), ...(withName.value ? [c.name ?? ""] : [])].map(q).join(","));
        return [head.join(","), ...rows].join("\n");
    }
    return list.map((c) => [fmt(c.number), c.expiry, c.cvv, c.name].filter(Boolean).join(" | ")).join("\n");
});

function download() {
    const ext = format.value === "list" ? "txt" : format.value;
    const type = format.value === "json" ? "application/json" : format.value === "csv" ? "text/csv" : "text/plain";
    const url = URL.createObjectURL(new Blob([output.value], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-cards.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
}

// Validator
const checkInput = ref("4111 1111 1111 1111");
const check = computed(() => {
    const raw = checkInput.value.trim();
    if (!raw) return null;
    if (/[^\d\s-]/.test(raw)) return { error: "Only digits, spaces and dashes are allowed." };
    const d = raw.replace(/[\s-]/g, "");
    if (!d) return null;
    const b = detect(d);
    return { digits: d, brand: b?.name ?? "Unknown", luhn: d.length > 1 && luhnSum(d, false) % 10 === 0, lengthOk: b ? b.lengths.includes(d.length) : d.length >= 12 && d.length <= 19 };
});
</script>

<template>
    <ToolPage>
        <Notice type="warning">
            For testing only. These numbers are generated locally, only satisfy the Luhn checksum and brand prefix rules, and are not real accounts. They cannot be used to make payments. For payment-provider sandboxes, use that provider's published test cards.
        </Notice>

        <div class="grid gap-4 lg:grid-cols-[20rem_1fr]">
            <Panel title="Options">
                <div class="space-y-3">
                    <Field label="Brand">
                        <select v-model="brandSel" class="select">
                            <option value="random">Mixed (random brands)</option>
                            <option v-for="b in brands" :key="b.id" :value="b.id">{{ b.name }}</option>
                        </select>
                    </Field>
                    <Field label="Quantity (1-100)">
                        <input v-model.number="qty" type="number" min="1" max="100" class="input" />
                    </Field>
                    <div class="space-y-2 text-sm">
                        <label class="flex cursor-pointer items-center gap-2"><input v-model="withExpiry" type="checkbox" class="checkbox" /> Expiry date (future MM/YY)</label>
                        <label class="flex cursor-pointer items-center gap-2"><input v-model="withCvv" type="checkbox" class="checkbox" /> CVV (4 digits for Amex, else 3)</label>
                        <label class="flex cursor-pointer items-center gap-2"><input v-model="withName" type="checkbox" class="checkbox" /> Fake cardholder name</label>
                        <label class="flex cursor-pointer items-center gap-2"><input v-model="group" type="checkbox" class="checkbox" /> Group digits with spaces</label>
                    </div>
                    <Btn variant="primary" class="w-full" @click="regen"><RefreshCw /> Generate</Btn>
                </div>
            </Panel>

            <Panel title="Output" flush>
                <template #actions>
                    <Tabs v-model="format" size="sm" :options="[{ value: 'list', label: 'List' }, { value: 'json', label: 'JSON' }, { value: 'csv', label: 'CSV' }]" />
                    <CopyButton :text="output" label="Copy all" />
                    <Btn size="sm" variant="ghost" @click="download"><Download /> Download</Btn>
                </template>
                <CodeArea :model-value="output" readonly height="12rem" :wrap="false" />
            </Panel>
        </div>

        <Panel title="Cards" flush>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="text-left text-xs text-muted uppercase">
                        <tr>
                            <th class="px-4 py-2 font-medium">Brand</th>
                            <th class="px-4 py-2 font-medium">Number</th>
                            <th v-if="withExpiry" class="px-4 py-2 font-medium">Expiry</th>
                            <th v-if="withCvv" class="px-4 py-2 font-medium">CVV</th>
                            <th v-if="withName" class="px-4 py-2 font-medium">Name</th>
                            <th class="w-10 px-2 py-2" />
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-line border-t border-line">
                        <tr v-for="(c, i) in cards" :key="i + c.number">
                            <td class="px-4 py-2 whitespace-nowrap">{{ c.brand }}</td>
                            <td class="px-4 py-2 font-mono whitespace-nowrap">{{ fmt(c.number) }}</td>
                            <td v-if="withExpiry" class="px-4 py-2 font-mono">{{ c.expiry }}</td>
                            <td v-if="withCvv" class="px-4 py-2 font-mono">{{ c.cvv }}</td>
                            <td v-if="withName" class="px-4 py-2 whitespace-nowrap">{{ c.name }}</td>
                            <td class="px-2 py-1"><CopyButton :text="c.number" icon-only /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </Panel>

        <Panel title="Validator">
            <Field label="Card number" hint="Detects the brand and runs the Luhn check. Nothing leaves your browser.">
                <input v-model="checkInput" class="input font-mono" inputmode="numeric" spellcheck="false" placeholder="Enter a card number" />
            </Field>
            <div v-if="check" class="mt-3">
                <Notice v-if="'error' in check" type="error">{{ check.error }}</Notice>
                <div v-else class="space-y-2">
                    <Notice :type="check.luhn ? 'success' : 'error'">{{ check.luhn ? "Passes the Luhn check." : "Fails the Luhn check." }}</Notice>
                    <div class="flex flex-wrap gap-2 text-sm">
                        <span class="chip">Brand: {{ check.brand }}</span>
                        <span class="chip">{{ check.digits.length }} digits</span>
                        <span class="chip" :class="check.lengthOk ? '' : 'text-warn'">{{ check.lengthOk ? "Length matches brand" : "Unusual length for brand" }}</span>
                    </div>
                </div>
            </div>
        </Panel>
    </ToolPage>
</template>
