// Unit data and conversion, shared by the Unit Converter and the chat assistant.
export interface Unit { id: string; name: string; f: number }
export interface Cat { id: string; label: string; units: Unit[]; temp?: boolean }

const u = (id: string, name: string, f: number): Unit => ({ id, name, f });
export const cats: Cat[] = [
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

export function toC(v: number, id: string) {
    return id === "°C" ? v : id === "°F" ? ((v - 32) * 5) / 9 : id === "K" ? v - 273.15 : ((v - 491.67) * 5) / 9;
}
export function fromC(c: number, id: string) {
    return id === "°C" ? c : id === "°F" ? (c * 9) / 5 + 32 : id === "K" ? c + 273.15 : ((c + 273.15) * 9) / 5;
}

export function fmt(n: number) {
    if (!Number.isFinite(n)) return "—";
    if (n === 0) return "0";
    const a = Math.abs(n);
    if (a >= 1e15 || a < 1e-6) return n.toExponential(8).replace(/\.?0+e/, "e");
    return String(parseFloat(n.toPrecision(12)));
}


/** Find a unit by id, symbol-ish alias or name, e.g. "km", "miles", "celsius". */
export function findUnit(q: string): { cat: Cat; unit: Unit } | null {
    const k = q.trim().toLowerCase().replace(/\.$/, "");
    const alias: Record<string, string> = { c: "°C", celsius: "°C", f: "°F", fahrenheit: "°F", kelvin: "K", meters: "m", metres: "m", feet: "ft", inches: "in", miles: "mi", pounds: "lb", lbs: "lb", ounces: "oz", grams: "g", kilograms: "kg", kgs: "kg" };
    const id = alias[k] ?? k;
    for (const cat of cats) {
        const unit = cat.units.find((x) => x.id.toLowerCase() === id.toLowerCase() || x.name.toLowerCase() === k || `${x.name.toLowerCase()}s` === k);
        if (unit) return { cat, unit };
    }
    return null;
}

export function convertUnit(v: number, cat: Cat, from: Unit, to: Unit) {
    const base = cat.temp ? toC(v, from.id) : v * from.f;
    return cat.temp ? fromC(base, to.id) : base / to.f;
}
