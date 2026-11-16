// Alarms & Reminders store. Imported from main.ts so saved reminders fire on every page, not only the tool page.
import { useStorage } from "@vueuse/core";
import { alertUser, onClockTick, type Sound } from "./alert";

export interface Reminder {
    id: string;
    label: string;
    kind: "timer" | "alarm";
    /** Epoch ms when it fires next. */
    at: number;
    /** Timer length in ms (timers only), so it can be restarted. */
    duration?: number;
    /** Alarms: repeat every day at the same time. */
    daily?: boolean;
    sound: Sound;
    active: boolean;
    firedAt?: number;
    /** Timers: remaining ms while paused. */
    paused?: number;
}

// Stored so alarms survive a reload; a reminder that came due while the page was closed fires on load.
export const reminders = useStorage<Reminder[]>("devtools:reminders", []);

onClockTick(() => {
    const t = Date.now();
    for (const r of reminders.value) {
        if (!r.active || t < r.at) continue;
        const late = t - r.at > 60_000;
        alertUser(r.label || (r.kind === "timer" ? "Timer finished" : "Alarm"), late ? `Due at ${new Date(r.at).toLocaleTimeString()} (missed while the page was closed)` : r.kind === "timer" ? "Your timer is up." : `It's ${new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`, r.sound);
        r.firedAt = t;
        if (r.kind === "alarm" && r.daily) {
            while (r.at <= t) r.at += 86_400_000;
        } else r.active = false;
    }
});
