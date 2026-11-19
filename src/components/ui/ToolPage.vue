<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { AnimatePresence, motion } from "motion-v";
import { Maximize2, Minimize2 } from "lucide-vue-next";
import { toolById } from "@/tools/registry";
import { compactMode } from "@/composables/prefs";
import { popIn, pressable, softSpring } from "@/composables/motion";

const route = useRoute();
const tool = computed(() => toolById.get(route.meta.toolId as string));
</script>

<template>
    <div>
        <!-- Title row collapses away in compact view; height animates so the tool glides up. -->
        <AnimatePresence :initial="false">
            <motion.div
                v-if="tool && !compactMode"
                key="tool-header"
                class="-mx-1 -mt-1 overflow-hidden"
                :initial="{ height: 0, opacity: 0 }"
                :animate="{ height: 'auto', opacity: 1 }"
                :exit="{ height: 0, opacity: 0 }"
                :transition="softSpring"
            >
                <!-- Padding keeps the button shadows clear of the clipping edge. -->
                <div class="flex flex-wrap items-start justify-between gap-4 p-1 pb-5">
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
                            title="Compact view (hide sidebar, header and panels)"
                            aria-label="Enter compact view"
                            v-bind="pressable"
                            @click="compactMode = true"
                        >
                            <Maximize2 class="size-4" stroke-width="1.75" />
                        </motion.button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
        <AnimatePresence>
            <motion.button
                v-if="tool && compactMode"
                key="compact-exit"
                type="button"
                class="fixed top-3 right-3 z-30 grid size-10 cursor-pointer place-items-center rounded-full bg-surface text-fg-subtle shadow-float ring-1 ring-line transition-colors hover:text-accent"
                title="Exit compact view (Esc)"
                aria-label="Exit compact view"
                v-bind="popIn"
                :while-hover="pressable.whileHover"
                :while-press="pressable.whilePress"
                @click="compactMode = false"
            >
                <Minimize2 class="size-4" stroke-width="1.75" />
            </motion.button>
        </AnimatePresence>
        <div class="space-y-5"><slot /></div>
    </div>
</template>
