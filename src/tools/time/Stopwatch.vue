<script lang="ts">
import { reactive } from "vue";

// Module-level state: survives navigating away from the page.
const sw = reactive({
    running: false,
    startedAt: 0,
    accumulated: 0,
    laps: [] as number[], // cumulative totals in ms
});

export function elapsedMs() {
    return sw.accumulated + (sw.running ? performance.now() - sw.startedAt : 0);
}
</script>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref } from "vue";
import { useActiveEventListener } from "@/composables/useActiveEventListener";
import { Download, Flag, Pause, Play, RotateCcw } from "lucide-vue-next";
import { Btn, CopyButton, Panel, ToolPage } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";

const tick = ref(0);
let raf = 0;
function loop() {
    tick.value = elapsedMs();
    raf = requestAnimationFrame(loop);
}

function start() {
    if (sw.running) return;
    sw.startedAt = performance.now();
    sw.running = true;
}
function pause() {
    if (!sw.running) return;
    sw.accumulated = elapsedMs();
    sw.running = false;
}
function toggle() {
    sw.running ? pause() : start();
}
function lap() {
    if (!sw.running) return;
    sw.laps.push(Math.round(elapsedMs()));
}
function reset() {
    sw.running = false;
    sw.accumulated = 0;
    sw.laps = [];
    tick.value = 0;
}

function onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    if (e.code === "Space") {
        if (t?.tagName === "BUTTON") return;
        e.preventDefault();
        toggle();
    } else if (e.key === "l" || e.key === "L") lap();
    else if (e.key === "r" || e.key === "R") reset();
}

useActiveEventListener("keydown", onKey);
// Inside KeepAlive both hooks fire on first mount; restart instead of stacking two loops.
const startLoop = () => {
    cancelAnimationFrame(raf);
    loop();
};
onMounted(startLoop);
onActivated(startLoop);
onDeactivated(() => cancelAnimationFrame(raf));
onUnmounted(() => cancelAnimationFrame(raf));

function fmt(ms: number) {
    const cs = Math.floor(ms / 10) % 100;
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000) % 60;
    const h = Math.floor(ms / 3600000);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${h ? `${h}:` : ""}${p(m)}:${p(s)}.${p(cs)}`;
}

const display = computed(() => fmt(tick.value));

const lapRows = computed(() => {
    const rows = sw.laps.map((total, i) => ({ n: i + 1, total, lap: total - (i ? sw.laps[i - 1] : 0) }));
    const times = rows.map((r) => r.lap);
    const fastest = Math.min(...times);
    const slowest = Math.max(...times);
    return rows.map((r) => ({
        ...r,
        kind: rows.length > 1 && r.lap === fastest ? "fast" : rows.length > 1 && r.lap === slowest ? "slow" : "",
    }));
});
const shown = computed(() => [...lapRows.value].reverse());

const csv = computed(() => ["Lap,Lap time,Total", ...lapRows.value.map((r) => `${r.n},${fmt(r.lap)},${fmt(r.total)}`)].join("\n"));
const text = computed(() => lapRows.value.map((r) => `#${r.n}\t${fmt(r.lap)}\t${fmt(r.total)}`).join("\n"));
</script>

<template>
    <ToolPage>
        <div class="flex flex-col items-center gap-5 rounded-xl border border-line bg-surface px-4 py-10 shadow-xs">
            <div class="font-mono text-6xl font-semibold tracking-tight tabular-nums sm:text-8xl" role="timer" aria-live="off">{{ display }}</div>
            <div class="flex flex-wrap justify-center gap-2">
                <Btn variant="primary" @click="toggle">
                    <Pause v-if="sw.running" /><Play v-else />
                    {{ sw.running ? "Pause" : sw.accumulated ? "Resume" : "Start" }}
                </Btn>
                <Btn :disabled="!sw.running" @click="lap"><Flag /> Lap</Btn>
                <Btn :disabled="!sw.accumulated && !sw.running" @click="reset"><RotateCcw /> Reset</Btn>
            </div>
            <p class="text-xs text-muted">
                <span class="kbd">Space</span> start / pause · <span class="kbd">L</span> lap · <span class="kbd">R</span> reset
            </p>
        </div>

        <Panel title="Laps" flush>
            <template #actions>
                <CopyButton :text="text" label="Copy" />
                <Btn size="sm" variant="ghost" :disabled="!sw.laps.length" @click="downloadBlob(csv, 'laps.csv', 'text/csv')"><Download /> CSV</Btn>
            </template>
            <p v-if="!shown.length" class="p-4 text-sm text-muted">No laps yet. Press Lap while the stopwatch is running.</p>
            <div v-else class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="text-left text-xs text-muted uppercase">
                        <tr><th class="px-4 py-2 font-medium">Lap</th><th class="px-4 py-2 font-medium">Lap time</th><th class="px-4 py-2 font-medium">Total</th></tr>
                    </thead>
                    <tbody class="divide-y divide-line border-t border-line font-mono tabular-nums">
                        <tr v-for="r in shown" :key="r.n" :class="r.kind === 'fast' ? 'bg-success/10' : r.kind === 'slow' ? 'bg-danger/10' : ''">
                            <td class="px-4 py-2">#{{ r.n }}</td>
                            <td class="px-4 py-2" :class="r.kind === 'fast' ? 'text-success' : r.kind === 'slow' ? 'text-danger' : ''">
                                {{ fmt(r.lap) }}
                                <span v-if="r.kind" class="ml-1 font-sans text-xs">{{ r.kind === "fast" ? "fastest" : "slowest" }}</span>
                            </td>
                            <td class="px-4 py-2">{{ fmt(r.total) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </Panel>
    </ToolPage>
</template>
