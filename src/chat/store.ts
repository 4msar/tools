import { computed, ref, watch } from "vue";
import { useStorage } from "@vueuse/core";
import { defaultModelId } from "./models";
import type { ActionResult } from "./actions";

export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    toolIds?: string[];
    /** Set when the message ran a tool command. */
    action?: ActionResult;
    streaming?: boolean;
}

export interface ChatSession {
    id: string;
    title: string;
    updatedAt: number;
    messages: ChatMessage[];
}

interface SessionState {
    activeId: string;
    sessions: ChatSession[];
}

interface ChatSettings {
    modelId: string;
    autoLoad: boolean;
    remember: boolean;
    consented: boolean;
    /** Chose to use search and commands without downloading the model. */
    skipModel?: boolean;
    /** Jump to the tool's page after running a command from the chat. Off: results stay in the chat. */
    openToolOnRun?: boolean;
}

const newSession = (): ChatSession => ({
    id: crypto.randomUUID(),
    title: "New conversation",
    updatedAt: Date.now(),
    messages: [],
});
const storedSessions = useStorage<SessionState>("devtools:chat:sessions", {
    activeId: "",
    sessions: [],
});
export const chatSettings = useStorage<ChatSettings>("devtools:chat:settings", {
    modelId: defaultModelId,
    autoLoad: false,
    remember: true,
    consented: false,
    openToolOnRun: false,
});
const memorySessions = ref<SessionState>({ activeId: "", sessions: [] });

const state = computed(() =>
    chatSettings.value.remember ? storedSessions.value : memorySessions.value,
);
export const sessions = computed(() => state.value.sessions);
export const activeSession = computed(
    () =>
        state.value.sessions.find(
            (session) => session.id === state.value.activeId,
        ) ?? state.value.sessions[0],
);

function updateState(next: SessionState) {
    if (chatSettings.value.remember) storedSessions.value = next;
    else memorySessions.value = next;
}

export function ensureSession() {
    if (activeSession.value) return activeSession.value;
    const session = newSession();
    updateState({ activeId: session.id, sessions: [session] });
    return session;
}

export function newChat() {
    const session = newSession();
    updateState({
        activeId: session.id,
        sessions: [session, ...state.value.sessions],
    });
    return session;
}

export function updateSession(
    id: string,
    change: (session: ChatSession) => ChatSession,
) {
    updateState({
        activeId: state.value.activeId || id,
        sessions: state.value.sessions.map((session) =>
            session.id === id ? change(session) : session,
        ),
    });
}

export function clearConversations() {
    storedSessions.value = { activeId: "", sessions: [] };
    memorySessions.value = { activeId: "", sessions: [] };
}

watch(
    () => chatSettings.value.remember,
    (remember) => {
        if (!remember) storedSessions.value = { activeId: "", sessions: [] };
    },
);

ensureSession();
