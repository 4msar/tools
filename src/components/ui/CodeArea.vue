<script setup lang="ts">
import { computed, ref } from "vue";
import { loadHighlighter } from "../../composables/useHighlighter";

const model = defineModel<string>({ default: "" });
const props = withDefaults(
    defineProps<{
        placeholder?: string;
        readonly?: boolean;
        height?: string;
        wrap?: boolean;
        invalid?: boolean;
        /** highlight.js language id/alias (e.g. "json", "js", "html") or "auto". Omit for plain text. */
        language?: string;
    }>(),
    { height: "20rem", wrap: true },
);

const pre = ref<HTMLPreElement>();
// Only fetch the highlighter chunk when this area actually has a language.
const hl = computed(() => (props.language ? loadHighlighter().value : null));
const highlighted = computed(() => {
    const h = hl.value;
    if (!h || !model.value || !h.supportsLanguage(props.language)) return "";
    // Trailing newline keeps the overlay height in step with the textarea's last empty line.
    return h.highlightCode(model.value, props.language) + "\n";
});

function syncScroll(e: Event) {
    const t = e.target as HTMLTextAreaElement;
    if (pre.value) {
        pre.value.scrollTop = t.scrollTop;
        pre.value.scrollLeft = t.scrollLeft;
    }
}

const base = "block w-full p-4 font-mono text-[13px] leading-relaxed";
</script>

<template>
    <textarea
        v-if="!language"
        v-model="model"
        :placeholder="placeholder"
        :readonly="readonly"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        class="flex-1 resize-y bg-transparent text-fg outline-none placeholder:text-fg-subtle"
        :class="[base, wrap ? '' : 'whitespace-pre', invalid ? 'bg-danger-soft/40' : '']"
        :style="{ minHeight: height }"
    />
    <div v-else class="relative flex min-h-0 flex-1 flex-col" :class="invalid ? 'bg-danger-soft/40' : ''">
        <pre
            ref="pre"
            aria-hidden="true"
            class="code-hl pointer-events-none absolute inset-0 m-0 overflow-hidden text-fg"
            :class="[base, wrap ? 'break-words whitespace-pre-wrap' : 'whitespace-pre']"
            v-html="highlighted"
        />
        <textarea
            v-model="model"
            :placeholder="placeholder"
            :readonly="readonly"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            class="relative flex-1 resize-y bg-transparent outline-none placeholder:text-fg-subtle selection:bg-accent/25"
            :class="[base, wrap ? 'break-words' : 'whitespace-pre', highlighted ? 'text-transparent caret-fg' : 'text-fg']"
            :style="{ minHeight: height }"
            @scroll="syncScroll"
        />
    </div>
</template>

<style scoped>
/* Reserve the same scrollbar gutter on both layers so line wrapping matches exactly. */
.code-hl,
.code-hl + textarea {
    scrollbar-gutter: stable;
    tab-size: 4;
}
/* Bold glyphs can be wider in fallback fonts — keep overlay metrics identical to the textarea. */
.code-hl :deep(*) {
    font-weight: inherit;
}
</style>
