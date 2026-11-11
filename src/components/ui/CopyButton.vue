<script setup lang="ts">
import { ref } from "vue";
import { Check, Copy } from "lucide-vue-next";
import Btn from "./Btn.vue";
import { copyText } from "@/composables/useClipboard";

const props = withDefaults(
    defineProps<{ text: string; label?: string; size?: "sm" | "md"; variant?: "primary" | "secondary" | "ghost"; iconOnly?: boolean }>(),
    { label: "Copy", size: "sm", variant: "ghost" },
);
const done = ref(false);
async function copy() {
    if (!props.text) return;
    if (await copyText(props.text)) {
        done.value = true;
        setTimeout(() => (done.value = false), 1200);
    }
}
</script>

<template>
    <Btn :size="size" :variant="variant" :disabled="!text" :title="label" @click="copy">
        <Check v-if="done" class="text-success" />
        <Copy v-else />
        <span v-if="!iconOnly">{{ done ? "Copied" : label }}</span>
    </Btn>
</template>
