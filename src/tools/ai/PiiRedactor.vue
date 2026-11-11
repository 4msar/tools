<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ClipboardPaste, FileText, Trash2 } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { readClipboard } from "@/composables/useClipboard";

interface Category {
    id: string;
    label: string;
    tag: string;
    re: RegExp;
    /** Index of the capture group to mask (default: whole match). */
    group?: number;
    validate?: (value: string) => boolean;
}

function luhn(value: string): boolean {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let n = Number(digits[i]);
        if (alt) {
            n *= 2;
            if (n > 9) n -= 9;
        }
        sum += n;
        alt = !alt;
    }
    return sum % 10 === 0;
}

function ibanValid(value: string): boolean {
    const iban = value.replace(/\s/g, "").toUpperCase();
    if (iban.length < 15 || iban.length > 34) return false;
    const rearranged = iban.slice(4) + iban.slice(0, 4);
    let rem = 0;
    for (const ch of rearranged) {
        const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
        for (const d of v) rem = (rem * 10 + Number(d)) % 97;
    }
    return rem === 1;
}

// Order = priority when matches overlap (earlier wins).
const CATEGORIES: Category[] = [
    { id: "privateKey", label: "Private key blocks", tag: "PRIVATE_KEY", re: /-----BEGIN [A-Z ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY(?: BLOCK)?-----/g },
    { id: "urlCreds", label: "URLs with credentials", tag: "URL_WITH_CREDENTIALS", re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@[^\s"'<>]+/gi },
    { id: "jwt", label: "JWTs", tag: "JWT", re: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g },
    { id: "aws", label: "AWS access keys", tag: "AWS_KEY", re: /\b(?:AKIA|ASIA|AGPA|AIDA|AROA)[A-Z0-9]{16}\b/g },
    { id: "github", label: "GitHub tokens", tag: "GITHUB_TOKEN", re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,255}|github_pat_[A-Za-z0-9_]{22,255})\b/g },
    { id: "anthropic", label: "Anthropic keys", tag: "ANTHROPIC_KEY", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
    { id: "openai", label: "OpenAI keys", tag: "OPENAI_KEY", re: /\bsk-(?!ant-)(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g },
    { id: "slack", label: "Slack tokens", tag: "SLACK_TOKEN", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}|\bxapp-[A-Za-z0-9-]{10,}/g },
    { id: "stripe", label: "Stripe keys", tag: "STRIPE_KEY", re: /\b(?:[sprk]k_(?:live|test)|whsec)_[A-Za-z0-9]{10,}/g },
    { id: "secret", label: "password= / secret: / api_key= values", tag: "SECRET", re: /\b(?:password|passwd|pwd|passphrase|secret|client_secret|api[_-]?key|access[_-]?key|auth[_-]?token|token)\b["']?\s*[:=]\s*["']?([^\s"',;]{3,})/gi, group: 1 },
    { id: "iban", label: "IBANs", tag: "IBAN", re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/g, validate: ibanValid },
    { id: "ssn", label: "US SSNs", tag: "SSN", re: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g },
    { id: "card", label: "Credit cards (Luhn)", tag: "CARD", re: /\b\d(?:[ -]?\d){12,18}\b/g, validate: luhn },
    { id: "email", label: "Emails", tag: "EMAIL", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
    { id: "ipv6", label: "IPv6 addresses", tag: "IPV6", re: /(?<![\w:])(?:(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}|(?:[A-Fa-f0-9]{1,4}:){1,7}:(?:[A-Fa-f0-9]{1,4}(?::[A-Fa-f0-9]{1,4}){0,6})?|::(?:[A-Fa-f0-9]{1,4}:){0,6}[A-Fa-f0-9]{1,4})(?![\w:])/g },
    { id: "ipv4", label: "IPv4 addresses", tag: "IPV4", re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g },
    {
        id: "phone", label: "Phone numbers", tag: "PHONE",
        re: /(?<![\w.])\+?\d[\d\s().-]{7,}\d(?![\w])/g,
        validate: (v) => {
            const digits = v.replace(/\D/g, "").length;
            return digits >= 9 && digits <= 15 && (v.startsWith("+") || /[\s().-]/.test(v));
        },
    },
];

const enabled = reactive<Record<string, boolean>>(Object.fromEntries(CATEGORIES.map((c) => [c.id, true])));

const mode = ref<"redact" | "restore">("redact");
const style = ref<"placeholder" | "asterisks">("placeholder");
const input = ref("");
const reply = ref("");

const SAMPLE = `Hi team, please debug this for user jane.doe@example.com (phone +1 (415) 555-0132, SSN 123-45-6789).
Server 192.168.10.24 / 2001:db8::8a2e:370:7334 fails with:
  DATABASE_URL=postgres://admin:s3cr3tPass@db.internal:5432/app
  api_key = "sk-proj-abcdefghijklmnopqrstuvwxyz123456"
  AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
  token: ghp_abcdefghijklmnopqrstuvwxyz0123456789
Card on file: 4111 1111 1111 1111, IBAN DE89 3704 0044 0532 0130 00.
Contact jane.doe@example.com again if needed.`;

interface Match { start: number; end: number; cat: Category; value: string; prio: number }

const analysis = computed(() => {
    const text = input.value;
    const found: Match[] = [];
    CATEGORIES.forEach((cat, prio) => {
        if (!enabled[cat.id]) return;
        for (const m of text.matchAll(cat.re)) {
            const whole = m[0];
            const value = cat.group ? m[cat.group] : whole;
            if (!value) continue;
            if (cat.validate && !cat.validate(value)) continue;
            const start = m.index + (cat.group ? whole.lastIndexOf(value) : 0);
            found.push({ start, end: start + value.length, cat, value, prio });
        }
    });
    // Resolve overlaps by priority, then longer match first.
    found.sort((a, b) => a.prio - b.prio || b.end - b.start - (a.end - a.start));
    const picked: Match[] = [];
    for (const m of found) {
        if (!picked.some((p) => m.start < p.end && m.end > p.start)) picked.push(m);
    }
    picked.sort((a, b) => a.start - b.start);

    const counters: Record<string, number> = {};
    const byKey = new Map<string, string>();
    const mapping = new Map<string, string>(); // placeholder -> original
    const items: { placeholder: string; label: string; value: string; count: number }[] = [];
    let out = "";
    let pos = 0;
    for (const m of picked) {
        const key = m.cat.id + "\u0000" + m.value;
        let placeholder = byKey.get(key);
        if (!placeholder) {
            counters[m.cat.id] = (counters[m.cat.id] ?? 0) + 1;
            placeholder = `[${m.cat.tag}_${counters[m.cat.id]}]`;
            byKey.set(key, placeholder);
            mapping.set(placeholder, m.value);
            items.push({ placeholder, label: m.cat.label, value: m.value, count: 0 });
        }
        items.find((i) => i.placeholder === placeholder)!.count++;
        out += text.slice(pos, m.start) + (style.value === "placeholder" ? placeholder : "*".repeat(Math.max(m.value.length, 4)));
        pos = m.end;
    }
    out += text.slice(pos);
    return { out, items, mapping, total: picked.length };
});

const restored = computed(() => {
    const map = analysis.value.mapping;
    let count = 0;
    const out = reply.value.replace(/\[[A-Z0-9_]+_\d+\]/g, (tag) => {
        const v = map.get(tag);
        if (v === undefined) return tag;
        count++;
        return v;
    });
    return { out, count };
});

function mask(v: string) {
    return v.length <= 12 ? v : v.slice(0, 6) + "…" + v.slice(-4);
}

function setAll(on: boolean) {
    for (const c of CATEGORIES) enabled[c.id] = on;
}

async function pasteReply() {
    reply.value = await readClipboard();
}

async function paste() {
    input.value = await readClipboard();
}
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="mode" :options="[{ value: 'redact', label: 'Redact' }, { value: 'restore', label: 'Restore' }]" />
        </template>

        <Panel title="Detect">
            <template #actions>
                <Btn size="sm" variant="ghost" @click="setAll(true)">All</Btn>
                <Btn size="sm" variant="ghost" @click="setAll(false)">None</Btn>
            </template>
            <div class="grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <label v-for="c in CATEGORIES" :key="c.id" class="flex items-center gap-2">
                    <input v-model="enabled[c.id]" type="checkbox" class="checkbox" /> {{ c.label }}
                </label>
            </div>
            <div class="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span class="label mb-0">Replace with</span>
                <Tabs v-model="style" size="sm" :options="[{ value: 'placeholder', label: '[EMAIL_1] placeholders' }, { value: 'asterisks', label: '**** asterisks' }]" />
            </div>
        </Panel>

        <template v-if="mode === 'redact'">
            <div class="grid gap-4 lg:grid-cols-2">
                <Panel title="Original" flush>
                    <template #actions>
                        <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                        <Btn size="sm" variant="ghost" @click="input = SAMPLE"><FileText /> Sample</Btn>
                        <Btn size="sm" variant="ghost" :disabled="!input" @click="input = ''"><Trash2 /> Clear</Btn>
                    </template>
                    <CodeArea v-model="input" placeholder="Paste text, logs or code that may contain secrets…" />
                </Panel>
                <Panel title="Redacted" flush>
                    <template #actions><CopyButton :text="analysis.out" /></template>
                    <CodeArea :model-value="analysis.out" readonly placeholder="Redacted text appears here" />
                    <div class="border-t border-line px-4 py-2 text-xs text-muted">{{ analysis.total }} item{{ analysis.total === 1 ? "" : "s" }} masked</div>
                </Panel>
            </div>

            <Panel v-if="input" :title="`Found items (${analysis.items.length})`" flush>
                <Notice v-if="!analysis.items.length" type="success" class="m-4">Nothing sensitive detected with the enabled categories. Always review before sending.</Notice>
                <div v-else class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-subtle text-left text-xs text-muted uppercase">
                            <tr><th class="px-4 py-2">Placeholder</th><th class="px-4 py-2">Type</th><th class="px-4 py-2">Value</th><th class="px-4 py-2 text-right">Count</th></tr>
                        </thead>
                        <tbody>
                            <tr v-for="i in analysis.items" :key="i.placeholder" class="border-t border-line">
                                <td class="px-4 py-2 font-mono text-accent">{{ i.placeholder }}</td>
                                <td class="px-4 py-2">{{ i.label }}</td>
                                <td class="max-w-64 truncate px-4 py-2 font-mono text-muted" :title="i.value">{{ mask(i.value) }}</td>
                                <td class="px-4 py-2 text-right">{{ i.count }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Panel>
        </template>

        <template v-else>
            <Notice v-if="style === 'asterisks'" type="warning">Asterisk masking cannot be reversed. Switch to placeholders and redact first.</Notice>
            <Notice v-else-if="!analysis.mapping.size" type="info">There is no mapping yet. Redact some text in the Redact tab first; the Restore tab uses its current placeholders.</Notice>
            <div class="grid gap-4 lg:grid-cols-2">
                <Panel title="AI reply with placeholders" flush>
                    <template #actions>
                        <Btn size="sm" variant="ghost" @click="pasteReply"><ClipboardPaste /> Paste</Btn>
                        <Btn size="sm" variant="ghost" :disabled="!reply" @click="reply = ''"><Trash2 /> Clear</Btn>
                    </template>
                    <CodeArea v-model="reply" placeholder="Paste the AI reply containing [EMAIL_1] style placeholders…" />
                </Panel>
                <Panel title="Restored" flush>
                    <template #actions><CopyButton :text="restored.out" /></template>
                    <CodeArea :model-value="restored.out" readonly placeholder="Restored text appears here" />
                    <div class="border-t border-line px-4 py-2 text-xs text-muted">{{ restored.count }} placeholder{{ restored.count === 1 ? "" : "s" }} restored</div>
                </Panel>
            </div>
        </template>
    </ToolPage>
</template>
