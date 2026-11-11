<script setup lang="ts">
defineProps<{ label?: string; hint?: string }>();
</script>

<template>
    <label class="block min-w-0">
        <span v-if="label" class="label">{{ label }}</span>
        <slot />
        <span v-if="hint" class="mt-1 block text-xs text-muted">{{ hint }}</span>
    </label>
</template>
