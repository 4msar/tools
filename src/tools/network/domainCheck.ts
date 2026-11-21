/**
 * Domain availability checks that run entirely in the browser.
 *
 * 1. DNS over HTTPS (NS query): a NOERROR answer means the name is delegated, so it is registered.
 * 2. RDAP at the TLD registry (found through the IANA bootstrap file): 200 means registered, 404 means
 *    the registry has no record, which is the best "available" signal a browser can get.
 * 3. TLDs without RDAP fall back to DNS alone, which can only say "likely available".
 */

export type Status = "queued" | "checking" | "available" | "likely" | "taken" | "invalid" | "error";

export interface CheckResult {
    status: Status;
    source?: "RDAP" | "DNS";
    registrar?: string;
    created?: string;
    expires?: string;
    note?: string;
}

const DOH = "https://cloudflare-dns.com/dns-query";
const BOOTSTRAP = "https://data.iana.org/rdap/dns.json";

let bootstrap: Promise<Map<string, string>> | null = null;
function rdapServers(): Promise<Map<string, string>> {
    bootstrap ??= fetch(BOOTSTRAP)
        .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        })
        .then((j: { services: [string[], string[]][] }) => {
            const map = new Map<string, string>();
            for (const [tlds, urls] of j.services) {
                const url = urls.find((u) => u.startsWith("https://")) ?? urls[0];
                if (!url) continue;
                for (const t of tlds) map.set(t.toLowerCase(), url.endsWith("/") ? url : url + "/");
            }
            return map;
        })
        .catch((e) => {
            bootstrap = null; // try again next time
            throw e;
        });
    return bootstrap;
}

/** DoH status code (0 NOERROR, 3 NXDOMAIN, ...) or null when the resolver could not be reached. */
async function dnsStatus(name: string, type: string, signal: AbortSignal): Promise<number | null> {
    try {
        const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: "application/dns-json" }, signal });
        if (!res.ok) return null;
        const j = (await res.json()) as { Status: number };
        return j.Status;
    } catch (e) {
        if ((e as Error).name === "AbortError") throw e;
        return null;
    }
}

const tldExists = new Map<string, Promise<boolean>>();
function checkTld(tld: string, signal: AbortSignal): Promise<boolean> {
    let p = tldExists.get(tld);
    if (!p) {
        p = dnsStatus(tld, "SOA", signal).then((s) => s !== 3);
        tldExists.set(tld, p);
        p.catch(() => tldExists.delete(tld));
    }
    return p;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function rdapDetails(d: Json): Pick<CheckResult, "registrar" | "created" | "expires"> {
    const ev = (a: string) => (d?.events as Json[] | undefined)?.find((e) => e.eventAction === a)?.eventDate as string | undefined;
    const reg = (d?.entities as Json[] | undefined)?.find((e) => e.roles?.includes("registrar"));
    const fn = (reg?.vcardArray?.[1] as Json[] | undefined)?.find((r) => r[0] === "fn")?.[3];
    return { registrar: typeof fn === "string" ? fn : undefined, created: ev("registration"), expires: ev("expiration") };
}

export async function checkDomain(domain: string, signal: AbortSignal): Promise<CheckResult> {
    const tld = domain.slice(domain.lastIndexOf(".") + 1);
    const [servers, dns] = await Promise.all([rdapServers().catch(() => null), dnsStatus(domain, "NS", signal)]);
    const server = servers?.get(tld);

    if (!server && !(await checkTld(tld, signal))) return { status: "invalid", note: `.${tld} is not a top-level domain` };

    // Delegated in DNS: registered. Ask RDAP only when we have a server, for the registrar and dates.
    if (dns === 0 && !server) return { status: "taken", source: "DNS" };

    if (server) {
        try {
            const res = await fetch(`${server}domain/${domain}`, { headers: { accept: "application/rdap+json, application/json" }, signal });
            if (res.ok) return { status: "taken", source: "RDAP", ...rdapDetails(await res.json().catch(() => null)) };
            if (res.status === 404) {
                // Some registries answer 404 for names they hold back; DNS delegation still wins.
                if (dns === 0) return { status: "taken", source: "DNS" };
                return { status: "available", source: "RDAP" };
            }
            if (res.status === 429) return dnsFallback(dns, "Registry rate limit hit; retry in a minute for a definite answer.");
            return dnsFallback(dns, `Registry answered HTTP ${res.status}.`);
        } catch (e) {
            if ((e as Error).name === "AbortError") throw e;
            return dnsFallback(dns, "Registry RDAP is not reachable from the browser.");
        }
    }
    return dnsFallback(dns, `.${tld} has no public RDAP server, so only DNS was checked.`);
}

function dnsFallback(dns: number | null, note: string): CheckResult {
    if (dns === 0) return { status: "taken", source: "DNS" };
    if (dns === 3) return { status: "likely", source: "DNS", note };
    return { status: "error", note: dns === null ? "DNS and RDAP lookups failed." : note };
}

/** Lowercase, punycode-encode and validate a single label (no dots). Returns "" when unusable. */
export function toLabel(raw: string): string {
    const cleaned = raw
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-")
        .replace(/[^\p{L}\p{N}-]/gu, "")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "");
    if (!cleaned) return "";
    let ascii = cleaned;
    if (/[^a-z0-9-]/.test(cleaned)) {
        try {
            ascii = new URL(`http://${cleaned}.x`).hostname.slice(0, -2);
        } catch {
            return "";
        }
    }
    return ascii.length <= 63 ? ascii : "";
}

export interface Candidate {
    domain: string;
    group: "exact" | "variation";
}

export interface GenerateOptions {
    tlds: string[];
    prefixes: string[];
    suffixes: string[];
    hyphenate: boolean;
    variationTld: string;
}

/**
 * Turn the user's input into domains to check. Each line or comma-separated entry is one name; spaces join
 * words ("cloud kitchen" → cloudkitchen, plus cloud-kitchen when hyphenate is on). An entry that already has a
 * TLD ("acme.io") is checked as-is and its name is also tried on the chosen TLDs.
 */
export function generate(input: string, o: GenerateOptions): Candidate[] {
    const out: Candidate[] = [];
    const seen = new Set<string>();
    const add = (domain: string, group: Candidate["group"]) => {
        if (domain.length > 253 || seen.has(domain)) return;
        seen.add(domain);
        out.push({ domain, group });
    };

    for (const entry of input.split(/[\n,;]+/)) {
        let text = entry.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0];
        if (!text) continue;
        let exactTld = "";
        const dot = text.lastIndexOf(".");
        if (dot > 0 && !/\s/.test(text)) {
            exactTld = toLabel(text.slice(dot + 1));
            text = text.slice(0, dot).split(".").pop() ?? "";
        }
        const words = text.split(/[\s_-]+/).map(toLabel).filter(Boolean);
        if (!words.length) continue;
        const joined = toLabel(words.join(""));
        const bases = [joined];
        if (o.hyphenate && words.length > 1) bases.push(toLabel(words.join("-")));

        if (exactTld && joined) add(`${joined}.${exactTld}`, "exact");
        for (const base of bases.filter(Boolean)) for (const t of o.tlds) add(`${base}.${t}`, "exact");

        if (!o.variationTld) continue;
        for (const p of o.prefixes) add(`${toLabel(p + joined)}.${o.variationTld}`, "variation");
        for (const s of o.suffixes) add(`${toLabel(joined + s)}.${o.variationTld}`, "variation");
    }
    return out.filter((c) => !c.domain.startsWith("."));
}

export const REGISTRARS = {
    namecheap: { name: "Namecheap", url: (d: string) => `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(d)}` },
    porkbun: { name: "Porkbun", url: (d: string) => `https://porkbun.com/checkout/search?q=${encodeURIComponent(d)}` },
    cloudflare: { name: "Cloudflare", url: (d: string) => `https://domains.cloudflare.com/?domain=${encodeURIComponent(d)}` },
    godaddy: { name: "GoDaddy", url: (d: string) => `https://www.godaddy.com/domainsearch/find?domainToCheck=${encodeURIComponent(d)}` },
} as const;
export type RegistrarId = keyof typeof REGISTRARS;
