<script setup lang="ts">
import { computed, ref } from "vue";
import { Btn, CopyButton, Field, Notice, Panel, ToolPage } from "@/components/ui";

const input = ref("192.168.1.10/24");
const splitTo = ref(26);
const checkIp = ref("");

function parseIp(s: string): number | null {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s.trim());
    if (!m) return null;
    const p = m.slice(1).map(Number);
    if (p.some((n) => n > 255)) return null;
    return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}
const ipStr = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
const bin = (n: number) => [24, 16, 8, 0].map((s) => ((n >>> s) & 255).toString(2).padStart(8, "0")).join(".");
const maskOf = (p: number) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);

function parseMask(s: string): number | null {
    const n = parseIp(s);
    if (n === null) return null;
    // valid if contiguous ones then zeros
    const inv = (~n) >>> 0;
    if (((inv + 1) & inv) !== 0) return null;
    return 32 - (inv === 0 ? 0 : 32 - Math.clz32(inv));
}

const parsed = computed<{ ip: number; prefix: number } | { error: string }>(() => {
    const s = input.value.trim();
    if (!s) return { error: "" };
    const [a, b, ...rest] = s.split(/[\/\s]+/);
    if (rest.length) return { error: "Unexpected extra input." };
    const ip = parseIp(a);
    if (ip === null) return { error: "Invalid IPv4 address." };
    if (b === undefined) return { ip, prefix: 32 };
    let prefix: number;
    if (/^\d{1,2}$/.test(b)) prefix = Number(b);
    else {
        const p = parseMask(b);
        if (p === null) return { error: "Invalid netmask." };
        prefix = p;
    }
    if (prefix < 0 || prefix > 32) return { error: "Prefix must be between 0 and 32." };
    return { ip, prefix };
});

function classify(ip: number): string {
    const a = ip >>> 24, b = (ip >>> 16) & 255;
    if (a === 127) return "Loopback";
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return "Private";
    if (a === 169 && b === 254) return "Link-local";
    if (a === 100 && b >= 64 && b <= 127) return "CGNAT (shared)";
    if (a >= 224 && a <= 239) return "Multicast";
    if (a >= 240) return "Reserved";
    if (a === 0) return "This network";
    return "Public";
}
const ipClass = (ip: number) => {
    const a = ip >>> 24;
    return a < 128 ? "A" : a < 192 ? "B" : a < 224 ? "C" : a < 240 ? "D (multicast)" : "E (reserved)";
};

const info = computed(() => {
    const p = parsed.value;
    if ("error" in p) return null;
    const mask = maskOf(p.prefix);
    const net = (p.ip & mask) >>> 0;
    const bc = (net | (~mask >>> 0)) >>> 0;
    const total = 2 ** (32 - p.prefix);
    let first: number, last: number, hosts: number;
    if (p.prefix === 32) { first = last = net; hosts = 1; }
    else if (p.prefix === 31) { first = net; last = bc; hosts = 2; }
    else { first = net + 1; last = bc - 1; hosts = total - 2; }
    return {
        prefix: p.prefix, ip: p.ip, mask, net, bc, first, last, hosts, total,
        wildcard: (~mask) >>> 0,
        kind: classify(net), cls: ipClass(net),
    };
});

const rows = computed(() => {
    const i = info.value;
    if (!i) return [];
    return [
        { k: "Address", v: ipStr(i.ip) },
        { k: "Network", v: `${ipStr(i.net)}/${i.prefix}` },
        { k: "Broadcast", v: i.prefix >= 31 ? "n/a" : ipStr(i.bc) },
        { k: "First host", v: ipStr(i.first) },
        { k: "Last host", v: ipStr(i.last) },
        { k: "Usable hosts", v: i.hosts.toLocaleString() },
        { k: "Total addresses", v: i.total.toLocaleString() },
        { k: "Netmask", v: ipStr(i.mask) },
        { k: "Wildcard", v: ipStr(i.wildcard) },
        { k: "Class", v: i.cls },
        { k: "Type", v: i.kind },
    ];
});

const splits = computed(() => {
    const i = info.value;
    if (!i) return null;
    const n = Math.floor(Number(splitTo.value));
    if (!(n >= i.prefix && n <= 32)) return { error: `Enter a prefix between ${i.prefix} and 32.` };
    const count = 2 ** (n - i.prefix);
    const size = 2 ** (32 - n);
    const list: string[] = [];
    for (let k = 0; k < Math.min(count, 256); k++) list.push(`${ipStr((i.net + k * size) >>> 0)}/${n}`);
    return { list, count, size };
});

const inRange = computed(() => {
    const i = info.value;
    if (!i || !checkIp.value.trim()) return null;
    const ip = parseIp(checkIp.value);
    if (ip === null) return "invalid" as const;
    return ip >= i.net && ip <= i.bc;
});

const examples = ["192.168.1.10/24", "10.0.0.0/8", "172.16.5.4 255.255.240.0", "100.64.0.1/10"];
</script>

<template>
    <ToolPage>
        <Panel title="IPv4 address / CIDR">
            <div class="flex flex-wrap items-end gap-3">
                <Field label="Address with prefix or mask" class="min-w-60 flex-1">
                    <input v-model="input" class="input font-mono" placeholder="192.168.1.10/24 or 192.168.1.10 255.255.255.0" spellcheck="false" />
                </Field>
            </div>
            <div class="mt-3 flex flex-wrap gap-1.5">
                <button v-for="e in examples" :key="e" type="button" class="chip cursor-pointer hover:bg-subtle" @click="input = e">{{ e }}</button>
            </div>
            <Notice v-if="'error' in parsed && parsed.error" type="error" class="mt-3">{{ parsed.error }}</Notice>
        </Panel>

        <template v-if="info">
            <div class="grid gap-4 lg:grid-cols-2">
                <Panel title="Details" flush>
                    <ul class="divide-y divide-line">
                        <li v-for="r in rows" :key="r.k" class="flex items-center gap-2 px-4 py-2">
                            <span class="w-32 shrink-0 text-sm text-muted">{{ r.k }}</span>
                            <span class="min-w-0 flex-1 font-mono text-sm break-all">{{ r.v }}</span>
                            <CopyButton :text="r.v" icon-only />
                        </li>
                    </ul>
                </Panel>

                <div class="space-y-4">
                    <Panel title="Binary">
                        <dl class="space-y-2 font-mono text-xs break-all sm:text-[13px]">
                            <div><dt class="label">Address</dt><dd>{{ bin(info.ip) }}</dd></div>
                            <div><dt class="label">Netmask</dt><dd>{{ bin(info.mask) }}</dd></div>
                            <div><dt class="label">Network</dt><dd>{{ bin(info.net) }}</dd></div>
                            <div><dt class="label">Broadcast</dt><dd>{{ bin(info.bc) }}</dd></div>
                        </dl>
                    </Panel>

                    <Panel title="Is IP in range?">
                        <input v-model="checkIp" class="input font-mono" placeholder="e.g. 192.168.1.200" spellcheck="false" />
                        <div v-if="inRange !== null" class="mt-3">
                            <Notice v-if="inRange === 'invalid'" type="error">Invalid IPv4 address.</Notice>
                            <Notice v-else-if="inRange" type="success">{{ checkIp.trim() }} is inside {{ ipStr(info.net) }}/{{ info.prefix }}.</Notice>
                            <Notice v-else type="warning">{{ checkIp.trim() }} is outside {{ ipStr(info.net) }}/{{ info.prefix }}.</Notice>
                        </div>
                    </Panel>
                </div>
            </div>

            <Panel title="Subnet splitter">
                <template #actions>
                    <CopyButton v-if="splits && !('error' in splits)" :text="splits.list.join('\n')" label="Copy list" />
                </template>
                <div class="flex flex-wrap items-end gap-3">
                    <Field label="Split into /N">
                        <input v-model.number="splitTo" type="number" :min="info.prefix" max="32" class="input w-28" />
                    </Field>
                    <Btn v-if="info.prefix < 32" size="sm" variant="ghost" @click="splitTo = Math.min(32, info.prefix + 1)">/{{ Math.min(32, info.prefix + 1) }}</Btn>
                    <Btn v-if="info.prefix < 31" size="sm" variant="ghost" @click="splitTo = Math.min(32, info.prefix + 2)">/{{ Math.min(32, info.prefix + 2) }}</Btn>
                </div>
                <Notice v-if="splits && 'error' in splits" type="error" class="mt-3">{{ splits.error }}</Notice>
                <template v-else-if="splits">
                    <p class="mt-3 text-sm text-muted">
                        {{ splits.count.toLocaleString() }} subnet{{ splits.count === 1 ? "" : "s" }} of {{ splits.size.toLocaleString() }} address{{ splits.size === 1 ? "" : "es" }}
                        <span v-if="splits.count > 256">(showing first 256)</span>
                    </p>
                    <ul class="mt-2 grid max-h-80 gap-1 overflow-auto font-mono text-sm sm:grid-cols-2 lg:grid-cols-3">
                        <li v-for="s in splits.list" :key="s" class="rounded bg-subtle px-2 py-1">{{ s }}</li>
                    </ul>
                </template>
            </Panel>
        </template>
    </ToolPage>
</template>
