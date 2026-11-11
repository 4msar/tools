<script setup lang="ts">
const model = defineModel<string>({ default: "" });
withDefaults(
    defineProps<{ placeholder?: string; readonly?: boolean; height?: string; wrap?: boolean; invalid?: boolean }>(),
    { height: "20rem", wrap: true },
);
</script>

<template>
    <textarea
        v-model="model"
        :placeholder="placeholder"
        :readonly="readonly"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        class="block w-full flex-1 resize-y bg-transparent p-4 font-mono text-[13px] leading-relaxed text-fg outline-none placeholder:text-fg-subtle"
        :class="[wrap ? '' : 'whitespace-pre', invalid ? 'bg-danger-soft/40' : '']"
        :style="{ minHeight: height }"
    />
</template>
