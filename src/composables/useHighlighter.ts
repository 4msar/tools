import { shallowRef } from "vue";

type HighlightModule = typeof import("./highlight");

const mod = shallowRef<HighlightModule | null>(null);
let loading: Promise<HighlightModule> | null = null;

/** Lazily loads the highlight.js bundle on first use; returns a ref that fills in once it's ready. */
export function loadHighlighter() {
    if (!mod.value && !loading) loading = import("./highlight").then((m) => (mod.value = m));
    return mod;
}
