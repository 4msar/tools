<script setup lang="ts">
import { computed } from "vue";
import { loadHighlighter } from "../../composables/useHighlighter";

const props = defineProps<{ code: string; language?: string }>();
const hl = computed(() => (props.language ? loadHighlighter().value : null));
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const html = computed(() => (hl.value ? hl.value.highlightCode(props.code ?? "", props.language) : escape(props.code ?? "")));
</script>

<template>
    <pre class="code-block text-fg"><code v-html="html" /></pre>
</template>
