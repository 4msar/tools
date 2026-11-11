<script setup lang="ts">
import { computed, ref } from "vue";
import { Loader2, ShieldCheck, ShieldX } from "lucide-vue-next";
import bcrypt from "bcryptjs";
import { Btn, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

type Mode = "hash" | "verify";
const mode = ref<Mode>("hash");
const password = ref("");
const rounds = ref(10);
const result = ref("");
const loading = ref(false);
const error = ref("");

const vPassword = ref("");
const vHash = ref("");
const vResult = ref<null | boolean>(null);
const vError = ref("");
const vLoading = ref(false);

const estimate = computed(() => {
    const s = 0.06 * 2 ** (rounds.value - 10);
    return s < 1 ? `~${Math.round(s * 1000)} ms` : `~${s.toFixed(1)} s`;
});

async function generate() {
    error.value = "";
    loading.value = true;
    try {
        result.value = await bcrypt.hash(password.value, rounds.value);
    } catch (e) {
        error.value = e instanceof Error ? e.message : "Hashing failed.";
    } finally {
        loading.value = false;
    }
}

async function verify() {
    vError.value = "";
    vResult.value = null;
    vLoading.value = true;
    try {
        vResult.value = await bcrypt.compare(vPassword.value, vHash.value.trim());
    } catch (e) {
        vError.value = e instanceof Error ? e.message : "Invalid hash.";
    } finally {
        vLoading.value = false;
    }
}

function parse(h: string) {
    const m = /^\$(2[abxy]?)\$(\d{2})\$([./A-Za-z0-9]{22})([./A-Za-z0-9]{31})$/.exec(h.trim());
    return m ? { version: m[1], cost: Number(m[2]), salt: m[3], digest: m[4] } : null;
}
const info = computed(() => parse(mode.value === "hash" ? result.value : vHash.value));
const truncated = computed(() => bcrypt.truncates(mode.value === "hash" ? password.value : vPassword.value));
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="mode" :options="[{ value: 'hash', label: 'Hash' }, { value: 'verify', label: 'Verify' }]" />
        </template>

        <div v-if="mode === 'hash'" class="grid gap-4 lg:grid-cols-2">
            <Panel title="Input">
                <div class="space-y-4">
                    <Field label="Password">
                        <input v-model="password" class="input font-mono" placeholder="Password to hash" autocomplete="off" spellcheck="false" @keydown.enter="generate" />
                    </Field>
                    <Field label="Cost rounds" :hint="`2^${rounds} iterations · ${estimate} on a typical device`">
                        <div class="flex items-center gap-3">
                            <input v-model.number="rounds" type="range" min="4" max="15" class="range" />
                            <span class="w-6 text-right font-mono text-sm">{{ rounds }}</span>
                        </div>
                    </Field>
                    <Notice v-if="rounds > 12" type="warning">Cost {{ rounds }} may take {{ estimate }} or longer and can freeze the tab briefly.</Notice>
                    <Notice v-if="truncated" type="warning">Bcrypt only uses the first 72 bytes of the password.</Notice>
                    <Btn variant="primary" :disabled="loading" @click="generate">
                        <Loader2 v-if="loading" class="animate-spin" />
                        {{ loading ? "Hashing…" : "Generate hash" }}
                    </Btn>
                </div>
            </Panel>
            <Panel title="Hash">
                <template #actions><CopyButton :text="result" /></template>
                <Notice v-if="error" type="error">{{ error }}</Notice>
                <div v-else-if="result" class="font-mono text-sm break-all">{{ result }}</div>
                <p v-else class="text-sm text-muted">Your bcrypt hash appears here.</p>
            </Panel>
        </div>

        <div v-else class="grid gap-4 lg:grid-cols-2">
            <Panel title="Input">
                <div class="space-y-4">
                    <Field label="Password">
                        <input v-model="vPassword" class="input font-mono" placeholder="Password" autocomplete="off" spellcheck="false" />
                    </Field>
                    <Field label="Bcrypt hash">
                        <input v-model="vHash" class="input font-mono" placeholder="$2a$10$…" autocomplete="off" spellcheck="false" @keydown.enter="verify" />
                    </Field>
                    <Btn variant="primary" :disabled="vLoading || !vHash" @click="verify">
                        <Loader2 v-if="vLoading" class="animate-spin" />
                        {{ vLoading ? "Verifying…" : "Verify" }}
                    </Btn>
                </div>
            </Panel>
            <Panel title="Result">
                <Notice v-if="vError" type="error">{{ vError }}</Notice>
                <div v-else-if="vResult !== null" class="flex items-center gap-3 text-lg font-semibold" :class="vResult ? 'text-success' : 'text-danger'">
                    <ShieldCheck v-if="vResult" class="size-6" />
                    <ShieldX v-else class="size-6" />
                    {{ vResult ? "Match" : "No match" }}
                </div>
                <p v-else class="text-sm text-muted">Enter a password and hash, then verify.</p>
            </Panel>
        </div>

        <Panel v-if="info" title="Hash info">
            <dl class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                <dt class="text-muted">Version</dt><dd class="font-mono">${{ info.version }}$</dd>
                <dt class="text-muted">Cost</dt><dd>{{ info.cost }} (2^{{ info.cost }} = {{ 2 ** info.cost }} iterations)</dd>
                <dt class="text-muted">Salt</dt><dd class="font-mono break-all">{{ info.salt }}</dd>
                <dt class="text-muted">Digest</dt><dd class="font-mono break-all">{{ info.digest }}</dd>
            </dl>
        </Panel>
    </ToolPage>
</template>
