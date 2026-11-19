<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref, watch } from "vue";
import { Mic, MicOff, Play, Square, Timer, Volume2 } from "lucide-vue-next";
import { Btn, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

type Tab = "tone" | "noise" | "metronome" | "mic";
const tab = ref<Tab>("tone");

// ---------- shared audio context ----------
let ctx: AudioContext | null = null;
function getCtx() {
    if (!ctx || ctx.state === "closed") ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);
function nearestNote(f: number) {
    const m = 69 + 12 * Math.log2(f / 440);
    const r = Math.round(m);
    return { name: `${NOTE_NAMES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`, cents: Math.round((m - r) * 100), target: midiFreq(r) };
}

// ---------- tone generator ----------
type Wave = "sine" | "square" | "sawtooth" | "triangle";
const freq = ref(440);
const wave = ref<Wave>("sine");
const toneVol = ref(0.2);
const toneOn = ref(false);
const sweep = ref(false);
const sweepTo = ref(2000);
const sweepSecs = ref(5);
const sweeping = ref(false);
let osc: OscillatorNode | null = null;
let toneGain: GainNode | null = null;
let sweepTimer: ReturnType<typeof setTimeout> | null = null;

const MIN_F = 20;
const MAX_F = 20000;
const sliderVal = computed({
    get: () => Math.round((Math.log(freq.value / MIN_F) / Math.log(MAX_F / MIN_F)) * 1000),
    set: (v: number) => (freq.value = Math.round(MIN_F * (MAX_F / MIN_F) ** (v / 1000) * 10) / 10),
});
function clampFreq(v: number) {
    return Math.min(MAX_F, Math.max(MIN_F, Number.isFinite(v) ? v : 440));
}
const notes = [
    { label: "C4", f: midiFreq(60) },
    { label: "D4", f: midiFreq(62) },
    { label: "E4", f: midiFreq(64) },
    { label: "F4", f: midiFreq(65) },
    { label: "G4", f: midiFreq(67) },
    { label: "A4", f: 440 },
    { label: "B4", f: midiFreq(71) },
    { label: "C5", f: midiFreq(72) },
];
const freqNote = computed(() => nearestNote(freq.value));

function startTone() {
    stopTone();
    const c = getCtx();
    osc = c.createOscillator();
    toneGain = c.createGain();
    osc.type = wave.value;
    const now = c.currentTime;
    osc.frequency.setValueAtTime(clampFreq(freq.value), now);
    toneGain.gain.setValueAtTime(0, now);
    toneGain.gain.linearRampToValueAtTime(toneVol.value, now + 0.03);
    osc.connect(toneGain).connect(c.destination);
    osc.start();
    toneOn.value = true;
    if (sweep.value) {
        const to = clampFreq(sweepTo.value);
        const secs = Math.max(0.1, sweepSecs.value);
        osc.frequency.exponentialRampToValueAtTime(to, now + secs);
        sweeping.value = true;
        const t0 = performance.now();
        const f0 = clampFreq(freq.value);
        const upd = () => {
            if (!sweeping.value) return;
            const p = Math.min(1, (performance.now() - t0) / (secs * 1000));
            freq.value = Math.round(f0 * (to / f0) ** p * 10) / 10;
            if (p < 1) sweepTimer = setTimeout(upd, 60);
            else sweeping.value = false;
        };
        upd();
    }
}
function stopTone() {
    if (sweepTimer) clearTimeout(sweepTimer);
    sweepTimer = null;
    sweeping.value = false;
    if (osc && toneGain && ctx) {
        const now = ctx.currentTime;
        toneGain.gain.cancelScheduledValues(now);
        toneGain.gain.setValueAtTime(toneGain.gain.value, now);
        toneGain.gain.linearRampToValueAtTime(0, now + 0.04);
        osc.stop(now + 0.06);
    }
    osc = null;
    toneGain = null;
    toneOn.value = false;
}
watch(wave, (w) => {
    if (osc) osc.type = w;
});
watch(toneVol, (v) => {
    if (toneGain && ctx) toneGain.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
});
watch(freq, (f) => {
    if (osc && ctx && !sweeping.value) osc.frequency.setTargetAtTime(clampFreq(f), ctx.currentTime, 0.01);
});
function playNote(f: number) {
    freq.value = f;
    if (!toneOn.value) {
        const was = sweep.value;
        sweep.value = false;
        startTone();
        sweep.value = was;
    }
}

// ---------- noise ----------
type NoiseType = "white" | "pink" | "brown";
const noiseType = ref<NoiseType>("pink");
const noiseVol = ref(0.2);
const noiseOn = ref(false);
const sleepMin = ref(0);
const sleepLeft = ref(0);
let noiseSrc: AudioBufferSourceNode | null = null;
let noiseGain: GainNode | null = null;
let sleepTimer: ReturnType<typeof setInterval> | null = null;
let sleepEnd = 0;

function makeNoise(c: AudioContext, type: NoiseType) {
    const len = c.sampleRate * 4;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    if (type === "white") {
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else if (type === "pink") {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < len; i++) {
            const w = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + w * 0.0555179;
            b1 = 0.99332 * b1 + w * 0.0750759;
            b2 = 0.969 * b2 + w * 0.153852;
            b3 = 0.8665 * b3 + w * 0.3104856;
            b4 = 0.55 * b4 + w * 0.5329522;
            b5 = -0.7616 * b5 - w * 0.016898;
            d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
            b6 = w * 0.115926;
        }
    } else {
        let last = 0;
        for (let i = 0; i < len; i++) {
            const w = Math.random() * 2 - 1;
            last = (last + 0.02 * w) / 1.02;
            d[i] = last * 3.5;
        }
    }
    return buf;
}
function startNoise() {
    stopNoise();
    const c = getCtx();
    noiseSrc = c.createBufferSource();
    noiseSrc.buffer = makeNoise(c, noiseType.value);
    noiseSrc.loop = true;
    noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(0, c.currentTime);
    noiseGain.gain.linearRampToValueAtTime(noiseVol.value, c.currentTime + 0.1);
    noiseSrc.connect(noiseGain).connect(c.destination);
    noiseSrc.start();
    noiseOn.value = true;
    if (sleepMin.value > 0) {
        sleepEnd = Date.now() + sleepMin.value * 60000;
        sleepLeft.value = sleepMin.value * 60;
        sleepTimer = setInterval(() => {
            sleepLeft.value = Math.max(0, Math.round((sleepEnd - Date.now()) / 1000));
            if (sleepLeft.value <= 0) stopNoise(true);
        }, 500);
    }
}
function stopNoise(fade = false) {
    if (sleepTimer) clearInterval(sleepTimer);
    sleepTimer = null;
    sleepLeft.value = 0;
    if (noiseSrc && noiseGain && ctx) {
        const now = ctx.currentTime;
        const dur = fade ? 2 : 0.05;
        noiseGain.gain.cancelScheduledValues(now);
        noiseGain.gain.setValueAtTime(noiseGain.gain.value, now);
        noiseGain.gain.linearRampToValueAtTime(0, now + dur);
        noiseSrc.stop(now + dur + 0.02);
    }
    noiseSrc = null;
    noiseGain = null;
    noiseOn.value = false;
}
watch(noiseVol, (v) => {
    if (noiseGain && ctx) noiseGain.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
});
watch(noiseType, () => {
    if (noiseOn.value) startNoise();
});
const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// ---------- metronome ----------
const bpm = ref(100);
const beatsPerBar = ref(4);
const metVol = ref(0.4);
const metOn = ref(false);
const activeBeat = ref(-1);
let schedTimer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0;
let beatIdx = 0;
let metRaf = 0;
const queue: { time: number; beat: number }[] = [];

function click(time: number, accent: boolean) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = accent ? 1500 : 1000;
    o.type = "square";
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, metVol.value), time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    o.connect(g).connect(ctx.destination);
    o.start(time);
    o.stop(time + 0.06);
}
function schedule() {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.12) {
        click(nextTime, beatIdx === 0);
        queue.push({ time: nextTime, beat: beatIdx });
        nextTime += 60 / bpm.value;
        beatIdx = (beatIdx + 1) % beatsPerBar.value;
    }
}
function visual() {
    if (!ctx) return;
    while (queue.length && queue[0].time <= ctx.currentTime) activeBeat.value = queue.shift()!.beat;
    metRaf = requestAnimationFrame(visual);
}
function startMet() {
    stopMet();
    const c = getCtx();
    beatIdx = 0;
    nextTime = c.currentTime + 0.06;
    queue.length = 0;
    schedule();
    schedTimer = setInterval(schedule, 25);
    metRaf = requestAnimationFrame(visual);
    metOn.value = true;
}
function stopMet() {
    if (schedTimer) clearInterval(schedTimer);
    schedTimer = null;
    cancelAnimationFrame(metRaf);
    queue.length = 0;
    activeBeat.value = -1;
    metOn.value = false;
}
watch(beatsPerBar, () => {
    beatIdx = 0;
});
let taps: number[] = [];
function tap() {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
    taps.push(now);
    taps = taps.slice(-6);
    if (taps.length >= 2) {
        const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
        bpm.value = Math.min(300, Math.max(30, Math.round(60000 / avg)));
    }
}
const tempoName = computed(() => {
    const b = bpm.value;
    return b < 60 ? "Largo" : b < 76 ? "Adagio" : b < 108 ? "Andante" : b < 120 ? "Moderato" : b < 156 ? "Allegro" : b < 176 ? "Vivace" : "Presto";
});

// ---------- mic meter ----------
const micOn = ref(false);
const micError = ref("");
const micView = ref<"wave" | "spectrum">("wave");
const db = ref(-Infinity);
const peakDb = ref(-Infinity);
const pitch = ref<{ hz: number; name: string; cents: number } | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
let stream: MediaStream | null = null;
let micSrc: MediaStreamAudioSourceNode | null = null;
let analyser: AnalyserNode | null = null;
let micRaf = 0;
let lastUi = 0;
let peakHold = -Infinity;
let peakAt = 0;

function autoCorrelate(input: Float32Array, sr: number) {
    let buf = input;
    let size = buf.length;
    let sum = 0;
    for (let i = 0; i < size; i++) sum += buf[i] * buf[i];
    if (Math.sqrt(sum / size) < 0.01) return -1;
    let r1 = 0;
    let r2 = size - 1;
    for (let i = 0; i < size / 2; i++) if (Math.abs(buf[i]) < 0.2) { r1 = i; break; }
    for (let i = 1; i < size / 2; i++) if (Math.abs(buf[size - i]) < 0.2) { r2 = size - i; break; }
    buf = buf.slice(r1, r2);
    size = buf.length;
    if (size < 64) return -1;
    const c = new Float32Array(size);
    for (let lag = 0; lag < size; lag++) {
        let s = 0;
        for (let j = 0; j < size - lag; j++) s += buf[j] * buf[j + lag];
        c[lag] = s;
    }
    let d = 0;
    while (d < size - 1 && c[d] > c[d + 1]) d++;
    let maxv = -1;
    let maxp = -1;
    for (let i = d; i < size; i++) if (c[i] > maxv) { maxv = c[i]; maxp = i; }
    if (maxp <= 0 || maxp >= size - 1) return -1;
    const x1 = c[maxp - 1], x2 = c[maxp], x3 = c[maxp + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    const t0 = a ? maxp - b / (2 * a) : maxp;
    const hz = sr / t0;
    return hz >= 50 && hz <= 2000 ? hz : -1;
}

function cssVar(name: string, fallback: string) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
}

function draw() {
    micRaf = requestAnimationFrame(draw);
    if (!analyser || !ctx) return;
    const time = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(time);
    let sum = 0;
    for (const v of time) sum += v * v;
    const rms = Math.sqrt(sum / time.length);
    const level = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    const now = performance.now();
    if (level > peakHold || now - peakAt > 1500) { peakHold = level; peakAt = now; }

    const cv = canvasEl.value;
    if (cv) {
        const dpr = window.devicePixelRatio || 1;
        const w = cv.clientWidth;
        const h = cv.clientHeight;
        if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        const g = cv.getContext("2d");
        if (g) {
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.clearRect(0, 0, w, h);
            const accent = cssVar("--accent", "#0d9488");
            g.strokeStyle = accent;
            g.fillStyle = accent;
            g.lineWidth = 2;
            if (micView.value === "wave") {
                g.beginPath();
                const step = time.length / w;
                for (let x = 0; x < w; x++) {
                    const y = h / 2 - time[Math.floor(x * step)] * (h / 2) * 0.95;
                    if (x === 0) g.moveTo(x, y);
                    else g.lineTo(x, y);
                }
                g.stroke();
            } else {
                const f = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(f);
                const maxBin = Math.floor((f.length * 8000) / (ctx.sampleRate / 2)); // up to ~8 kHz
                const bw = w / maxBin;
                for (let i = 0; i < maxBin; i++) {
                    const bh = (f[i] / 255) * h;
                    g.fillRect(i * bw, h - bh, Math.max(1, bw - 0.5), bh);
                }
            }
        }
    }
    if (now - lastUi > 100) {
        lastUi = now;
        db.value = level;
        peakDb.value = peakHold;
        const hz = autoCorrelate(time, ctx.sampleRate);
        if (hz > 0) {
            const n = nearestNote(hz);
            pitch.value = { hz, name: n.name, cents: Math.round(1200 * Math.log2(hz / n.target)) };
        } else pitch.value = null;
    }
}

async function startMic() {
    micError.value = "";
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
        micError.value = e instanceof Error ? e.message : "Microphone access was denied.";
        return;
    }
    const c = getCtx();
    micSrc = c.createMediaStreamSource(stream);
    analyser = c.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.7;
    micSrc.connect(analyser);
    micOn.value = true;
    await nextTick();
    draw();
}
function stopMic() {
    cancelAnimationFrame(micRaf);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    micSrc?.disconnect();
    micSrc = null;
    analyser?.disconnect();
    analyser = null;
    micOn.value = false;
    db.value = -Infinity;
    peakDb.value = -Infinity;
    pitch.value = null;
}
const meterPct = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(100, ((v + 90) / 90) * 100)) : 0);
const fmtDb = (v: number) => (Number.isFinite(v) ? `${v.toFixed(1)} dB` : "-∞ dB");

// ---------- lifecycle ----------
function stopAll() {
    stopTone();
    stopNoise();
    stopMet();
    stopMic();
    if (ctx && ctx.state !== "closed") void ctx.close();
    ctx = null;
}
watch(tab, () => stopAll());
onDeactivated(stopAll);
onBeforeUnmount(stopAll);
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs
                v-model="tab"
                :options="[
                    { value: 'tone', label: 'Tone generator' },
                    { value: 'noise', label: 'Noise' },
                    { value: 'metronome', label: 'Metronome' },
                    { value: 'mic', label: 'Mic meter' },
                ]"
            />
        </template>

        <!-- Tone generator -->
        <template v-if="tab === 'tone'">
            <Notice type="warning">Protect your hearing: start with the volume low and raise it slowly. Very high or very low frequencies can be loud or harmful without sounding it, and headphones amplify the risk.</Notice>
            <Panel title="Tone generator">
                <div class="space-y-5">
                    <div class="flex flex-wrap items-end gap-4">
                        <div class="font-display text-5xl font-semibold tabular-nums text-fg">{{ freq }}<span class="ml-1 text-xl text-muted">Hz</span></div>
                        <div class="pb-1 text-sm text-muted">≈ {{ freqNote.name }} <span v-if="freqNote.cents">({{ freqNote.cents > 0 ? "+" : "" }}{{ freqNote.cents }}¢)</span></div>
                    </div>
                    <div class="grid gap-4 md:grid-cols-[1fr_140px]">
                        <Field label="Frequency (log scale, 20 Hz – 20 kHz)">
                            <input v-model.number="sliderVal" type="range" min="0" max="1000" step="1" class="range" aria-label="Frequency" />
                        </Field>
                        <Field label="Exact (Hz)">
                            <input :value="freq" type="number" min="20" max="20000" step="any" class="input font-mono" @change="freq = clampFreq(Number(($event.target as HTMLInputElement).value))" />
                        </Field>
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                        <Btn v-for="n in notes" :key="n.label" size="sm" :variant="Math.abs(freq - n.f) < 0.05 ? 'primary' : 'secondary'" @click="playNote(Math.round(n.f * 100) / 100)">{{ n.label }}</Btn>
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <Field label="Waveform">
                            <Tabs v-model="wave" size="sm" :options="[{ value: 'sine', label: 'Sine' }, { value: 'square', label: 'Square' }, { value: 'sawtooth', label: 'Sawtooth' }, { value: 'triangle', label: 'Triangle' }]" />
                        </Field>
                        <Field :label="`Volume ${Math.round(toneVol * 100)}%`">
                            <input v-model.number="toneVol" type="range" min="0" max="1" step="0.01" class="range" aria-label="Volume" />
                        </Field>
                    </div>
                    <div class="rounded-lg bg-subtle p-3">
                        <label class="flex cursor-pointer items-center gap-2 text-sm font-medium"><input v-model="sweep" type="checkbox" class="checkbox" /> Sweep from current frequency</label>
                        <div v-if="sweep" class="mt-3 grid gap-3 sm:grid-cols-2">
                            <Field label="To (Hz)"><input v-model.number="sweepTo" type="number" min="20" max="20000" class="input font-mono" /></Field>
                            <Field label="Duration (seconds)"><input v-model.number="sweepSecs" type="number" min="0.5" max="120" step="0.5" class="input font-mono" /></Field>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <Btn v-if="!toneOn" variant="primary" @click="startTone"><Play /> Play</Btn>
                        <Btn v-else variant="danger" @click="stopTone"><Square /> Stop</Btn>
                        <span v-if="sweeping" class="text-sm text-muted">Sweeping…</span>
                    </div>
                </div>
            </Panel>
        </template>

        <!-- Noise -->
        <Panel v-else-if="tab === 'noise'" title="Noise generator">
            <div class="space-y-5">
                <div class="grid gap-4 sm:grid-cols-3">
                    <Field label="Colour">
                        <Tabs v-model="noiseType" size="sm" :options="[{ value: 'white', label: 'White' }, { value: 'pink', label: 'Pink' }, { value: 'brown', label: 'Brown' }]" />
                    </Field>
                    <Field :label="`Volume ${Math.round(noiseVol * 100)}%`">
                        <input v-model.number="noiseVol" type="range" min="0" max="1" step="0.01" class="range" aria-label="Volume" />
                    </Field>
                    <Field label="Sleep timer">
                        <select v-model.number="sleepMin" class="select" :disabled="noiseOn">
                            <option :value="0">Off</option>
                            <option :value="5">5 minutes</option>
                            <option :value="15">15 minutes</option>
                            <option :value="30">30 minutes</option>
                            <option :value="60">1 hour</option>
                            <option :value="120">2 hours</option>
                        </select>
                    </Field>
                </div>
                <p class="text-sm text-muted">White: equal energy per frequency (hiss). Pink: equal energy per octave (rain-like). Brown: deep rumble.</p>
                <div class="flex flex-wrap items-center gap-3">
                    <Btn v-if="!noiseOn" variant="primary" @click="startNoise"><Play /> Play</Btn>
                    <Btn v-else variant="danger" @click="stopNoise()"><Square /> Stop</Btn>
                    <span v-if="sleepLeft" class="chip"><Timer class="size-3.5" /> Stops in {{ fmtClock(sleepLeft) }}</span>
                </div>
            </div>
        </Panel>

        <!-- Metronome -->
        <Panel v-else-if="tab === 'metronome'" title="Metronome">
            <div class="space-y-5">
                <div class="flex flex-wrap items-end justify-between gap-3">
                    <div class="font-display text-5xl font-semibold tabular-nums">{{ bpm }}<span class="ml-1 text-xl text-muted">BPM</span></div>
                    <span class="text-sm text-muted">{{ tempoName }}</span>
                </div>
                <div class="grid gap-4 md:grid-cols-[1fr_120px]">
                    <Field label="Tempo (30–300)"><input v-model.number="bpm" type="range" min="30" max="300" step="1" class="range" aria-label="BPM" /></Field>
                    <Field label="BPM"><input v-model.number="bpm" type="number" min="30" max="300" class="input font-mono" @change="bpm = Math.min(300, Math.max(30, Math.round(bpm || 100)))" /></Field>
                </div>
                <div class="grid gap-4 sm:grid-cols-2">
                    <Field :label="`Beats per bar: ${beatsPerBar}`"><input v-model.number="beatsPerBar" type="range" min="1" max="12" step="1" class="range" aria-label="Beats per bar" /></Field>
                    <Field :label="`Volume ${Math.round(metVol * 100)}%`"><input v-model.number="metVol" type="range" min="0" max="1" step="0.01" class="range" aria-label="Volume" /></Field>
                </div>
                <div class="flex flex-wrap gap-2" aria-label="Beat indicator">
                    <span
                        v-for="i in beatsPerBar"
                        :key="i"
                        class="grid size-9 place-items-center rounded-full text-xs font-semibold ring-1 transition-[background-color,transform] duration-75"
                        :class="activeBeat === i - 1 ? (i === 1 ? 'scale-110 bg-accent text-accent-fg ring-accent' : 'scale-110 bg-inverse text-inverse-fg ring-line') : 'bg-subtle text-muted ring-line'"
                    >{{ i }}</span>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <Btn v-if="!metOn" variant="primary" @click="startMet"><Play /> Start</Btn>
                    <Btn v-else variant="danger" @click="stopMet"><Square /> Stop</Btn>
                    <Btn @click="tap">Tap tempo</Btn>
                    <span class="text-xs text-muted">Tap at least twice to set the tempo.</span>
                </div>
            </div>
        </Panel>

        <!-- Mic meter -->
        <template v-else>
            <Notice v-if="micError" type="error">{{ micError }}</Notice>
            <Panel title="Mic meter">
                <template #actions>
                    <Tabs v-model="micView" size="sm" :options="[{ value: 'wave', label: 'Waveform' }, { value: 'spectrum', label: 'Spectrum' }]" />
                </template>
                <div class="space-y-5">
                    <div class="flex flex-wrap items-center gap-3">
                        <Btn v-if="!micOn" variant="primary" @click="startMic"><Mic /> Start microphone</Btn>
                        <Btn v-else variant="danger" @click="stopMic"><MicOff /> Stop microphone</Btn>
                        <span class="text-xs text-muted">Audio is analysed locally and never recorded or uploaded.</span>
                    </div>
                    <div>
                        <div class="mb-1.5 flex items-center justify-between text-sm">
                            <span class="inline-flex items-center gap-1.5 font-medium"><Volume2 class="size-4" /> Level</span>
                            <span class="font-mono tabular-nums">{{ fmtDb(db) }} <span class="text-muted">· peak {{ fmtDb(peakDb) }}</span></span>
                        </div>
                        <div class="relative h-3 overflow-hidden rounded-full bg-subtle ring-1 ring-line ring-inset">
                            <div class="h-full rounded-full bg-accent transition-[width] duration-75" :style="{ width: meterPct(db) + '%' }" />
                            <div class="absolute top-0 h-full w-0.5 bg-fg" :style="{ left: meterPct(peakDb) + '%' }" />
                        </div>
                        <div class="mt-1 flex justify-between text-[10px] text-muted"><span>-90</span><span>-60</span><span>-30</span><span>0 dBFS</span></div>
                    </div>
                    <canvas ref="canvasEl" class="h-40 w-full rounded-lg bg-subtle ring-1 ring-line ring-inset" />
                    <div class="grid grid-cols-3 gap-3 text-sm">
                        <div><div class="text-xs text-muted">Pitch</div><div class="font-mono text-lg font-semibold tabular-nums">{{ pitch ? pitch.hz.toFixed(1) + " Hz" : "—" }}</div></div>
                        <div><div class="text-xs text-muted">Nearest note</div><div class="font-display text-lg font-semibold">{{ pitch ? pitch.name : "—" }}</div></div>
                        <div><div class="text-xs text-muted">Offset</div><div class="font-mono text-lg font-semibold tabular-nums">{{ pitch ? (pitch.cents > 0 ? "+" : "") + pitch.cents + "¢" : "—" }}</div></div>
                    </div>
                </div>
            </Panel>
        </template>
    </ToolPage>
</template>
