<script setup lang="ts">
import { computed, ref } from "vue";
import { Eye, EyeOff } from "lucide-vue-next";
import { Btn, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

const mode = ref<"encode" | "decode">("encode");
const username = ref("aladdin");
const password = ref("open sesame");
const show = ref(true);
const url = ref("https://api.example.com/v1/items");
const header = ref("");

// Base64 of the UTF-8 bytes (RFC 7617).
const toB64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const token = computed(() => toB64(`${username.value}:${password.value}`));
const value = computed(() => `Basic ${token.value}`);
const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

const warning = computed(() => (username.value.includes(":") ? "A username cannot contain a colon: everything after the first colon is read as the password." : ""));

const snippets = computed(() => {
    const u = url.value.trim() || "https://api.example.com";
    return [
        { k: "Header", v: `Authorization: ${value.value}` },
        { k: "cURL", v: `curl -u ${sq(`${username.value}:${password.value}`)} ${sq(u)}` },
        { k: "cURL (header)", v: `curl -H ${sq(`Authorization: ${value.value}`)} ${sq(u)}` },
        { k: "fetch", v: `fetch(${JSON.stringify(u)}, {\n  headers: { Authorization: ${JSON.stringify(value.value)} },\n});` },
        { k: "Python", v: `import requests\n\nrequests.get(${JSON.stringify(u)}, auth=(${JSON.stringify(username.value)}, ${JSON.stringify(password.value)}))` },
        { k: "HTTPie", v: `http -a ${sq(`${username.value}:${password.value}`)} ${sq(u)}` },
    ];
});

const decoded = computed<{ user?: string; pass?: string; error?: string }>(() => {
    const raw = header.value.trim();
    if (!raw) return {};
    const t = raw.replace(/^authorization:\s*/i, "").replace(/^basic\s+/i, "").trim();
    try {
        const bytes = Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        const i = text.indexOf(":");
        if (i < 0) return { error: `Decoded to "${text}", which has no colon separating username and password.` };
        return { user: text.slice(0, i), pass: text.slice(i + 1) };
    } catch {
        return { error: "That is not a valid Base64 Basic credential." };
    }
});
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="mode" :options="[{ value: 'encode', label: 'Generate' }, { value: 'decode', label: 'Decode' }]" />
        </template>

        <template v-if="mode === 'encode'">
            <div class="grid gap-4 lg:grid-cols-[22rem_1fr]">
                <Panel title="Credentials">
                    <div class="flex flex-col gap-3">
                        <Field label="Username"><input v-model="username" class="input font-mono" spellcheck="false" autocomplete="off" /></Field>
                        <Field label="Password">
                            <div class="flex gap-2">
                                <input v-model="password" :type="show ? 'text' : 'password'" class="input font-mono" spellcheck="false" autocomplete="off" />
                                <Btn :aria-label="show ? 'Hide password' : 'Show password'" @click="show = !show"><component :is="show ? EyeOff : Eye" /></Btn>
                            </div>
                        </Field>
                        <Field label="URL for the examples"><input v-model="url" class="input font-mono" spellcheck="false" /></Field>
                        <Notice v-if="warning" type="warning">{{ warning }}</Notice>
                    </div>
                </Panel>

                <Panel title="Authorization header" flush>
                    <ul class="divide-y divide-line">
                        <li v-for="s in snippets" :key="s.k" class="flex items-start gap-3 px-4 py-2.5">
                            <span class="w-28 shrink-0 pt-0.5 text-sm text-muted">{{ s.k }}</span>
                            <pre class="min-w-0 flex-1 font-mono text-[13px] break-all whitespace-pre-wrap">{{ s.v }}</pre>
                            <CopyButton :text="s.v" icon-only />
                        </li>
                    </ul>
                </Panel>
            </div>
        </template>

        <Panel v-else title="Decode a Basic credential">
            <Field label="Header or token" hint="Paste the whole header, the value after “Basic”, or just the Base64 token.">
                <input v-model="header" class="input font-mono" spellcheck="false" placeholder="Authorization: Basic YWxhZGRpbjpvcGVuIHNlc2FtZQ==" />
            </Field>
            <Notice v-if="decoded.error" type="error" class="mt-3">{{ decoded.error }}</Notice>
            <dl v-else-if="decoded.user !== undefined" class="mt-3 divide-y divide-line rounded-lg border border-line text-sm">
                <div class="flex items-center gap-3 px-4 py-2.5"><dt class="w-24 text-muted">Username</dt><dd class="min-w-0 flex-1 font-mono break-all">{{ decoded.user }}</dd><CopyButton :text="decoded.user" icon-only /></div>
                <div class="flex items-center gap-3 px-4 py-2.5"><dt class="w-24 text-muted">Password</dt><dd class="min-w-0 flex-1 font-mono break-all">{{ decoded.pass }}</dd><CopyButton :text="decoded.pass ?? ''" icon-only /></div>
            </dl>
        </Panel>

        <p class="text-xs text-muted">Basic auth is only Base64 encoding, not encryption: anyone who sees the header can read the password. Send it over HTTPS only.</p>
    </ToolPage>
</template>
