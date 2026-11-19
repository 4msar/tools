<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from "vue";
import { useStorage } from "@vueuse/core";
import { Maximize, Minimize, Pause, Play, Plus, RotateCcw, Trash2 } from "lucide-vue-next";
import { Btn, Field, Panel, Tabs, ToolPage } from "@/components/ui";
import { alertUser, soundOptions, type Sound } from "../productivity/alert";

type Mode = "event" | "timer";
const mode = useStorage<Mode>("tools:countdown:mode", "event");
const now = ref(Date.now());
let iv = 0;
const origTitle = typeof document !== "undefined" ? document.title : "";

// ---------- Event countdowns ----------
interface Ev { id: string; title: string; target: number; created: number }
const events = useStorage<Ev[]>("tools:countdown:events", []);
const evTitle = ref("");
const pad = (n: number) => String(n).padStart(2, "0");
function toLocalInput(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const evDate = ref(toLocalInput(new Date(Date.now() + 86400000)));

function addEvent() {
    const t = new Date(evDate.value).getTime();
    if (isNaN(t)) return;
    events.value = [...events.value, { id: crypto.randomUUID(), title: evTitle.value.trim() || "Countdown", target: t, created: Date.now() }];
    evTitle.value = "";
}
function removeEvent(id: string) {
    events.value = events.value.filter((e) => e.id !== id);
}
const presets = computed(() => {
    const y = new Date().getFullYear();
    const next = (m: number, d: number) => {
        const t = new Date(y, m, d, 0, 0, 0);
        return t.getTime() > Date.now() ? t : new Date(y + 1, m, d, 0, 0, 0);
    };
    return [
        { label: "New Year", title: "New Year", date: new Date(y + 1, 0, 1) },
        { label: "Christmas", title: "Christmas", date: next(11, 25) },
        { label: "Halloween", title: "Halloween", date: next(9, 31) },
        { label: "Valentine's Day", title: "Valentine's Day", date: next(1, 14) },
        { label: "End of year", title: "End of year", date: new Date(y, 11, 31, 23, 59, 59) },
    ];
});
function usePreset(p: { title: string; date: Date }) {
    evTitle.value = p.title;
    evDate.value = toLocalInput(p.date);
}
function parts(ms: number) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
}
const evRows = computed(() =>
    events.value
        .map((e) => {
            const left = e.target - now.value;
            const span = Math.max(1, e.target - e.created);
            return { ...e, left, done: left <= 0, p: parts(left), pct: Math.min(100, Math.max(0, ((now.value - e.created) / span) * 100)) };
        })
        .sort((a, b) => a.target - b.target),
);

// ---------- Timer ----------
const hh = useStorage("tools:countdown:h", 0);
const mm = useStorage("tools:countdown:m", 5);
const ss = useStorage("tools:countdown:s", 0);
const sound = useStorage<Sound>("tools:countdown:sound", "chime");
const total = ref(0);
const endAt = ref(0);
const remaining = ref(0); // while paused/idle
const running = ref(false);
const finished = ref(false);

const inputMs = computed(() => ((Number(hh.value) || 0) * 3600 + (Number(mm.value) || 0) * 60 + (Number(ss.value) || 0)) * 1000);
const left = computed(() => (running.value ? Math.max(0, endAt.value - now.value) : total.value ? remaining.value : inputMs.value));
const timerParts = computed(() => {
    const s = Math.ceil(left.value / 1000);
    return { h: Math.floor(s / 3600), m: Math.floor(s / 60) % 60, s: s % 60 };
});
const fmt = computed(() => `${timerParts.value.h ? pad(timerParts.value.h) + ":" : ""}${pad(timerParts.value.m)}:${pad(timerParts.value.s)}`);
const R = 90;
const C = 2 * Math.PI * R;
const progress = computed(() => (total.value ? Math.min(1, Math.max(0, left.value / total.value)) : 1));

function setPreset(min: number) {
    if (running.value) return;
    hh.value = Math.floor(min / 60);
    mm.value = min % 60;
    ss.value = 0;
    resetTimer();
}
function start() {
    if (running.value) return;
    if (!total.value || finished.value) {
        if (inputMs.value <= 0) return;
        total.value = inputMs.value;
        remaining.value = inputMs.value;
    }
    finished.value = false;
    now.value = Date.now();
    endAt.value = now.value + remaining.value;
    running.value = true;
    syncTitle();
}
function pause() {
    if (!running.value) return;
    remaining.value = Math.max(0, endAt.value - Date.now());
    running.value = false;
    restoreTitle();
}
function resetTimer() {
    running.value = false;
    finished.value = false;
    total.value = 0;
    remaining.value = 0;
    restoreTitle();
}
function syncTitle() {
    if (running.value) document.title = `${fmt.value} - Timer`;
}
function restoreTitle() {
    document.title = origTitle;
}
function tick() {
    now.value = Date.now();
    if (running.value) {
        if (endAt.value - now.value <= 0) {
            running.value = false;
            finished.value = true;
            remaining.value = 0;
            restoreTitle();
            alertUser("Timer finished", `Your ${fmtLabel(total.value)} timer is up.`, sound.value);
        } else syncTitle();
    }
}
function fmtLabel(ms: number) {
    const s = Math.round(ms / 1000);
    const parts: string[] = [];
    if (s >= 3600) parts.push(`${Math.floor(s / 3600)}h`);
    if (s % 3600 >= 60) parts.push(`${Math.floor((s % 3600) / 60)}m`);
    if (s % 60 || !parts.length) parts.push(`${s % 60}s`);
    return parts.join(" ");
}

// ---------- Full screen ----------
// Shows one timer or event countdown as large as the screen allows. Uses the Fullscreen API when
// available; otherwise (e.g. iPhone Safari) the overlay simply covers the page.
type FsTarget = { kind: "timer" } | { kind: "event"; id: string };
const fs = ref<FsTarget | null>(null);
const fsEl = ref<HTMLElement | null>(null);
const fsEvent = computed(() => (fs.value?.kind === "event" ? evRows.value.find((e) => e.id === (fs.value as { id: string }).id) ?? null : null));
const controlsVisible = ref(true);
let hideTimer = 0;
let wakeLock: { release: () => Promise<void> } | null = null;

function pokeControls() {
    controlsVisible.value = true;
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => (controlsVisible.value = false), 2500);
}

async function openFullscreen(target: FsTarget) {
    fs.value = target;
    pokeControls();
    await nextTick();
    try {
        await fsEl.value?.requestFullscreen?.();
    } catch {
        /* fall back to the in-page overlay */
    }
    try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
        wakeLock = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
        wakeLock = null;
    }
}

function closeFullscreen() {
    if (!fs.value) return;
    fs.value = null;
    clearTimeout(hideTimer);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    void wakeLock?.release().catch(() => {});
    wakeLock = null;
}

function onFsChange() {
    // The user left browser full screen (Esc, F11, gesture): close the overlay too.
    if (!document.fullscreenElement && fs.value) closeFullscreen();
}

function onFsKey(e: KeyboardEvent) {
    if (!fs.value) return;
    pokeControls();
    if (e.key === "Escape" || e.key === "f" || e.key === "F") {
        e.preventDefault();
        closeFullscreen();
    } else if (fs.value.kind === "timer" && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        if (running.value) pause();
        else start();
    } else if (fs.value.kind === "timer" && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        resetTimer();
    }
}

function startClock() {
    if (!iv) iv = window.setInterval(tick, 250);
}
onMounted(() => {
    startClock();
    document.addEventListener("fullscreenchange", onFsChange);
    window.addEventListener("keydown", onFsKey);
});
// Keep running while deactivated in KeepAlive; just resync when coming back.
onActivated(() => {
    startClock();
    tick();
});
onDeactivated(closeFullscreen);
onBeforeUnmount(() => {
    clearInterval(iv);
    iv = 0;
    if (running.value) restoreTitle();
    closeFullscreen();
    document.removeEventListener("fullscreenchange", onFsChange);
    window.removeEventListener("keydown", onFsKey);
});
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="mode" :options="[{ value: 'event', label: 'Event countdown' }, { value: 'timer', label: 'Timer' }]" />
        </template>

        <template v-if="mode === 'event'">
            <Panel title="New countdown">
                <div class="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
                    <Field label="Title"><input v-model="evTitle" class="input" placeholder="Launch day" @keyup.enter="addEvent" /></Field>
                    <Field label="Date and time"><input v-model="evDate" type="datetime-local" class="input" /></Field>
                    <Btn variant="primary" @click="addEvent"><Plus class="size-4" />Add</Btn>
                </div>
                <div class="mt-3 flex flex-wrap gap-1.5">
                    <button v-for="p in presets" :key="p.label" type="button" class="chip cursor-pointer hover:bg-subtle" @click="usePreset(p)">{{ p.label }}</button>
                </div>
            </Panel>

            <p v-if="!evRows.length" class="py-8 text-center text-sm text-muted">No countdowns yet. Add one above.</p>
            <div class="grid gap-4 lg:grid-cols-2">
                <Panel v-for="e in evRows" :key="e.id" :title="e.title">
                    <template #actions>
                        <Btn size="sm" variant="ghost" title="Full screen" aria-label="Show full screen" @click="openFullscreen({ kind: 'event', id: e.id })"><Maximize class="size-4" /></Btn>
                        <Btn size="sm" variant="ghost" aria-label="Delete" @click="removeEvent(e.id)"><Trash2 class="size-4" /></Btn>
                    </template>
                    <div v-if="e.done" class="py-3 text-center text-lg font-semibold text-accent">It's time!</div>
                    <div v-else class="grid grid-cols-4 gap-2 text-center">
                        <div v-for="[k, v] in [['Days', e.p.d], ['Hours', e.p.h], ['Minutes', e.p.m], ['Seconds', e.p.s]] as [string, number][]" :key="k" class="rounded-lg bg-subtle py-3">
                            <div class="font-mono text-3xl font-semibold tabular-nums sm:text-4xl">{{ k === "Days" ? v : pad(v) }}</div>
                            <div class="text-xs text-muted">{{ k }}</div>
                        </div>
                    </div>
                    <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-subtle"><div class="h-full rounded-full bg-accent" :style="{ width: e.pct + '%' }" /></div>
                    <div class="mt-1.5 flex justify-between text-xs text-muted"><span>{{ new Date(e.target).toLocaleString() }}</span><span>{{ Math.floor(e.pct) }}% elapsed</span></div>
                </Panel>
            </div>
        </template>

        <template v-else>
            <div class="grid gap-4 lg:grid-cols-[1fr_20rem]">
                <Panel title="Timer">
                    <template #actions>
                        <Btn size="sm" variant="ghost" title="Full screen (Space: start/pause, R: reset, Esc: exit)" @click="openFullscreen({ kind: 'timer' })"><Maximize class="size-4" />Full screen</Btn>
                    </template>
                    <div class="flex flex-col items-center gap-5 py-2">
                        <div class="relative size-64 max-w-full">
                            <svg viewBox="0 0 200 200" class="size-full -rotate-90">
                                <circle cx="100" cy="100" :r="R" fill="none" stroke="currentColor" stroke-width="10" class="text-subtle" />
                                <circle cx="100" cy="100" :r="R" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" class="text-accent" :stroke-dasharray="C" :stroke-dashoffset="C * (1 - progress)" />
                            </svg>
                            <div class="absolute inset-0 flex flex-col items-center justify-center">
                                <span class="font-mono text-5xl font-semibold tabular-nums" :class="finished ? 'text-accent' : ''">{{ finished ? "00:00" : fmt }}</span>
                                <span v-if="finished" class="mt-1 text-sm text-muted">Time's up</span>
                                <span v-else-if="total" class="mt-1 text-xs text-muted">of {{ fmtLabel(total) }}</span>
                            </div>
                        </div>
                        <div class="flex flex-wrap justify-center gap-2">
                            <Btn v-if="!running" variant="primary" :disabled="!total && inputMs <= 0" @click="start"><Play class="size-4" />{{ total && !finished ? "Resume" : "Start" }}</Btn>
                            <Btn v-else variant="primary" @click="pause"><Pause class="size-4" />Pause</Btn>
                            <Btn @click="resetTimer"><RotateCcw class="size-4" />Reset</Btn>
                        </div>
                    </div>
                </Panel>
                <Panel title="Settings">
                    <div class="flex flex-col gap-4">
                        <div class="grid grid-cols-3 gap-2">
                            <Field label="Hours"><input v-model.number="hh" type="number" min="0" max="99" class="input" :disabled="running || !!total" /></Field>
                            <Field label="Min"><input v-model.number="mm" type="number" min="0" max="59" class="input" :disabled="running || !!total" /></Field>
                            <Field label="Sec"><input v-model.number="ss" type="number" min="0" max="59" class="input" :disabled="running || !!total" /></Field>
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                            <button v-for="m in [1, 5, 10, 25]" :key="m" type="button" class="chip cursor-pointer hover:bg-subtle disabled:opacity-50" :disabled="running" @click="setPreset(m)">{{ m }} min</button>
                        </div>
                        <Field label="Sound when finished">
                            <select v-model="sound" class="select"><option v-for="o in soundOptions" :key="o.value" :value="o.value">{{ o.label }}</option></select>
                        </Field>
                        <p class="text-xs text-muted">Inputs lock while a timer is active; press Reset to change the duration. The page title shows the time left while running.</p>
                    </div>
                </Panel>
            </div>
        </template>

        <Teleport to="body">
            <div
                v-if="fs"
                ref="fsEl"
                class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg p-6 text-fg select-none"
                :class="controlsVisible ? '' : 'cursor-none'"
                role="dialog"
                aria-modal="true"
                :aria-label="fs.kind === 'timer' ? 'Timer, full screen' : 'Countdown, full screen'"
                @mousemove="pokeControls"
                @pointerdown="pokeControls"
            >
                <button
                    type="button"
                    class="absolute top-4 right-4 grid size-11 cursor-pointer place-items-center rounded-full bg-surface text-fg-subtle shadow-float ring-1 ring-line transition-opacity duration-300 hover:text-accent"
                    :class="controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'"
                    title="Exit full screen (Esc)"
                    aria-label="Exit full screen"
                    @click="closeFullscreen"
                >
                    <Minimize class="size-5" stroke-width="1.75" />
                </button>

                <!-- Timer -->
                <template v-if="fs.kind === 'timer'">
                    <div class="relative aspect-square w-[min(80vw,75vh)]">
                        <svg viewBox="0 0 200 200" class="size-full -rotate-90">
                            <circle cx="100" cy="100" :r="R" fill="none" stroke="currentColor" stroke-width="6" class="text-subtle" />
                            <circle cx="100" cy="100" :r="R" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" class="text-accent transition-[stroke-dashoffset] duration-300 ease-linear" :stroke-dasharray="C" :stroke-dashoffset="C * (1 - progress)" />
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                            <span
                                class="font-mono leading-none font-semibold tabular-nums"
                                :class="finished ? 'animate-pulse text-accent' : ''"
                                :style="{ fontSize: timerParts.h ? 'min(11vw, 10vh)' : 'min(16vw, 15vh)' }"
                            >{{ finished ? "00:00" : fmt }}</span>
                            <span class="mt-[2vh] text-fg-muted" style="font-size: min(3vw, 2.6vh)">{{ finished ? "Time's up" : total ? `of ${fmtLabel(total)}` : "Ready" }}</span>
                        </div>
                    </div>
                    <div class="mt-6 flex flex-wrap justify-center gap-2 transition-opacity duration-300" :class="controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'">
                        <Btn v-if="!running" variant="primary" :disabled="!total && inputMs <= 0" @click="start"><Play class="size-4" />{{ total && !finished ? "Resume" : "Start" }}</Btn>
                        <Btn v-else variant="primary" @click="pause"><Pause class="size-4" />Pause</Btn>
                        <Btn @click="resetTimer"><RotateCcw class="size-4" />Reset</Btn>
                    </div>
                    <p class="mt-3 hidden text-xs text-fg-subtle transition-opacity duration-300 sm:block" :class="controlsVisible ? 'opacity-100' : 'opacity-0'">
                        <kbd class="kbd">Space</kbd> start / pause · <kbd class="kbd">R</kbd> reset · <kbd class="kbd">Esc</kbd> exit
                    </p>
                </template>

                <!-- Event countdown -->
                <template v-else-if="fsEvent">
                    <h2 class="mb-[4vh] max-w-full truncate text-center font-display font-semibold" style="font-size: min(6vw, 7vh)">{{ fsEvent.title }}</h2>
                    <div v-if="fsEvent.done" class="animate-pulse font-display font-semibold text-accent" style="font-size: min(12vw, 14vh)">It's time!</div>
                    <div v-else class="grid w-full max-w-[min(95vw,160vh)] grid-cols-4 gap-[2vw]">
                        <div v-for="[k, v] in [['Days', fsEvent.p.d], ['Hours', fsEvent.p.h], ['Minutes', fsEvent.p.m], ['Seconds', fsEvent.p.s]] as [string, number][]" :key="k" class="rounded-2xl bg-surface py-[3vh] text-center ring-1 ring-line">
                            <div class="font-mono leading-none font-semibold tabular-nums" style="font-size: min(13vw, 22vh)">{{ k === "Days" ? v : pad(v) }}</div>
                            <div class="mt-[1.5vh] text-fg-muted uppercase tracking-wide" style="font-size: min(2.4vw, 2.6vh)">{{ k }}</div>
                        </div>
                    </div>
                    <div class="mt-[5vh] w-full max-w-[min(95vw,160vh)]">
                        <div class="h-2 overflow-hidden rounded-full bg-subtle"><div class="h-full rounded-full bg-accent" :style="{ width: fsEvent.pct + '%' }" /></div>
                        <div class="mt-2 flex justify-between text-sm text-fg-muted"><span>{{ new Date(fsEvent.target).toLocaleString() }}</span><span>{{ Math.floor(fsEvent.pct) }}% elapsed</span></div>
                    </div>
                </template>
            </div>
        </Teleport>
    </ToolPage>
</template>
