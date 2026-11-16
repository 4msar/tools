<script setup lang="ts">
import { ref } from "vue";
import { MessageSquarePlus, Trash2 } from "lucide-vue-next";
import { Btn, Field, Panel, Tabs, ToolPage } from "@/components/ui";
import GeneralThread from "@/components/chat/GeneralThread.vue";
import ModelManager from "@/components/chat/ModelManager.vue";
import { gcActive, gcClearAll, gcDelete, gcNewChat, gcSelect, gcSessions, gcSettings } from "@/chat/general";

const side = ref<"chats" | "settings">("chats");
const showModels = ref(false);

function clearAll() {
    if (confirm("Delete all General Chat conversations?")) gcClearAll();
}
const when = (t: number) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
</script>

<template>
    <ToolPage>
        <template #actions>
            <Btn :variant="showModels ? 'primary' : 'secondary'" @click="showModels = !showModels">{{ showModels ? "Back to chat" : "Manage models" }}</Btn>
        </template>

        <ModelManager v-if="showModels" @picked="showModels = false" />

        <div v-else class="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
            <Panel flush class="lg:h-[min(75vh,760px)]">
                <template #title>
                    <Tabs v-model="side" size="sm" :options="[{ value: 'chats', label: 'Chats' }, { value: 'settings', label: 'Settings' }]" />
                </template>
                <template v-if="side === 'chats'" #actions>
                    <Btn size="sm" variant="ghost" aria-label="New chat" @click="gcNewChat"><MessageSquarePlus /></Btn>
                </template>

                <div v-if="side === 'chats'" class="flex min-h-0 flex-1 flex-col">
                    <p v-if="!gcSessions.length" class="p-4 text-sm text-muted">No conversations yet.</p>
                    <ul v-else class="max-h-60 min-h-0 flex-1 overflow-y-auto p-1.5 lg:max-h-none">
                        <li v-for="s in gcSessions" :key="s.id" class="group flex items-center rounded-lg" :class="s.id === gcActive?.id ? 'bg-subtle' : 'hover:bg-subtle/60'">
                            <button type="button" class="min-w-0 flex-1 cursor-pointer px-2.5 py-2 text-left" @click="gcSelect(s.id)">
                                <span class="block truncate text-sm text-fg">{{ s.title }}</span>
                                <span class="text-[11px] text-fg-subtle">{{ when(s.updatedAt) }} · {{ s.messages.length }} messages</span>
                            </button>
                            <button type="button" class="mr-1 grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-fg-subtle opacity-0 group-hover:opacity-100 hover:text-danger focus:opacity-100" :aria-label="`Delete ${s.title}`" @click="gcDelete(s.id)">
                                <Trash2 class="size-3.5" />
                            </button>
                        </li>
                    </ul>
                    <div v-if="gcSessions.length" class="border-t border-line p-2">
                        <Btn size="sm" variant="ghost" class="w-full" @click="clearAll">Delete all chats</Btn>
                    </div>
                </div>

                <div v-else class="space-y-4 p-4">
                    <Field label="System prompt" hint="Sent before every conversation.">
                        <textarea v-model="gcSettings.systemPrompt" rows="5" class="input" />
                    </Field>
                    <Field :label="`Temperature: ${gcSettings.temperature}`" hint="Lower is more focused, higher more creative.">
                        <input v-model.number="gcSettings.temperature" type="range" min="0" max="1.5" step="0.05" class="range" />
                    </Field>
                    <Field label="Max reply length (tokens)">
                        <input v-model.number="gcSettings.maxTokens" type="number" min="32" max="8192" step="32" class="input" />
                    </Field>
                    <p class="text-xs text-fg-subtle">One model is loaded at a time. The tool finder in the chatbox uses whichever model is loaded.</p>
                </div>
            </Panel>

            <section class="flex h-[min(75vh,760px)] min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                <GeneralThread @manage="showModels = true" />
            </section>
        </div>
    </ToolPage>
</template>
