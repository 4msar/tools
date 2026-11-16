import { computed, ref } from "vue";
import { useStorage } from "@vueuse/core";
import { ask, engineError, engineStatus, load, loadedModel, stop } from "./engine";
import { defaultModelId } from "./models";

/**
 * General Chat: a plain conversation with an on-device model, not tied to any tool. Used by the
 * General Chat tool page and the "General" tab of the chatbox; both share these conversations.
 */

export interface GcMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    streaming?: boolean;
    error?: boolean;
}

export interface GcSession {
    id: string;
    title: string;
    updatedAt: number;
    messages: GcMessage[];
}

export interface GcSettings {
    modelId: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
}

export const gcSettings = useStorage<GcSettings>(
    "devtools:gc:settings",
    { modelId: defaultModelId, systemPrompt: "You are a helpful, concise assistant.", temperature: 0.7, maxTokens: 1024 },
    undefined,
    { mergeDefaults: true },
);

const state = useStorage<{ activeId: string; sessions: GcSession[] }>("devtools:gc:sessions", { activeId: "", sessions: [] });

export const gcSessions = computed(() => [...state.value.sessions].sort((a, b) => b.updatedAt - a.updatedAt));
export const gcActive = computed(() => state.value.sessions.find((s) => s.id === state.value.activeId) ?? null);
export const gcBusy = ref(false);

export function gcNewChat() {
    const empty = state.value.sessions.find((s) => !s.messages.length);
    if (empty) {
        state.value.activeId = empty.id;
        return empty;
    }
    const session: GcSession = { id: crypto.randomUUID(), title: "New chat", updatedAt: Date.now(), messages: [] };
    state.value.sessions.push(session);
    state.value.activeId = session.id;
    return session;
}

export function gcSelect(id: string) {
    state.value.activeId = id;
}

export function gcDelete(id: string) {
    state.value.sessions = state.value.sessions.filter((s) => s.id !== id);
    if (state.value.activeId === id) state.value.activeId = gcSessions.value[0]?.id ?? "";
}

export function gcClearAll() {
    state.value = { activeId: "", sessions: [] };
}

/** Load the chosen model if it isn't the one in memory. */
export async function gcEnsureModel() {
    if (loadedModel.value === gcSettings.value.modelId && engineStatus.value !== "error") return;
    await load(gcSettings.value.modelId);
}

function find(sessionId: string) {
    return state.value.sessions.find((s) => s.id === sessionId);
}

async function generate(session: GcSession) {
    const history = session.messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    const reply: GcMessage = { id: crypto.randomUUID(), role: "assistant", content: "", streaming: true };
    session.messages.push(reply);
    // Work on the reactive copy so streamed tokens render as they arrive.
    const live = () => find(session.id)?.messages.find((m) => m.id === reply.id);
    gcBusy.value = true;
    try {
        await gcEnsureModel();
        const system = gcSettings.value.systemPrompt.trim();
        await ask([...(system ? [{ role: "system" as const, content: system }] : []), ...history], (token) => {
            const m = live();
            if (m) m.content += token;
        }, { temperature: gcSettings.value.temperature, max_tokens: gcSettings.value.maxTokens });
    } catch (e) {
        const m = live();
        if (m) {
            m.error = true;
            m.content ||= engineError.value || (e instanceof Error ? e.message : "Something went wrong.");
        }
    } finally {
        const m = live();
        if (m) m.streaming = false;
        const s = find(session.id);
        if (s) s.updatedAt = Date.now();
        gcBusy.value = false;
    }
}

export async function gcSend(text: string) {
    const content = text.trim();
    if (!content || gcBusy.value) return;
    const session = gcActive.value ?? gcNewChat();
    if (!session.messages.length) session.title = content.slice(0, 48);
    session.messages.push({ id: crypto.randomUUID(), role: "user", content });
    session.updatedAt = Date.now();
    await generate(find(session.id)!);
}

/** Drop the last reply and ask again. */
export async function gcRegenerate() {
    const session = gcActive.value;
    if (!session || gcBusy.value) return;
    while (session.messages.at(-1)?.role === "assistant") session.messages.pop();
    if (session.messages.length) await generate(session);
}

export function gcStop() {
    stop();
}
