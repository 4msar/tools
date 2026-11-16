<script lang="ts">
import { reactive } from "vue";
import { useStorage } from "@vueuse/core";
import { alertUser, onClockTick, type Sound } from "./alert";

export interface Habit {
    id: string;
    name: string;
    tip: string;
    every: number; // minutes
    enabled: boolean;
}

const defaults: Habit[] = [
    { id: "eyes", name: "Rest your eyes", tip: "20-20-20: look at something 20 feet away for 20 seconds.", every: 20, enabled: true },
    { id: "water", name: "Drink water", tip: "Have a glass of water.", every: 45, enabled: true },
    { id: "stretch", name: "Stretch", tip: "Stand up, roll your shoulders and stretch your back and wrists.", every: 60, enabled: true },
    { id: "posture", name: "Check posture", tip: "Feet flat, back against the chair, screen at eye level.", every: 30, enabled: false },
    { id: "walk", name: "Take a walk", tip: "Get up and walk around for a few minutes.", every: 90, enabled: false },
];

export const habits = useStorage<Habit[]>("devtools:break-habits", defaults);
export const breakSettings = useStorage("devtools:break-settings", { sound: "chime" as Sound });

// Runtime state: not persisted, so reminders start fresh each time you turn them on.
export const run = reactive({
    on: false,
    next: {} as Record<string, number>,
    count: {} as Record<string, number>,
});

export function schedule(h: Habit) {
    run.next[h.id] = Date.now() + h.every * 60_000;
}

onClockTick(() => {
    if (!run.on) return;
    const t = Date.now();
    for (const h of habits.value) {
        if (!h.enabled) continue;
        if (run.next[h.id] == null) schedule(h);
        else if (t >= run.next[h.id]) {
            alertUser(h.name, h.tip, breakSettings.value.sound);
            run.count[h.id] = (run.count[h.id] ?? 0) + 1;
            schedule(h);
        }
    }
});
</script>

<script setup lang="ts">
import { ref } from "vue";
import { Pause, Play, Plus, RotateCcw, SkipForward, Trash2 } from "lucide-vue-next";
import { Btn, Field, Notice, Panel, ToolPage } from "@/components/ui";
import { fmtDuration, now, notifyPermission, requestNotifications, soundOptions } from "./alert";

function toggle() {
    run.on = !run.on;
    if (run.on) habits.value.filter((h) => h.enabled).forEach(schedule);
}

function setEnabled(h: Habit, on: boolean) {
    h.enabled = on;
    if (on) schedule(h);
    else delete run.next[h.id];
}

const newName = ref("");
const newEvery = ref(30);
function addHabit() {
    const name = newName.value.trim();
    if (!name || newEvery.value < 1) return;
    const h: Habit = { id: crypto.randomUUID(), name, tip: name, every: newEvery.value, enabled: true };
    habits.value.push(h);
    if (run.on) schedule(h);
    newName.value = "";
}
const remove = (id: string) => (habits.value = habits.value.filter((h) => h.id !== id));
function resetDefaults() {
    habits.value = defaults.map((h) => ({ ...h }));
    run.next = {};
    if (run.on) habits.value.filter((h) => h.enabled).forEach(schedule);
}
</script>

<template>
    <ToolPage>
        <Notice v-if="notifyPermission === 'default'" type="info">
            Allow notifications so break reminders reach you while you work in other apps.
            <button type="button" class="ml-1 cursor-pointer font-semibold underline" @click="requestNotifications">Allow notifications</button>
        </Notice>

        <div class="flex flex-col items-center gap-4 rounded-xl border border-line bg-surface px-4 py-8 text-center shadow-xs">
            <p class="max-w-md text-sm text-fg-muted">
                {{ run.on ? "Reminders are running. Keep this site open in a tab; you can switch to other tools." : "Turn on reminders to get nudged to rest your eyes, drink water and move while you work." }}
            </p>
            <Btn variant="primary" @click="toggle"><Pause v-if="run.on" /><Play v-else /> {{ run.on ? "Stop reminders" : "Start reminders" }}</Btn>
        </div>

        <Panel title="Reminders" flush>
            <template #actions>
                <select v-model="breakSettings.sound" class="select h-7 w-auto py-0 text-xs" aria-label="Sound">
                    <option v-for="o in soundOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
                <Btn size="sm" variant="ghost" @click="resetDefaults"><RotateCcw /> Defaults</Btn>
            </template>
            <ul class="divide-y divide-line">
                <li v-for="h in habits" :key="h.id" class="flex flex-wrap items-center gap-3 px-4 py-3" :class="h.enabled ? '' : 'opacity-60'">
                    <input type="checkbox" class="checkbox" :checked="h.enabled" :aria-label="`Enable ${h.name}`" @change="setEnabled(h, ($event.target as HTMLInputElement).checked)" />
                    <div class="min-w-0 flex-1">
                        <div class="text-sm font-medium">{{ h.name }}</div>
                        <div class="text-xs text-muted">{{ h.tip }}</div>
                    </div>
                    <label class="flex items-center gap-1.5 text-xs text-muted">
                        every
                        <input v-model.number="h.every" type="number" min="1" max="480" class="input h-8 w-16 py-0 text-center" @change="run.on && h.enabled && schedule(h)" />
                        min
                    </label>
                    <div class="w-24 text-right font-mono text-xs tabular-nums">
                        <template v-if="run.on && h.enabled && run.next[h.id]">{{ fmtDuration(run.next[h.id] - now) }}</template>
                        <span v-else class="text-muted">—</span>
                        <div v-if="run.count[h.id]" class="font-sans text-muted">{{ run.count[h.id] }}× this session</div>
                    </div>
                    <Btn size="sm" variant="ghost" :disabled="!run.on || !h.enabled" aria-label="Remind now" title="Remind now" @click="run.next[h.id] = Date.now()"><SkipForward /></Btn>
                    <Btn size="sm" variant="ghost" aria-label="Delete" @click="remove(h.id)"><Trash2 /></Btn>
                </li>
            </ul>
            <form class="flex flex-wrap items-end gap-2 border-t border-line p-4" @submit.prevent="addHabit">
                <Field label="Custom reminder" class="min-w-48 flex-1"><input v-model="newName" class="input" placeholder="e.g. Check messages" /></Field>
                <Field label="Every (min)" class="w-28"><input v-model.number="newEvery" type="number" min="1" class="input" /></Field>
                <Btn type="submit" :disabled="!newName.trim()"><Plus /> Add</Btn>
            </form>
        </Panel>
    </ToolPage>
</template>
