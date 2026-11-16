// Pomodoro state lives at module level so the timer keeps running across pages and can be driven from the chat assistant.
import { computed, reactive } from "vue";
import { useStorage } from "@vueuse/core";
import { alertUser, now, onClockTick, type Sound } from "./alert";

export type Phase = "focus" | "short" | "long";

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

export function pause() {
    if (!st.running) return;
    st.remaining = Math.max(0, st.endsAt - Date.now());
    st.running = false;
}

export { st, setPhase, start, finish, skip, phaseMinutes };
