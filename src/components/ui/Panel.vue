<script setup lang="ts">
defineProps<{ title?: string; flush?: boolean }>();
</script>

<template>
    <section class="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header
            v-if="title || $slots.actions || $slots.title"
            class="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-1.5"
        >
            <h3 class="text-sm font-semibold tracking-tight text-fg"><slot name="title">{{ title }}</slot></h3>
            <div class="flex flex-wrap items-center gap-1"><slot name="actions" /></div>
        </header>
        <div class="flex min-h-0 flex-1 flex-col" :class="flush ? '' : 'p-4'">
            <slot />
        </div>
    </section>
</template>
