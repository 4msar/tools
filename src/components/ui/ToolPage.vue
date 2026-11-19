<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { AnimatePresence, motion } from "motion-v";
import { Maximize2, Minimize2 } from "lucide-vue-next";
import { toolById } from "@/tools/registry";
import { compactMode } from "@/composables/prefs";
import { iconSwap, pressable } from "@/composables/motion";

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
            <div class="ml-auto flex flex-wrap items-center gap-2">
                <slot name="actions" />
                <motion.button
                    type="button"
                    class="grid size-10 cursor-pointer place-items-center rounded-full bg-surface text-fg-subtle shadow-float ring-1 ring-line transition-colors hover:text-accent"
                    :title="compactMode ? 'Exit compact view (Esc)' : 'Compact view (hide sidebar, header and tabs)'"
                    :aria-label="compactMode ? 'Exit compact view' : 'Enter compact view'"
                    v-bind="pressable"
                    @click="compactMode = !compactMode"
                >
                    <AnimatePresence mode="wait" :initial="false">
                        <motion.span :key="compactMode ? 'min' : 'max'" class="grid place-items-center" v-bind="iconSwap">
                            <Minimize2 v-if="compactMode" class="size-4" stroke-width="1.75" />
                            <Maximize2 v-else class="size-4" stroke-width="1.75" />
                        </motion.span>
                    </AnimatePresence>
                </motion.button>
            </div>
        </div>
        <slot />
    </div>
</template>
