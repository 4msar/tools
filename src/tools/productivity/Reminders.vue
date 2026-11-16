<script setup lang="ts">
import { computed, ref } from "vue";
import { AlarmClock, Bell, Hourglass, Pause, Play, Plus, RotateCcw, Trash2 } from "lucide-vue-next";
import { Btn, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { fmtDuration, now, notifyPermission, requestNotifications, soundOptions, type Sound } from "./alert";
import { reminders, type Reminder } from "./reminders";

const kind = ref<"timer" | "alarm">("timer");
const label = ref("");
const h = ref(0);
const m = ref(5);
const s = ref(0);
const time = ref(new Date(Date.now() + 3_600_000).toTimeString().slice(0, 5));
const daily = ref(false);
const sound = ref<Sound>("bell");

const presets = [1, 5, 10, 15, 30, 60];

const durationMs = computed(() => ((h.value || 0) * 3600 + (m.value || 0) * 60 + (s.value || 0)) * 1000);

function nextAt(hhmm: string) {
    const [hh, mm] = hhmm.split(":").map(Number);
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d.getTime();
}

function add(minutes?: number) {
    const id = crypto.randomUUID();
    if (kind.value === "timer" || minutes) {
        const duration = minutes ? minutes * 60_000 : durationMs.value;
        if (duration <= 0) return;
        reminders.value.push({ id, kind: "timer", label: label.value.trim() || (minutes ? `${minutes} min timer` : ""), at: Date.now() + duration, duration, sound: sound.value, active: true });
    } else {
        if (!time.value) return;
        reminders.value.push({ id, kind: "alarm", label: label.value.trim(), at: nextAt(time.value), daily: daily.value, sound: sound.value, active: true });
    }
    label.value = "";
}

const remove = (id: string) => (reminders.value = reminders.value.filter((r) => r.id !== id));
const clearDone = () => (reminders.value = reminders.value.filter((r) => r.active || r.paused));

function togglePause(r: Reminder) {
    if (r.active) {
        r.paused = Math.max(0, r.at - Date.now());
        r.active = false;
    } else if (r.paused != null) {
        r.at = Date.now() + r.paused;
        r.paused = undefined;
        r.active = true;
    }
}
function restart(r: Reminder) {
    r.paused = undefined;
    r.firedAt = undefined;
    r.at = r.kind === "timer" ? Date.now() + (r.duration ?? 0) : nextAt(new Date(r.at).toTimeString().slice(0, 5));
    r.active = true;
}

const rows = computed(() =>
    [...reminders.value].sort((a, b) => Number(b.active) - Number(a.active) || a.at - b.at),
);
const hasDone = computed(() => reminders.value.some((r) => !r.active && r.paused == null));

function status(r: Reminder) {
    if (r.active) return r.kind === "timer" ? fmtDuration(r.at - now.value) : `in ${fmtDuration(r.at - now.value)}`;
    if (r.paused != null) return `Paused · ${fmtDuration(r.paused)}`;
    return r.firedAt ? `Done at ${new Date(r.firedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Off";
}
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
</script>

<template>
    <ToolPage>
        <Notice v-if="notifyPermission === 'default'" type="info">
            Allow notifications so reminders reach you while you're in another tab or app.
            <button type="button" class="ml-1 cursor-pointer font-semibold underline" @click="requestNotifications">Allow notifications</button>
        </Notice>
        <Notice v-else-if="notifyPermission === 'denied'" type="warning">Notifications are blocked for this site. Reminders will still play a sound and show an in-page alert while this site is open.</Notice>

        <div class="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <Panel title="New reminder">
                <div class="space-y-4">
                    <Tabs v-model="kind" :options="[{ value: 'timer', label: 'Countdown' }, { value: 'alarm', label: 'At a time' }]" />
                    <Field label="Label"><input v-model="label" class="input" placeholder="e.g. Stand-up meeting" @keydown.enter="add()" /></Field>

                    <template v-if="kind === 'timer'">
                        <div class="grid grid-cols-3 gap-2">
                            <Field label="Hours"><input v-model.number="h" type="number" min="0" max="99" class="input" /></Field>
                            <Field label="Minutes"><input v-model.number="m" type="number" min="0" max="59" class="input" /></Field>
                            <Field label="Seconds"><input v-model.number="s" type="number" min="0" max="59" class="input" /></Field>
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                            <button v-for="p in presets" :key="p" type="button" class="chip cursor-pointer hover:text-fg" @click="add(p)">
                                {{ p < 60 ? `${p} min` : "1 hour" }}
                            </button>
                        </div>
                    </template>
                    <template v-else>
                        <Field label="Time"><input v-model="time" type="time" class="input" /></Field>
                        <label class="flex items-center gap-2 text-sm"><input v-model="daily" type="checkbox" class="checkbox" /> Repeat every day</label>
                    </template>

                    <Field label="Sound">
                        <select v-model="sound" class="select">
                            <option v-for="o in soundOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                        </select>
                    </Field>
                    <Btn variant="primary" class="w-full" :disabled="kind === 'timer' ? durationMs <= 0 : !time" @click="add()"><Plus /> Add {{ kind === "timer" ? "timer" : "alarm" }}</Btn>
                </div>
            </Panel>

            <Panel title="Reminders" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" :disabled="!hasDone" @click="clearDone">Clear finished</Btn>
                </template>
                <div v-if="!rows.length" class="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted">
                    <Bell class="size-6" />
                    No reminders yet. Add a countdown or an alarm. They keep running while you use other tools.
                </div>
                <ul v-else class="divide-y divide-line">
                    <li v-for="r in rows" :key="r.id" class="flex items-center gap-3 px-4 py-3" :class="!r.active && r.paused == null ? 'opacity-60' : ''">
                        <div class="grid size-9 shrink-0 place-items-center rounded-full bg-subtle">
                            <Hourglass v-if="r.kind === 'timer'" class="size-4" /><AlarmClock v-else class="size-4" />
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="truncate text-sm font-medium">{{ r.label || (r.kind === "timer" ? `${fmtDuration(r.duration ?? 0)} timer` : "Alarm") }}</div>
                            <div class="text-xs text-muted">
                                <template v-if="r.kind === 'alarm'">{{ clock(r.at) }}{{ r.daily ? " · every day" : "" }} · </template>
                                <template v-else-if="r.active">ends {{ clock(r.at) }} · </template>
                                <span class="font-mono tabular-nums" :class="r.active ? 'text-fg' : ''">{{ status(r) }}</span>
                            </div>
                        </div>
                        <Btn v-if="r.kind === 'timer' && (r.active || r.paused != null)" size="sm" variant="ghost" :aria-label="r.active ? 'Pause' : 'Resume'" @click="togglePause(r)">
                            <Pause v-if="r.active" /><Play v-else />
                        </Btn>
                        <Btn v-if="!r.active && r.paused == null" size="sm" variant="ghost" aria-label="Restart" @click="restart(r)"><RotateCcw /></Btn>
                        <label v-if="r.kind === 'alarm'" class="flex items-center" :title="r.active ? 'Turn off' : 'Turn on'">
                            <input type="checkbox" class="checkbox" :checked="r.active" @change="r.active ? (r.active = false) : restart(r)" />
                        </label>
                        <Btn size="sm" variant="ghost" aria-label="Delete" @click="remove(r.id)"><Trash2 /></Btn>
                    </li>
                </ul>
            </Panel>
        </div>
        <p class="text-xs text-muted">Reminders are saved in this browser and only fire while a DevTools tab is open. A reminder that came due while the site was closed alerts as soon as you come back.</p>
    </ToolPage>
</template>
