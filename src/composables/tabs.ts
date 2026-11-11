import { computed, reactive } from "vue";
import { useStorage } from "@vueuse/core";
import { toolById, type ToolDef } from "@/tools/registry";

const MAX_TABS = 15;

/** Open tool tabs, in display order. Persisted, so tabs survive a reload. */
const tabIds = useStorage<string[]>("devtools:tabs", []);

export const openTabs = computed<ToolDef[]>(() =>
    tabIds.value.map((id) => toolById.get(id)).filter((t): t is ToolDef => !!t),
);

/**
 * Component names of loaded tools, filled by the router after a lazy route resolves.
 * KeepAlive matches cached components by these names, so closing a tab drops its state.
 */
export const componentNames = reactive(new Map<string, string>());
export const keepAliveInclude = computed(() =>
    openTabs.value.map((t) => componentNames.get(t.id)).filter((n): n is string => !!n),
);

/** Adds a tab for `id` (right after `afterId` when given). Oldest tabs drop off past the limit. */
export function openTab(id: string, afterId?: string) {
    if (tabIds.value.includes(id)) return;
    const next = [...tabIds.value];
    const at = afterId ? next.indexOf(afterId) : -1;
    if (at >= 0) next.splice(at + 1, 0, id);
    else next.push(id);
    while (next.length > MAX_TABS) next.splice(next[0] === id ? 1 : 0, 1);
    tabIds.value = next;
}

/** The tab to show after closing `id`: its right neighbour, else its left one, or null. */
export function tabAfterClose(id: string): string | null {
    const ids = tabIds.value;
    const i = ids.indexOf(id);
    if (i < 0) return null;
    return ids[i + 1] ?? ids[i - 1] ?? null;
}

export function closeTab(id: string) {
    tabIds.value = tabIds.value.filter((x) => x !== id);
}

/**
 * Closes a tab; when it is the one on screen, navigates away first. KeepAlive never evicts the
 * component currently rendered, so removing the tab after navigating is what discards its state.
 */
export async function closeTabAndNavigate(id: string, activeId: string | undefined, go: (path: string) => Promise<unknown>) {
    if (id === activeId) {
        const next = tabAfterClose(id);
        await go(next ? `/${next}` : "/");
    }
    closeTab(id);
}

export function closeOtherTabs(id: string) {
    tabIds.value = tabIds.value.filter((x) => x === id);
}

export function closeAllTabs() {
    tabIds.value = [];
}

export function moveTab(id: string, toIndex: number) {
    const next = tabIds.value.filter((x) => x !== id);
    next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, id);
    tabIds.value = next;
}

export function neighbourTab(id: string, dir: 1 | -1): string | null {
    const ids = tabIds.value;
    if (!ids.length) return null;
    const i = ids.indexOf(id);
    return ids[(i + dir + ids.length) % ids.length] ?? null;
}
