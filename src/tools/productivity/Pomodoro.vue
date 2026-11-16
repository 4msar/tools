<script lang="ts">
import { computed, reactive } from "vue";
import { useStorage } from "@vueuse/core";
import { alertUser, now, onClockTick, type Sound } from "./alert";

type Phase = "focus" | "short" | "long";

export const settings = useStorage("devtools:pomodoro", {
    focus: 25,
    short: 5,
    long: 15,
    longEvery: 4,
    autoStart: false,
    sound: "chime" as Sound,
});

// Module-level state: the timer keeps running when you open another tool.
const st = reactive({
    phase: "focus" as Phase,
    running: false,
    endsAt: 0,
    remaining: settings.value.focus * 60_000,
    completed: 0, // focus sessions finished in this cycle
    today: useStorage("devtools:pomodoro-today", { date: "", count: 0, minutes: 0 }),
});

const phaseMinutes = (p: Phase) => (p === "focus" ? settings.value.focus : p === "short" ? settings.value.short : settings.value.long);

export const remainingMs = computed(() => (st.running ? Math.max(0, st.endsAt - now.value) : st.remaining));

function setPhase(p: Phase) {
    st.phase = p;
    st.running = false;
    st.remaining = phaseMinutes(p) * 60_000;
}

function finish() {
    const finished = st.phase;
    st.running = false;
    if (finished === "focus") {
        const d = new Date().toDateString();
        if (st.today.date !== d) st.today = { date: d, count: 0, minutes: 0 };
        st.today.count++;
        st.today.minutes += settings.value.focus;
        st.completed++;
        const long = st.completed % settings.value.longEvery === 0;
        setPhase(long ? "long" : "short");
        alertUser("Focus session done", long ? "Time for a long break." : "Take a short break.", settings.value.sound);
    } else {
        setPhase("focus");
        alertUser("Break is over", "Ready for the next focus session?", settings.value.sound);
    }
    if (settings.value.autoStart) start();
}

function start() {
    if (st.running) return;
    st.endsAt = Date.now() + st.remaining;
    st.running = true;
}

onClockTick(() => {
    if (st.running && Date.now() >= st.endsAt) finish();
});

/** Move to the next phase without counting or alerting. */
function skip() {
    if (st.phase === "focus") setPhase((st.completed + 1) % settings.value.longEvery === 0 ? "long" : "short");
    else setPhase("focus");
}

export { st, setPhase, start, finish, skip, phaseMinutes };
</script>

<script setup lang="ts">
import { watch } from "vue";
import { Bell, BellOff, Coffee, Pause, Play, RotateCcw, SkipForward } from "lucide-vue-next";
import { Btn, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { useActiveEventListener } from "@/composables/useActiveEventListener";
import { fmtDuration, notifyPermission, playSound, requestNotifications, soundOptions } from "./alert";

const phases: { value: Phase; label: string }[] = [
    { value: "focus", label: "Focus" },
    { value: "short", label: "Short break" },
    { value: "long", label: "Long break" },
];

const phase = computed({
    get: () => st.phase,
    set: (p) => setPhase(p),
});

function pause() {
    if (!st.running) return;
    st.remaining = Math.max(0, st.endsAt - Date.now());
    st.running = false;
}
const toggle = () => (st.running ? pause() : start());
const reset = () => setPhase(st.phase);

// Apply new durations to an idle timer that hasn't been started yet.
watch(
    () => [settings.value.focus, settings.value.short, settings.value.long],
    () => {
        if (!st.running) st.remaining = phaseMinutes(st.phase) * 60_000;
    },
);

const progress = computed(() => 1 - remainingMs.value / (phaseMinutes(st.phase) * 60_000 || 1));
const R = 120;
const C = 2 * Math.PI * R;

// Show the countdown in the tab title while running.
const baseTitle = document.title;
watch([remainingMs, () => st.running], () => {
    if (st.running) document.title = `${fmtDuration(remainingMs.value)} · ${st.phase === "focus" ? "Focus" : "Break"}`;
    else if (document.title !== baseTitle && /^\d/.test(document.title)) document.title = baseTitle;
});

const todayCount = computed(() => (st.today.date === new Date().toDateString() ? st.today.count : 0));
const todayMinutes = computed(() => (st.today.date === new Date().toDateString() ? st.today.minutes : 0));
const cycleDots = computed(() => Array.from({ length: settings.value.longEvery }, (_, i) => i < st.completed % settings.value.longEvery));

useActiveEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(t.tagName) || t.isContentEditable)) return;
    if (e.code === "Space") {
        e.preventDefault();
        toggle();
    } else if (e.key === "r" || e.key === "R") reset();
    else if (e.key === "s" || e.key === "S") skip();
});
</script>

<template>
    <ToolPage>
        <Notice v-if="notifyPermission === 'default'" type="info">
            Allow notifications to get an alert when a session ends while this tab is in the background.
            <button type="button" class="ml-1 cursor-pointer font-semibold underline" @click="requestNotifications">Allow notifications</button>
        </Notice>
        <Notice v-else-if="notifyPermission === 'denied'" type="warning">Notifications are blocked for this site, so you'll only hear the sound and see an in-page alert.</Notice>

        <div class="flex flex-col items-center gap-6 rounded-xl border border-line bg-surface px-4 py-8 shadow-xs">
            <Tabs v-model="phase" :options="phases" />

            <div class="relative grid size-64 place-items-center sm:size-72">
                <svg viewBox="0 0 260 260" class="absolute inset-0 size-full -rotate-90">
                    <circle cx="130" cy="130" :r="R" fill="none" stroke="var(--line)" stroke-width="8" />
                    <circle
                        cx="130" cy="130" :r="R" fill="none" stroke-width="8" stroke-linecap="round"
                        :stroke="st.phase === 'focus' ? 'var(--danger)' : 'var(--accent)'"
                        :stroke-dasharray="C" :stroke-dashoffset="C * (1 - progress)"
                        class="transition-[stroke-dashoffset] duration-300"
                    />
                </svg>
                <div class="text-center">
                    <div class="font-mono text-6xl font-semibold tracking-tight tabular-nums" role="timer">{{ fmtDuration(remainingMs) }}</div>
                    <div class="mt-1 flex items-center justify-center gap-1 text-sm text-muted">
                        <Coffee v-if="st.phase !== 'focus'" class="size-4" />
                        {{ st.phase === "focus" ? "Stay focused" : "Take a break" }}
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-1.5" :title="`Long break after ${settings.longEvery} sessions`">
                <span v-for="(done, i) in cycleDots" :key="i" class="size-2.5 rounded-full" :class="done ? 'bg-danger' : 'bg-line'" />
            </div>

            <div class="flex flex-wrap justify-center gap-2">
                <Btn variant="primary" @click="toggle">
                    <Pause v-if="st.running" /><Play v-else />
                    {{ st.running ? "Pause" : remainingMs < phaseMinutes(st.phase) * 60000 ? "Resume" : "Start" }}
                </Btn>
                <Btn @click="reset"><RotateCcw /> Reset</Btn>
                <Btn @click="skip"><SkipForward /> Skip</Btn>
            </div>
            <p class="text-xs text-muted">
                <span class="kbd">Space</span> start / pause · <span class="kbd">R</span> reset · <span class="kbd">S</span> skip
            </p>
        </div>

        <div class="grid gap-5 md:grid-cols-2">
            <Panel title="Today">
                <div class="grid grid-cols-2 gap-3">
                    <div class="rounded-lg bg-subtle p-4">
                        <div class="text-3xl font-semibold tabular-nums">{{ todayCount }}</div>
                        <div class="text-xs text-muted">focus sessions</div>
                    </div>
                    <div class="rounded-lg bg-subtle p-4">
                        <div class="text-3xl font-semibold tabular-nums">{{ Math.floor(todayMinutes / 60) }}h {{ todayMinutes % 60 }}m</div>
                        <div class="text-xs text-muted">focused</div>
                    </div>
                </div>
            </Panel>

            <Panel title="Settings">
                <template #actions>
                    <Btn size="sm" variant="ghost" :disabled="settings.sound === 'none'" @click="playSound(settings.sound)">
                        <Bell v-if="settings.sound !== 'none'" /><BellOff v-else /> Test sound
                    </Btn>
                </template>
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Field label="Focus (min)"><input v-model.number="settings.focus" type="number" min="1" max="180" class="input" /></Field>
                    <Field label="Short (min)"><input v-model.number="settings.short" type="number" min="1" max="60" class="input" /></Field>
                    <Field label="Long (min)"><input v-model.number="settings.long" type="number" min="1" max="90" class="input" /></Field>
                    <Field label="Long every"><input v-model.number="settings.longEvery" type="number" min="2" max="12" class="input" /></Field>
                </div>
                <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <label class="flex items-center gap-2 text-sm"><input v-model="settings.autoStart" type="checkbox" class="checkbox" /> Start the next session automatically</label>
                    <select v-model="settings.sound" class="select w-auto" aria-label="Sound">
                        <option v-for="o in soundOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                    </select>
                </div>
            </Panel>
        </div>
    </ToolPage>
</template>
