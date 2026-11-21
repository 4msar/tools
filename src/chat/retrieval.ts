import { tools, type ToolDef } from "@/tools/registry";
import { favorites, recents } from "@/composables/prefs";

const stopwords = new Set(
    "a an and are as at be can do for from get how i in into is it me my need of on or please some that the this to tool tools use want what with you your".split(
        " ",
    ),
);

/** Words people type → the words the tool names and keywords use. */
const synonyms: Record<string, string[]> = {
    pretty: ["format", "beautify", "prettier"],
    prettify: ["format", "beautify", "prettier"],
    beautify: ["format"],
    indent: ["format"],
    lint: ["validate", "format"],
    check: ["validate", "test"],
    verify: ["validate"],
    diff: ["compare"],
    difference: ["compare"],
    id: ["uuid"],
    guid: ["uuid"],
    pw: ["password"],
    pass: ["password"],
    secret: ["password"],
    encrypt: ["aes", "encrypt"],
    decrypt: ["aes", "encrypt"],
    checksum: ["hash"],
    digest: ["hash"],
    epoch: ["timestamp"],
    unix: ["timestamp"],
    date: ["timestamp", "date"],
    clock: ["time", "timezone"],
    tz: ["timezone"],
    regexp: ["regex"],
    pattern: ["regex"],
    colour: ["color"],
    palette: ["color"],
    yml: ["yaml"],
    md: ["markdown"],
    js: ["javascript"],
    ts: ["typescript"],
    golang: ["go"],
    zip: ["compression", "gzip"],
    compress: ["compression"],
    gzip: ["compression"],
    timer: ["timer", "reminder"],
    alarm: ["reminder"],
    todo: ["todo"],
    task: ["todo"],
    tokens: ["token"],
    ip: ["cidr", "ip"],
    subnet: ["cidr"],
    cert: ["certificate"],
    ssl: ["certificate"],
    tls: ["certificate"],
    jwt: ["jwt", "token"],
    ua: ["user-agent", "agent"],
    cron: ["cron"],
    schedule: ["cron"],
};

/** Very light stemming so "hashes", "formatting", "encoded" meet "hash", "format", "encode". */
function stem(word: string) {
    if (word.length <= 3 || /[\d+#]/.test(word)) return word;
    let w = word.replace(/ies$/, "y");
    if (/[^s]s$/.test(w) && !/(?:ss|us|is)$/.test(w)) w = w.replace(/e?s$/, (m) => (/(?:sh|ch|x|z)es$/.test(w) ? "" : m === "es" ? "e" : ""));
    w = w.replace(/(?:ing|ed)$/, "");
    if (w.length > 5) w = w.replace(/(?:er|or)$/, ""); // formatter → format, generator → generat(e)
    if (w.length > 4) w = w.replace(/e$/, "").replace(/(.)\1$/, "$1");
    return w.length >= 3 ? w : word;
}

function tokenize(value: string) {
    const raw = value.toLowerCase().match(/[a-z0-9][a-z0-9+#.]*/g) ?? [];
    return raw.flatMap((t) => (t.includes(".") ? [t, ...t.split(".").filter(Boolean)] : [t])).filter((t) => !stopwords.has(t));
}

/** Edit distance ≤ 1 (one typo: insert, delete, substitute or swap). */
function oneTypo(a: string, b: string) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    if (a.length === b.length)
        return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
    return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

interface Indexed {
    tool: ToolDef;
    name: string[];
    keywords: string[];
    description: string[];
    category: string[];
    phrase: string;
}

/** The synonym table keyed and valued by stemmed tokens, built on first use. */
let stemmedSynonyms: Map<string, string[]> | undefined;
function synonymsOf(term: string) {
    stemmedSynonyms ??= new Map(
        Object.entries(synonyms).map(([k, alts]) => [stem(k), [...new Set(alts.flatMap((a) => tokenize(a.replace(/-/g, " ")).map(stem)))]]),
    );
    return stemmedSynonyms.get(term) ?? [];
}

let index: Indexed[] | undefined;
/** How many tools mention each token in their name or keywords. */
const frequency = new Map<string, number>();
function getIndex() {
    index ??= tools.map((tool) => {
        const prep = (v: string) => tokenize(v).map(stem);
        return {
            tool,
            name: prep(tool.name.replace(/-/g, " ")),
            keywords: (tool.keywords ?? []).flatMap((k) => prep(k.replace(/-/g, " "))),
            description: prep(tool.description),
            category: prep(tool.category),
            phrase: [tool.name, ...(tool.keywords ?? [])].join(" | ").toLowerCase(),
        };
    });
    for (const t of index) for (const token of new Set([...t.name, ...t.keywords])) frequency.set(token, (frequency.get(token) ?? 0) + 1);
    return index;
}

function termScore(term: string, t: Indexed, weight = 1) {
    let score = 0;
    if (t.name.includes(term)) score += 12;
    else if (t.name.some((v) => v.startsWith(term) && term.length >= 2)) score += 6;
    else if (term.length >= 4 && t.name.some((v) => v.length >= 4 && oneTypo(v, term))) score += 7;
    if (t.keywords.includes(term)) score += 9;
    else if (t.keywords.some((v) => v.startsWith(term) && term.length >= 2)) score += 4;
    else if (term.length >= 4 && t.keywords.some((v) => v.length >= 4 && oneTypo(v, term))) score += 5;
    if (t.description.includes(term)) score += 4;
    if (t.category.includes(term)) score += 2;
    return score * weight;
}

/** Common words ("generator", "converter") count for less than distinctive ones ("cidr", "jwt"). */
const rarity = (term: string) => Math.max(0.4, 1 / (1 + (frequency.get(term) ?? 0) / 8));

/**
 * Tools that best fit a free-text request, best first. Matches names, keywords, descriptions and
 * categories, with light stemming, synonyms and one-typo tolerance; tools you use get a small nudge;
 * weak matches far below the best one are dropped so the chat doesn't suggest noise.
 */
export function rankTools(query: string, limit = 5): ToolDef[] {
    const terms = [...new Set(tokenize(query).map(stem))];
    if (!terms.length) return [];
    const q = query.trim().toLowerCase();
    const used = new Set(recents.value.map((t) => t.id));
    const starred = new Set(favorites.value.map((t) => t.id));

    const indexed = getIndex();
    const scored = indexed
        .map((t) => {
            let score = 0;
            let hits = 0;
            for (const term of terms) {
                let s = termScore(term, t);
                // A synonym counts for less than the word itself, and only when the word misses.
                if (!s) for (const alt of synonymsOf(term)) s = Math.max(s, termScore(alt, t, 0.7));
                if (s) hits++;
                score += s * rarity(term);
            }
            if (!score) return { tool: t.tool, score: 0 };
            // Reward covering more of the request, and the request naming the tool outright.
            score *= 0.6 + 0.4 * (hits / terms.length);
            if (q.length >= 3 && t.phrase.includes(q)) score += 15;
            if (starred.has(t.tool.id)) score += 2;
            if (used.has(t.tool.id)) score += 1;
            return { tool: t.tool, score };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));

    const top = scored[0]?.score ?? 0;
    return scored
        .filter(({ score }) => score >= top * 0.5)
        .slice(0, limit)
        .map(({ tool }) => tool);
}
