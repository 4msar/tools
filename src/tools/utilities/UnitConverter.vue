<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Btn, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

interface Unit { id: string; name: string; f: number }
interface Cat { id: string; label: string; units: Unit[]; temp?: boolean }

const u = (id: string, name: string, f: number): Unit => ({ id, name, f });
const cats: Cat[] = [
    { id: "length", label: "Length", units: [
        u("m", "Meter", 1), u("km", "Kilometer", 1e3), u("cm", "Centimeter", 1e-2), u("mm", "Millimeter", 1e-3),
        u("µm", "Micrometer", 1e-6), u("nm", "Nanometer", 1e-9), u("mi", "Mile", 1609.344), u("yd", "Yard", 0.9144),
        u("ft", "Foot", 0.3048), u("in", "Inch", 0.0254), u("nmi", "Nautical mile", 1852),
    ] },
    { id: "mass", label: "Mass", units: [
        u("kg", "Kilogram", 1), u("g", "Gram", 1e-3), u("mg", "Milligram", 1e-6), u("µg", "Microgram", 1e-9),
        u("t", "Metric ton", 1e3), u("lb", "Pound", 0.45359237), u("oz", "Ounce", 0.028349523125),
        u("st", "Stone", 6.35029318), u("ton", "US ton", 907.18474), u("LT", "UK long ton", 1016.0469088),
    ] },
    { id: "temperature", label: "Temperature", temp: true, units: [
        u("°C", "Celsius", 1), u("°F", "Fahrenheit", 1), u("K", "Kelvin", 1), u("°R", "Rankine", 1),
    ] },
    { id: "area", label: "Area", units: [
        u("m²", "Square meter", 1), u("km²", "Square kilometer", 1e6), u("cm²", "Square centimeter", 1e-4),
        u("mm²", "Square millimeter", 1e-6), u("ha", "Hectare", 1e4), u("acre", "Acre", 4046.8564224),
        u("mi²", "Square mile", 2589988.110336), u("yd²", "Square yard", 0.83612736),
        u("ft²", "Square foot", 0.09290304), u("in²", "Square inch", 0.00064516),
    ] },
    { id: "volume", label: "Volume", units: [
        u("L", "Liter", 1), u("mL", "Milliliter", 1e-3), u("m³", "Cubic meter", 1e3), u("gal", "US gallon", 3.785411784),
        u("qt", "US quart", 0.946352946), u("pt", "US pint", 0.473176473), u("cup", "US cup", 0.2365882365),
        u("fl oz", "US fluid ounce", 0.0295735295625), u("tbsp", "US tablespoon", 0.01478676478125),
        u("tsp", "US teaspoon", 0.00492892159375), u("imp gal", "Imperial gallon", 4.54609),
        u("ft³", "Cubic foot", 28.316846592), u("in³", "Cubic inch", 0.016387064),
    ] },
    { id: "speed", label: "Speed", units: [
        u("m/s", "Meters per second", 1), u("km/h", "Kilometers per hour", 1 / 3.6), u("mph", "Miles per hour", 0.44704),
        u("kn", "Knot", 1852 / 3600), u("ft/s", "Feet per second", 0.3048), u("Mach", "Mach (sea level)", 340.29),
    ] },
    { id: "time", label: "Time", units: [
        u("ns", "Nanosecond", 1e-9), u("µs", "Microsecond", 1e-6), u("ms", "Millisecond", 1e-3), u("s", "Second", 1),
        u("min", "Minute", 60), u("h", "Hour", 3600), u("d", "Day", 86400), u("wk", "Week", 604800),
        u("mo", "Month (30.4375 d)", 2629800), u("yr", "Year (365.25 d)", 31557600),
    ] },
    { id: "data", label: "Data", units: [
        u("bit", "Bit", 0.125), u("B", "Byte", 1),
        u("kB", "Kilobyte (SI)", 1e3), u("MB", "Megabyte (SI)", 1e6), u("GB", "Gigabyte (SI)", 1e9),
        u("TB", "Terabyte (SI)", 1e12), u("PB", "Petabyte (SI)", 1e15),
        u("KiB", "Kibibyte (IEC)", 1024), u("MiB", "Mebibyte (IEC)", 1024 ** 2), u("GiB", "Gibibyte (IEC)", 1024 ** 3),
        u("TiB", "Tebibyte (IEC)", 1024 ** 4), u("PiB", "Pebibyte (IEC)", 1024 ** 5),
    ] },
    { id: "pressure", label: "Pressure", units: [
        u("Pa", "Pascal", 1), u("kPa", "Kilopascal", 1e3), u("MPa", "Megapascal", 1e6), u("bar", "Bar", 1e5),
        u("mbar", "Millibar", 100), u("atm", "Atmosphere", 101325), u("psi", "Pound per sq inch", 6894.757293168),
        u("mmHg", "Millimeter of mercury", 133.322387415), u("Torr", "Torr", 101325 / 760), u("inHg", "Inch of mercury", 3386.389),
    ] },
    { id: "energy", label: "Energy", units: [
        u("J", "Joule", 1), u("kJ", "Kilojoule", 1e3), u("MJ", "Megajoule", 1e6), u("cal", "Calorie", 4.184),
        u("kcal", "Kilocalorie", 4184), u("Wh", "Watt-hour", 3600), u("kWh", "Kilowatt-hour", 3.6e6),
        u("BTU", "British thermal unit", 1055.05585262), u("eV", "Electronvolt", 1.602176634e-19),
        u("ft·lbf", "Foot-pound force", 1.3558179483314004),
    ] },
];

const catId = ref("length");
const cat = computed(() => cats.find((c) => c.id === catId.value)!);
const from = ref("m");
const raw = ref("1");

watch(catId, () => {
    from.value = cat.value.units[0].id;
});

function toC(v: number, id: string) {
    return id === "°C" ? v : id === "°F" ? ((v - 32) * 5) / 9 : id === "K" ? v - 273.15 : ((v - 491.67) * 5) / 9;
}
function fromC(c: number, id: string) {
    return id === "°C" ? c : id === "°F" ? (c * 9) / 5 + 32 : id === "K" ? c + 273.15 : ((c + 273.15) * 9) / 5;
}

function fmt(n: number) {
    if (!Number.isFinite(n)) return "—";
    if (n === 0) return "0";
    const a = Math.abs(n);
    if (a >= 1e15 || a < 1e-6) return n.toExponential(8).replace(/\.?0+e/, "e");
    return String(parseFloat(n.toPrecision(12)));
}

const value = computed(() => (raw.value.trim() === "" ? NaN : Number(raw.value)));

const results = computed(() => {
    const v = value.value;
    if (!Number.isFinite(v)) return [];
    const c = cat.value;
    const src = c.units.find((x) => x.id === from.value) ?? c.units[0];
    const base = c.temp ? toC(v, src.id) : v * src.f;
    return c.units.map((x) => {
        const out = c.temp ? fromC(base, x.id) : base / x.f;
        return { ...x, text: fmt(out), isFrom: x.id === src.id };
    });
});
</script>

<template>
    <ToolPage>
        <Tabs v-model="catId" :options="cats.map((c) => ({ value: c.id, label: c.label }))" size="sm" />

        <Panel title="Convert">
            <div class="grid gap-3 sm:grid-cols-[1fr_1fr]">
                <Field label="Value"><input v-model="raw" class="input font-mono" inputmode="decimal" spellcheck="false" placeholder="1" /></Field>
                <Field label="From">
                    <select v-model="from" class="select">
                        <option v-for="x in cat.units" :key="x.id" :value="x.id">{{ x.name }} ({{ x.id }})</option>
                    </select>
                </Field>
            </div>
            <div class="mt-3 flex flex-wrap gap-1.5">
                <Btn v-for="n in ['1', '10', '100', '1000']" :key="n" size="sm" variant="ghost" @click="raw = n">{{ n }}</Btn>
            </div>
        </Panel>

        <Notice v-if="raw.trim() && !Number.isFinite(value)" type="error">Enter a valid number.</Notice>
        <Panel v-else title="Results" flush>
            <ul class="divide-y divide-line">
                <li
                    v-for="r in results"
                    :key="r.id"
                    class="flex items-center gap-3 px-4 py-2 hover:bg-subtle"
                    :class="r.isFrom ? 'bg-accent/10' : ''"
                >
                    <button type="button" class="min-w-0 flex-1 cursor-pointer text-left" :title="`Convert from ${r.name}`" @click="from = r.id; raw = r.text">
                        <span class="block font-mono text-sm break-all tabular-nums">{{ r.text }} <span class="text-muted">{{ r.id }}</span></span>
                        <span class="block text-xs text-muted">{{ r.name }}</span>
                    </button>
                    <CopyButton :text="r.text" icon-only />
                </li>
            </ul>
        </Panel>
        <p v-if="catId === 'data'" class="text-xs text-muted">SI units (kB, MB) are powers of 1000. IEC units (KiB, MiB) are powers of 1024.</p>
    </ToolPage>
</template>
