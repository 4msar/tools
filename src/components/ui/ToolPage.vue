<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { toolById } from "@/tools/registry";

const route = useRoute();
const tool = computed(() => toolById.get(route.meta.toolId as string));
</script>

<template>
    <div class="space-y-5">
        <div v-if="tool" class="flex flex-wrap items-start justify-between gap-4">
            <div class="flex min-w-0 items-start gap-3">
                <div class="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-fg shadow-float ring-1 ring-line">
                    <component :is="tool.icon" class="size-5" stroke-width="1.5" />
                </div>
                <div class="min-w-0">
                    <h1 class="font-display text-3xl font-semibold text-fg">{{ tool.name }}</h1>
                    <p class="mt-1 text-sm leading-6 text-fg-muted">{{ tool.description }}</p>
                </div>
            </div>
            <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2"><slot name="actions" /></div>
        </div>
        <slot />
    </div>
</template>
