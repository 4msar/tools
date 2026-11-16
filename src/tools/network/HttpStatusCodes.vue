<script setup lang="ts">
import { statuses } from "./statuses";
import { useHandoff } from "@/composables/handoff";
import { computed, ref } from "vue";
import { Search } from "lucide-vue-next";
import { Notice, Tabs, ToolPage } from "@/components/ui";
import { copyText } from "@/composables/useClipboard";


type Cls = "all" | "1" | "2" | "3" | "4" | "5";
const cls = ref<Cls>("all");
const query = ref("");

const classMeta: Record<string, { label: string; text: string; bg: string }> = {
    "1": { label: "Informational", text: "text-accent", bg: "bg-accent/10" },
    "2": { label: "Success", text: "text-success", bg: "bg-success/10" },
    "3": { label: "Redirection", text: "text-warning", bg: "bg-warning/10" },
    "4": { label: "Client error", text: "text-danger", bg: "bg-danger/10" },
    "5": { label: "Server error", text: "text-danger", bg: "bg-danger/20" },
};

const filtered = computed(() => {
    const q = query.value.trim().toLowerCase();
    return statuses.filter((s) => {
        if (cls.value !== "all" && String(s.code)[0] !== cls.value) return false;
        if (!q) return true;
        return String(s.code).includes(q) || s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q);
    });
});

// Input sent from the chat assistant.
useHandoff<{ input?: string }>("http-status-codes", (p) => {
    if (p.input != null) query.value = p.input;
});
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs
                v-model="cls"
                size="sm"
                :options="[
                    { value: 'all', label: 'All' },
                    { value: '1', label: '1xx' },
                    { value: '2', label: '2xx' },
                    { value: '3', label: '3xx' },
                    { value: '4', label: '4xx' },
                    { value: '5', label: '5xx' },
                ]"
            />
        </template>

        <div class="relative">
            <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input v-model="query" class="input pl-9" placeholder="Search by code, name or description…" spellcheck="false" />
        </div>

        <Notice v-if="!filtered.length" type="info">No status codes match your search.</Notice>
        <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <button
                v-for="s in filtered"
                :key="s.code"
                type="button"
                class="flex cursor-pointer gap-3 rounded-xl border border-line bg-surface p-3 text-left shadow-xs transition hover:border-line-strong hover:bg-subtle"
                :title="`Copy ${s.code}`"
                @click="copyText(String(s.code), `Copied ${s.code}`)"
            >
                <span
                    class="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg font-mono text-lg font-semibold"
                    :class="[classMeta[String(s.code)[0]].text, classMeta[String(s.code)[0]].bg]"
                >{{ s.code }}</span>
                <span class="min-w-0">
                    <span class="block text-sm font-semibold">{{ s.name }}</span>
                    <span class="mt-0.5 block text-xs text-muted">{{ s.desc }}</span>
                    <span class="mt-1 block text-[11px] font-medium" :class="classMeta[String(s.code)[0]].text">{{ classMeta[String(s.code)[0]].label }}</span>
                </span>
            </button>
        </div>
    </ToolPage>
</template>
