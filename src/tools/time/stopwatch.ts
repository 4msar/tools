// Stopwatch state at module level: it keeps running across pages and can be started from the chat.
import { reactive } from "vue";

// Module-level state: survives navigating away from the page.
export const sw = reactive({
    running: false,
    startedAt: 0,
    accumulated: 0,
    laps: [] as number[], // cumulative totals in ms
});

export function elapsedMs() {
    return sw.accumulated + (sw.running ? performance.now() - sw.startedAt : 0);
}

export function start() {
    if (sw.running) return;
    sw.startedAt = performance.now();
    sw.running = true;
}
export function pause() {
    if (!sw.running) return;
    sw.accumulated = elapsedMs();
    sw.running = false;
}
export function toggle() {
    sw.running ? pause() : start();
}
export function lap() {
    if (!sw.running) return;
    sw.laps.push(Math.round(elapsedMs()));
}
export function reset() {
    sw.running = false;
    sw.accumulated = 0;
    sw.laps = [];
}

