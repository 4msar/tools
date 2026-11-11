<script setup lang="ts">
import { ref } from "vue";
import { ArrowLeft, Database, Download, Trash2 } from "lucide-vue-next";
import { chatModels } from "@/chat/models";
import { chatSettings, clearConversations } from "@/chat/store";
import {
    deleteModel,
    engineStatus,
    isCached,
    storageEstimate,
} from "@/chat/engine";

const emit = defineEmits<{ back: []; load: [] }>();
const storage = ref("Checking browser storage…");

function formatBytes(bytes?: number) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1,
    );
    return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

async function removeModel() {
    if (!confirm("Delete the downloaded model from this browser?")) return;
    await deleteModel(chatSettings.value.modelId);
    chatSettings.value.consented = false;
    emit("back");
}

async function removeConversations() {
    if (confirm("Delete all saved conversations?")) clearConversations();
}

void storageEstimate().then((estimate) => {
    if (estimate?.usage !== undefined)
        storage.value = formatBytes(estimate.usage);
});
void isCached(chatSettings.value.modelId);
</script>

<template>
    <div class="min-h-0 flex-1 overflow-y-auto p-5">
        <div class="flex items-center gap-2">
            <button
                type="button"
                class="grid size-8 place-items-center rounded-md text-fg-subtle hover:bg-subtle hover:text-fg"
                aria-label="Back to chat"
                @click="emit('back')"
            >
                <ArrowLeft class="size-4" />
            </button>
            <h2 class="text-lg font-semibold text-fg">Models and settings</h2>
        </div>
        <fieldset class="mt-6">
            <legend
                class="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase"
            >
                Model
            </legend>
            <label
                v-for="model in chatModels"
                :key="model.id"
                class="mb-2 flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors"
                :class="
                    chatSettings.modelId === model.id
                        ? 'border-accent bg-accent-soft'
                        : 'border-line hover:bg-subtle'
                "
                ><input
                    v-model="chatSettings.modelId"
                    type="radio"
                    name="chat-model"
                    :value="model.id"
                    class="mt-1 accent-(--accent)"
                    :disabled="engineStatus === 'generating'"
                /><span
                    ><span class="block text-sm font-medium text-fg"
                        >{{ model.label }}
                        <span class="font-normal text-fg-subtle">{{
                            model.size
                        }}</span></span
                    ><span class="mt-0.5 block text-xs text-fg-subtle">{{
                        model.note
                    }}</span></span
                ></label
            >
        </fieldset>
        <div class="mt-6 space-y-4">
            <label class="flex items-center justify-between gap-4"
                ><span
                    ><span class="block text-sm font-medium text-fg"
                        >Load when I open the panel</span
                    ><span class="block text-xs text-fg-subtle"
                        >May use GPU and memory immediately.</span
                    ></span
                ><input
                    v-model="chatSettings.autoLoad"
                    type="checkbox"
                    class="checkbox"
                    @change="emit('load')" /></label
            ><label class="flex items-center justify-between gap-4"
                ><span
                    ><span class="block text-sm font-medium text-fg"
                        >Remember conversations</span
                    ><span class="block text-xs text-fg-subtle"
                        >Turn off to remove saved chat history.</span
                    ></span
                ><input
                    v-model="chatSettings.remember"
                    type="checkbox"
                    class="checkbox"
            /></label>
        </div>
        <div
            class="mt-6 flex items-center gap-2 border-t border-line pt-4 text-xs text-fg-subtle"
        >
            <Database class="size-4" /><span
                >Browser storage: {{ storage }}</span
            >
        </div>
        <div class="mt-5 space-y-2">
            <button
                type="button"
                class="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-line px-3 text-xs font-medium text-fg hover:bg-subtle"
                @click="removeModel"
            >
                <Download class="size-3.5" />Delete the downloaded model</button
            ><button
                type="button"
                class="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-danger/30 px-3 text-xs font-medium text-danger hover:bg-danger-soft"
                @click="removeConversations"
            >
                <Trash2 class="size-3.5" />Delete all conversations
            </button>
        </div>
        <button
            type="button"
            class="mt-6 h-10 w-full rounded-md bg-inverse px-3 text-sm font-semibold text-inverse-fg hover:opacity-90"
            @click="emit('back')"
        >
            Done
        </button>
    </div>
</template>
