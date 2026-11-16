import { ref } from "vue";
import { toast } from "vue-sonner";

/** Shared alert helpers for the productivity tools: sound, desktop notification and an in-app toast. */

export type Sound = "chime" | "bell" | "beep" | "none";

export const soundOptions: { value: Sound; label: string }[] = [
    { value: "chime", label: "Chime" },
    { value: "bell", label: "Bell" },
    { value: "beep", label: "Beep" },
    { value: "none", label: "Silent" },
];

let ctx: AudioContext | null = null;
function audio() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
}

function tone(ac: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = "sine", vol = 0.25) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(at);
    osc.stop(at + dur + 0.05);
}

export function playSound(sound: Sound) {
    if (sound === "none") return;
    try {
        const ac = audio();
        const t = ac.currentTime + 0.02;
        if (sound === "chime") [659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, f, t + i * 0.18, 0.9));
        else if (sound === "bell") for (let i = 0; i < 3; i++) { tone(ac, 880, t + i * 0.6, 1.2, "triangle", 0.3); tone(ac, 1760, t + i * 0.6, 0.6, "sine", 0.08); }
        else for (let i = 0; i < 4; i++) tone(ac, 1000, t + i * 0.25, 0.12, "square", 0.12);
    } catch {
        /* audio unavailable */
    }
}

export const notifyPermission = ref<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
);

export async function requestNotifications() {
    if (typeof Notification === "undefined") return;
    notifyPermission.value = await Notification.requestPermission();
}

/** Sound + desktop notification (when allowed) + toast. */
export function alertUser(title: string, body: string, sound: Sound) {
    playSound(sound);
    toast(title, { description: body, duration: 10000 });
    if (notifyPermission.value === "granted") {
        try {
            const n = new Notification(title, { body, icon: "/favicon.svg", tag: `devtools-${title}` });
            n.onclick = () => {
                window.focus();
                n.close();
            };
        } catch {
            /* some browsers only allow notifications from a service worker */
        }
    }
}

export function fmtDuration(ms: number) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor(total / 60) % 60;
    const s = total % 60;
    const p = (n: number) => String(n).padStart(2, "0");
    return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/**
 * A clock shared by the productivity tools. It keeps running after you leave a tool's page so timers
 * and alarms still fire; the tick handlers are module-level, not tied to a component.
 */
export const now = ref(Date.now());
const tickListeners = new Set<() => void>();
let clock = 0;
export function onClockTick(fn: () => void) {
    tickListeners.add(fn);
    if (!clock) {
        clock = window.setInterval(() => {
            now.value = Date.now();
            tickListeners.forEach((f) => f());
        }, 250);
    }
}
