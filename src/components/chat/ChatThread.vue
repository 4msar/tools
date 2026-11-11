<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
    ArrowUp,
    ExternalLink,
    Plus,
    Square,
    Sparkles,
    Settings2,
} from "lucide-vue-next";
import { rankTools } from "@/chat/retrieval";
import { ask, engineStatus, stop } from "@/chat/engine";
import {
    activeSession,
    ensureSession,
    newChat,
    updateSession,
    type ChatMessage,
} from "@/chat/store";
import { toolById } from "@/tools/registry";

const emit = defineEmits<{ settings: []; consent: [] }>();
const router = useRouter();
const input = ref("");
const listEl = ref<HTMLElement>();
const busy = ref(false);

watch(
    () => activeSession.value?.messages.length,
    async () => {
        await nextTick();
        if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight;
    },
);

function patchMessage(
    sessionId: string,
    messageId: string,
    change: (message: ChatMessage) => ChatMessage,
) {
    updateSession(sessionId, (session) => ({
        ...session,
        updatedAt: Date.now(),
        messages: session.messages.map((message) =>
            message.id === messageId ? change(message) : message,
        ),
    }));
}

async function send() {
    const text = input.value.trim();
    if (!text || busy.value) return;
    const session = ensureSession();
    const matches = rankTools(text);
    const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
    };
    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        toolIds: matches.map((tool) => tool.id),
        streaming: true,
    };
    updateSession(session.id, (current) => ({
        ...current,
        title: current.messages.length ? current.title : text.slice(0, 42),
        updatedAt: Date.now(),
        messages: [...current.messages, userMessage, assistantMessage],
    }));
    input.value = "";
    busy.value = true;
    const history = [...session.messages, userMessage].map((message) => ({
        role: message.role,
        content: message.content,
    }));
    const fallback = matches.length
        ? `I found ${matches.length} tool${matches.length === 1 ? "" : "s"} that should help. Pick one below to get started.`
        : "I could not find a close match yet. Try naming the format, protocol, or kind of output you need.";
    try {
        if (engineStatus.value === "ready") {
            await ask(
                [
                    {
                        role: "system",
                        content: `You help users choose a developer tool. Answer in 2 or 3 concise sentences. Do not invent tools or links. Candidate tools:\n${matches.map((tool) => `${tool.name} — ${tool.description}`).join("\n")}`,
                    },
                    ...history,
                ],
                (token) =>
                    patchMessage(session.id, assistantId, (message) => ({
                        ...message,
                        content: message.content + token,
                    })),
            );
        }
        patchMessage(session.id, assistantId, (message) => ({
            ...message,
            content: message.content || fallback,
            streaming: false,
        }));
    } catch {
        patchMessage(session.id, assistantId, (message) => ({
            ...message,
            content: fallback,
            streaming: false,
        }));
    } finally {
        busy.value = false;
    }
}

function openTool(id: string) {
    if (toolById.has(id)) router.push("/" + id);
}

function startNewChat() {
    newChat();
}
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col">
        <div ref="listEl" class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div
                v-if="!activeSession?.messages.length"
                class="flex h-full flex-col items-center justify-center px-5 text-center"
            >
                <div
                    class="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent"
                >
                    <Sparkles class="size-5" />
                </div>
                <p class="mt-3 text-sm font-medium text-fg">
                    What are you trying to make?
                </p>
                <p class="mt-1 max-w-[260px] text-xs leading-5 text-fg-subtle">
                    Ask about a format, a debugging task, or a developer
                    workflow.
                </p>
            </div>
            <template
                v-for="message in activeSession?.messages"
                :key="message.id"
            >
                <div
                    class="flex"
                    :class="
                        message.role === 'user'
                            ? 'justify-end'
                            : 'justify-start'
                    "
                >
                    <div
                        class="max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6"
                        :class="
                            message.role === 'user'
                                ? 'rounded-br-md bg-inverse text-inverse-fg'
                                : 'rounded-bl-md bg-subtle text-fg'
                        "
                    >
                        <p class="whitespace-pre-wrap">
                            {{ message.content
                            }}<span
                                v-if="message.streaming"
                                class="ml-1 inline-block h-3 w-1 animate-pulse bg-accent align-middle"
                            />
                        </p>
                    </div>
                </div>
                <div
                    v-if="
                        message.role === 'assistant' &&
                        !message.streaming &&
                        message.toolIds?.length
                    "
                    class="space-y-2 pl-1"
                >
                    <button
                        v-for="id in message.toolIds"
                        :key="id"
                        type="button"
                        class="group flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-accent hover:bg-subtle"
                        @click="openTool(id)"
                    >
                        <span
                            class="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"
                            ><component
                                :is="toolById.get(id)?.icon"
                                class="size-4"
                        /></span>
                        <span class="min-w-0 flex-1"
                            ><span class="block text-sm font-medium text-fg">{{
                                toolById.get(id)?.name
                            }}</span
                            ><span
                                class="mt-0.5 block text-xs leading-5 text-fg-subtle"
                                >{{ toolById.get(id)?.description }}</span
                            ></span
                        >
                        <ExternalLink
                            class="mt-1 size-3.5 shrink-0 text-fg-subtle transition-colors group-hover:text-accent"
                        />
                    </button>
                </div>
            </template>
        </div>
        <div class="border-t border-line p-3">
            <form
                class="flex items-end gap-2 rounded-xl border border-line bg-subtle p-1.5 focus-within:border-ring"
                @submit.prevent="send"
            >
                <textarea
                    v-model="input"
                    rows="1"
                    class="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-fg outline-none placeholder:text-fg-subtle"
                    placeholder="Describe what you need…"
                    aria-label="Describe what you need"
                    @keydown.enter.exact.prevent="send"
                />
                <button
                    v-if="busy"
                    type="button"
                    class="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg"
                    aria-label="Stop generating"
                    @click="stop"
                >
                    <Square class="size-3.5 fill-current" />
                </button>
                <button
                    v-else
                    type="submit"
                    class="grid size-9 shrink-0 place-items-center rounded-lg bg-inverse text-inverse-fg disabled:opacity-40"
                    aria-label="Send message"
                    :disabled="!input.trim()"
                >
                    <ArrowUp class="size-4" />
                </button>
            </form>
            <div class="mt-2 flex items-center justify-between px-1">
                <span class="text-[10px] text-fg-subtle"
                    >Private by design · runs in your browser</span
                ><span class="flex gap-1"
                    ><button
                        type="button"
                        class="grid size-7 place-items-center rounded-md text-fg-subtle hover:bg-subtle hover:text-fg"
                        aria-label="New conversation"
                        title="New conversation"
                        @click="startNewChat"
                    >
                        <Plus class="size-4" /></button
                    ><button
                        type="button"
                        class="grid size-7 place-items-center rounded-md text-fg-subtle hover:bg-subtle hover:text-fg"
                        aria-label="Chat settings"
                        title="Chat settings"
                        @click="emit('settings')"
                    >
                        <Settings2 class="size-4" /></button
                ></span>
            </div>
        </div>
    </div>
</template>
