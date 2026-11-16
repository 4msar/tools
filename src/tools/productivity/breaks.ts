// Break reminder state, shared by the tool page and the chat assistant.
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

export const defaultHabits: Habit[] = [
    { id: "eyes", name: "Rest your eyes", tip: "20-20-20: look at something 20 feet away for 20 seconds.", every: 20, enabled: true },
    { id: "water", name: "Drink water", tip: "Have a glass of water.", every: 45, enabled: true },
    { id: "stretch", name: "Stretch", tip: "Stand up, roll your shoulders and stretch your back and wrists.", every: 60, enabled: true },
    { id: "posture", name: "Check posture", tip: "Feet flat, back against the chair, screen at eye level.", every: 30, enabled: false },
    { id: "walk", name: "Take a walk", tip: "Get up and walk around for a few minutes.", every: 90, enabled: false },
];

export const habits = useStorage<Habit[]>("devtools:break-habits", defaultHabits);
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

export function setBreaksRunning(on: boolean) {
    run.on = on;
    if (on) habits.value.filter((h) => h.enabled).forEach(schedule);
}
