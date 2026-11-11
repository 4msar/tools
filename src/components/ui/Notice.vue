<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-vue-next";
withDefaults(defineProps<{ type?: "info" | "success" | "error" | "warning" }>(), { type: "info" });
</script>

<template>
    <div
        class="flex items-start gap-2 rounded-md px-3.5 py-3 text-sm"
        :class="{
            'bg-info-soft text-info': type === 'info',
            'bg-accent-soft text-accent-strong dark:text-accent': type === 'success',
            'bg-danger-soft text-danger': type === 'error',
            'bg-warn-soft text-warn': type === 'warning',
        }"
    >
        <AlertCircle v-if="type === 'error'" class="mt-0.5 size-4 shrink-0" />
        <CheckCircle2 v-else-if="type === 'success'" class="mt-0.5 size-4 shrink-0" />
        <TriangleAlert v-else-if="type === 'warning'" class="mt-0.5 size-4 shrink-0" />
        <Info v-else class="mt-0.5 size-4 shrink-0" />
        <div class="min-w-0 break-words"><slot /></div>
    </div>
</template>
