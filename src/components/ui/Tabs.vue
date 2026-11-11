<script setup lang="ts" generic="T extends string | number">
const model = defineModel<T>({ required: true });
defineProps<{ options: { value: T; label: string }[]; size?: "sm" | "md" }>();
</script>

<template>
    <div class="inline-flex max-w-full flex-wrap gap-0.5 rounded-md bg-subtle p-0.5 ring-1 ring-line ring-inset" role="tablist">
        <button
            v-for="o in options"
            :key="String(o.value)"
            type="button"
            role="tab"
            :aria-selected="model === o.value"
            class="cursor-pointer rounded-[5px] font-medium whitespace-nowrap transition-colors duration-150"
            :class="[
                size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
                model === o.value ? 'bg-surface text-fg shadow-card ring-1 ring-line' : 'text-fg-subtle hover:text-fg',
            ]"
            @click="model = o.value"
        >
            {{ o.label }}
        </button>
    </div>
</template>
