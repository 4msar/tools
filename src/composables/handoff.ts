import { reactive, watch } from "vue";

/**
 * Passes input from outside a tool (the chat assistant) into the tool's page. The sender stores a
 * payload for the tool, then navigates; the tool applies it on mount or, when it is already alive in a
 * background tab (KeepAlive), as soon as the payload arrives.
 */
const pending = reactive<Record<string, Record<string, unknown>>>({});

export function sendToTool(toolId: string, payload: Record<string, unknown>) {
    pending[toolId] = payload;
}

export function useHandoff<T extends Record<string, unknown>>(toolId: string, apply: (payload: Partial<T>) => void) {
    watch(
        () => pending[toolId],
        (payload) => {
            if (!payload) return;
            delete pending[toolId];
            apply(payload as Partial<T>);
        },
        { immediate: true },
    );
}
