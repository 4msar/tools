<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Download } from "lucide-vue-next";
import QRCode from "qrcode";
import { Btn, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";

type Kind = "text" | "wifi" | "email" | "phone" | "sms" | "vcard";
const kind = ref<Kind>("text");

const text = ref("https://example.com");
const wifi = ref({ ssid: "", password: "", security: "WPA" as "WPA" | "WEP" | "nopass", hidden: false });
const email = ref({ to: "", subject: "", body: "" });
const phone = ref("");
const sms = ref({ number: "", message: "" });
const vc = ref({ first: "", last: "", org: "", title: "", phone: "", email: "", url: "" });

const size = ref(256);
const margin = ref(2);
const level = ref<"L" | "M" | "Q" | "H">("M");
const fg = ref("#000000");
const bg = ref("#ffffff");

const wesc = (s: string) => s.replace(/([\;,:"])/g, "\\$1");
const vesc = (s: string) => s.replace(/([\;,])/g, "\\$1").replace(/\n/g, "\\n");

const payload = computed(() => {
    switch (kind.value) {
        case "text": return text.value;
        case "wifi": {
            const w = wifi.value;
            if (!w.ssid) return "";
            return `WIFI:T:${w.security};S:${wesc(w.ssid)};${w.security === "nopass" ? "" : `P:${wesc(w.password)};`}${w.hidden ? "H:true;" : ""};`;
        }
        case "email": {
            const e = email.value;
            if (!e.to) return "";
            const q = [e.subject && `subject=${encodeURIComponent(e.subject)}`, e.body && `body=${encodeURIComponent(e.body)}`].filter(Boolean).join("&");
            return `mailto:${e.to}${q ? "?" + q : ""}`;
        }
        case "phone": return phone.value ? `tel:${phone.value.replace(/\s+/g, "")}` : "";
        case "sms": return sms.value.number ? `SMSTO:${sms.value.number.replace(/\s+/g, "")}:${sms.value.message}` : "";
        default: {
            const c = vc.value;
            if (!c.first && !c.last && !c.org) return "";
            return [
                "BEGIN:VCARD", "VERSION:3.0",
                `N:${vesc(c.last)};${vesc(c.first)};;;`,
                `FN:${vesc([c.first, c.last].filter(Boolean).join(" "))}`,
                c.org && `ORG:${vesc(c.org)}`,
                c.title && `TITLE:${vesc(c.title)}`,
                c.phone && `TEL:${vesc(c.phone)}`,
                c.email && `EMAIL:${vesc(c.email)}`,
                c.url && `URL:${c.url}`,
                "END:VCARD",
            ].filter(Boolean).join("\n");
        }
    }
});

const canvas = ref<HTMLCanvasElement | null>(null);
const error = ref("");

const opts = computed(() => ({
    width: Math.min(2048, Math.max(64, Number(size.value) || 256)),
    margin: Math.min(20, Math.max(0, Math.floor(Number(margin.value)) || 0)),
    errorCorrectionLevel: level.value,
    color: { dark: fg.value, light: bg.value },
}));

async function draw() {
    const c = canvas.value;
    if (!c) return;
    error.value = "";
    const ctx = c.getContext("2d");
    if (!payload.value) {
        ctx?.clearRect(0, 0, c.width, c.height);
        return;
    }
    try {
        await QRCode.toCanvas(c, payload.value, opts.value);
    } catch (e) {
        error.value = e instanceof Error ? e.message : "Could not generate QR code.";
    }
}
watch([payload, opts], draw, { deep: true });
onMounted(draw);

function downloadPng() {
    canvas.value?.toBlob((b) => b && downloadBlob(b, "qrcode.png", "image/png"));
}
async function downloadSvg() {
    try {
        const svg = await QRCode.toString(payload.value, { ...opts.value, type: "svg" });
        downloadBlob(svg, "qrcode.svg", "image/svg+xml");
    } catch { /* shown by draw */ }
}

const kinds = [
    { value: "text", label: "Text / URL" }, { value: "wifi", label: "Wi-Fi" }, { value: "email", label: "Email" },
    { value: "phone", label: "Phone" }, { value: "sms", label: "SMS" }, { value: "vcard", label: "vCard" },
] as const;
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="kind" :options="[...kinds]" size="sm" />
        </template>

        <div class="grid gap-4 lg:grid-cols-2">
            <div class="space-y-4">
                <Panel title="Content">
                    <div class="space-y-3">
                        <Field v-if="kind === 'text'" label="Text or URL">
                            <textarea v-model="text" rows="4" class="input" placeholder="https://example.com" spellcheck="false" />
                        </Field>

                        <template v-else-if="kind === 'wifi'">
                            <Field label="Network name (SSID)"><input v-model="wifi.ssid" class="input" /></Field>
                            <Field label="Security">
                                <select v-model="wifi.security" class="select">
                                    <option value="WPA">WPA/WPA2/WPA3</option>
                                    <option value="WEP">WEP</option>
                                    <option value="nopass">None</option>
                                </select>
                            </Field>
                            <Field v-if="wifi.security !== 'nopass'" label="Password"><input v-model="wifi.password" class="input" autocomplete="off" /></Field>
                            <label class="flex items-center gap-2 text-sm"><input v-model="wifi.hidden" type="checkbox" class="checkbox" /> Hidden network</label>
                        </template>

                        <template v-else-if="kind === 'email'">
                            <Field label="To"><input v-model="email.to" type="email" class="input" placeholder="name@example.com" /></Field>
                            <Field label="Subject"><input v-model="email.subject" class="input" /></Field>
                            <Field label="Body"><textarea v-model="email.body" rows="3" class="input" /></Field>
                        </template>

                        <Field v-else-if="kind === 'phone'" label="Phone number"><input v-model="phone" type="tel" class="input" placeholder="+1 555 123 4567" /></Field>

                        <template v-else-if="kind === 'sms'">
                            <Field label="Phone number"><input v-model="sms.number" type="tel" class="input" placeholder="+1 555 123 4567" /></Field>
                            <Field label="Message"><textarea v-model="sms.message" rows="3" class="input" /></Field>
                        </template>

                        <template v-else>
                            <div class="grid gap-3 sm:grid-cols-2">
                                <Field label="First name"><input v-model="vc.first" class="input" /></Field>
                                <Field label="Last name"><input v-model="vc.last" class="input" /></Field>
                                <Field label="Organization"><input v-model="vc.org" class="input" /></Field>
                                <Field label="Job title"><input v-model="vc.title" class="input" /></Field>
                                <Field label="Phone"><input v-model="vc.phone" type="tel" class="input" /></Field>
                                <Field label="Email"><input v-model="vc.email" type="email" class="input" /></Field>
                            </div>
                            <Field label="Website"><input v-model="vc.url" class="input" placeholder="https://" /></Field>
                        </template>
                    </div>
                </Panel>

                <Panel title="Options">
                    <div class="grid gap-3 sm:grid-cols-2">
                        <Field label="Size (px)"><input v-model.number="size" type="number" min="64" max="2048" step="16" class="input" /></Field>
                        <Field label="Margin (modules)"><input v-model.number="margin" type="number" min="0" max="20" class="input" /></Field>
                        <Field label="Error correction">
                            <select v-model="level" class="select">
                                <option value="L">L – 7%</option>
                                <option value="M">M – 15%</option>
                                <option value="Q">Q – 25%</option>
                                <option value="H">H – 30%</option>
                            </select>
                        </Field>
                        <div class="grid grid-cols-2 gap-3">
                            <Field label="Foreground"><input v-model="fg" type="color" class="input h-9 cursor-pointer p-1" /></Field>
                            <Field label="Background"><input v-model="bg" type="color" class="input h-9 cursor-pointer p-1" /></Field>
                        </div>
                    </div>
                </Panel>
            </div>

            <Panel title="Preview">
                <template #actions>
                    <CopyButton :text="payload" label="Copy payload" />
                </template>
                <div class="flex flex-col items-center gap-4">
                    <Notice v-if="error" type="error" class="w-full">{{ error }}</Notice>
                    <div v-if="!payload" class="py-16 text-sm text-muted">Fill in the content to generate a QR code.</div>
                    <div class="max-w-full overflow-auto rounded-lg border border-line p-2" :class="payload ? '' : 'hidden'">
                        <canvas ref="canvas" class="mx-auto block h-auto max-w-full" style="image-rendering: pixelated" />
                    </div>
                    <div class="flex flex-wrap justify-center gap-2">
                        <Btn variant="primary" :disabled="!payload || !!error" @click="downloadPng"><Download /> PNG</Btn>
                        <Btn :disabled="!payload || !!error" @click="downloadSvg"><Download /> SVG</Btn>
                    </div>
                    <pre v-if="payload" class="max-h-40 w-full overflow-auto rounded-lg bg-subtle p-3 font-mono text-xs break-all whitespace-pre-wrap">{{ payload }}</pre>
                </div>
            </Panel>
        </div>
    </ToolPage>
</template>
