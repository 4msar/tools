<script setup lang="ts">
import { computed, ref } from "vue";
import { Sparkles, Trash2 } from "lucide-vue-next";
import { dump } from "js-yaml";
import { Btn, CodeArea, CopyButton, Notice, Panel, ToolPage } from "@/components/ui";

const SAMPLE = `docker run -d --name web \\
  --restart unless-stopped \\
  -p 8080:80 -p 443:443 \\
  -v ./html:/usr/share/nginx/html:ro \\
  -v nginx-cache:/var/cache/nginx \\
  -e NGINX_HOST=example.com -e TZ=UTC \\
  --network frontend \\
  --memory 512m --cpus 1.5 \\
  --health-cmd "curl -f http://localhost || exit 1" --health-interval 30s \\
  nginx:1.27-alpine`;

const input = ref(SAMPLE);

// Shell-like tokenizer: handles quotes, backslash escapes and line continuations.
function tokenize(s: string): string[] {
    const out: string[] = [];
    let cur = "";
    let has = false;
    let q: string | null = null;
    const src = s.replace(/\\\r?\n/g, " ").replace(/\s`\r?\n/g, " ").replace(/\s\^\r?\n/g, " ");
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (q) {
            if (c === q) q = null;
            else if (c === "\\" && q === '"' && i + 1 < src.length && '"\\$`'.includes(src[i + 1])) cur += src[++i];
            else cur += c;
        } else if (c === '"' || c === "'") {
            q = c;
            has = true;
        } else if (c === "\\" && i + 1 < src.length) {
            cur += src[++i];
            has = true;
        } else if (/\s/.test(c)) {
            if (has || cur) out.push(cur);
            cur = "";
            has = false;
        } else cur += c;
    }
    if (q) throw new Error("Unterminated quote in the command.");
    if (has || cur) out.push(cur);
    return out;
}

type Svc = Record<string, unknown>;
const BOOL: Record<string, (s: Svc) => void> = {
    "-d": () => {}, "--detach": () => {}, "--rm": () => {},
    "-i": (s) => (s.stdin_open = true), "--interactive": (s) => (s.stdin_open = true),
    "-t": (s) => (s.tty = true), "--tty": (s) => (s.tty = true),
    "--privileged": (s) => (s.privileged = true), "--read-only": (s) => (s.read_only = true),
    "--init": (s) => (s.init = true), "-P": () => {}, "--publish-all": () => {}, "--no-healthcheck": (s) => (s.healthcheck = { disable: true }),
};
const push = (s: Svc, key: string, v: unknown) => ((s[key] ??= []) as unknown[]).push(v);
const VALUE: Record<string, (s: Svc, v: string, extra: Extra) => void> = {
    "--name": (s, v) => (s.container_name = v),
    "-p": (s, v) => push(s, "ports", v), "--publish": (s, v) => push(s, "ports", v),
    "--expose": (s, v) => push(s, "expose", v),
    "-v": (s, v, x) => { push(s, "volumes", v); noteVolume(v, x); }, "--volume": (s, v, x) => { push(s, "volumes", v); noteVolume(v, x); },
    "--mount": (s, v, x) => {
        const o = Object.fromEntries(v.split(",").map((p) => { const i = p.indexOf("="); return i < 0 ? [p, "true"] : [p.slice(0, i), p.slice(i + 1)]; }));
        const m: Record<string, unknown> = { type: o.type ?? "volume", source: o.source ?? o.src, target: o.target ?? o.dst ?? o.destination };
        if (o.readonly || o.ro) m.read_only = true;
        if (!m.source) delete m.source;
        push(s, "volumes", m);
        if (m.type === "volume" && typeof m.source === "string") x.volumes.add(m.source);
    },
    "-e": (s, v) => push(s, "environment", v), "--env": (s, v) => push(s, "environment", v),
    "--env-file": (s, v) => push(s, "env_file", v),
    "--network": (s, v, x) => {
        if (["host", "none", "bridge"].includes(v) || v.startsWith("container:")) s.network_mode = v;
        else { push(s, "networks", v); x.networks.add(v); }
    },
    "--net": (s, v, x) => VALUE["--network"](s, v, x),
    "--network-alias": (_s, v, x) => x.notes.push(`--network-alias ${v}: add it under the network's "aliases" by hand.`),
    "--restart": (s, v) => (s.restart = v),
    "-w": (s, v) => (s.working_dir = v), "--workdir": (s, v) => (s.working_dir = v),
    "-u": (s, v) => (s.user = v), "--user": (s, v) => (s.user = v),
    "-h": (s, v) => (s.hostname = v), "--hostname": (s, v) => (s.hostname = v),
    "--entrypoint": (s, v) => (s.entrypoint = v),
    "-l": (s, v) => push(s, "labels", v), "--label": (s, v) => push(s, "labels", v),
    "--add-host": (s, v) => push(s, "extra_hosts", v),
    "--dns": (s, v) => push(s, "dns", v),
    "--cap-add": (s, v) => push(s, "cap_add", v), "--cap-drop": (s, v) => push(s, "cap_drop", v),
    "--device": (s, v) => push(s, "devices", v),
    "--security-opt": (s, v) => push(s, "security_opt", v),
    "--tmpfs": (s, v) => push(s, "tmpfs", v),
    "--link": (s, v) => push(s, "links", v),
    "--ulimit": (s, v) => {
        const [name, lim] = v.split("=");
        const [soft, hard] = (lim ?? "").split(":");
        ((s.ulimits ??= {}) as Record<string, unknown>)[name] = hard ? { soft: Number(soft), hard: Number(hard) } : Number(soft);
    },
    "--sysctl": (s, v) => push(s, "sysctls", v),
    "--log-driver": (s, v) => (((s.logging ??= {}) as Record<string, unknown>).driver = v),
    "--log-opt": (s, v) => {
        const i = v.indexOf("=");
        const lg = (s.logging ??= {}) as { options?: Record<string, string> };
        (lg.options ??= {})[v.slice(0, i)] = v.slice(i + 1);
    },
    "-m": (s, v) => (s.mem_limit = v), "--memory": (s, v) => (s.mem_limit = v),
    "--memory-reservation": (s, v) => (s.mem_reservation = v),
    "--cpus": (s, v) => (s.cpus = Number(v)),
    "--shm-size": (s, v) => (s.shm_size = v),
    "--pid": (s, v) => (s.pid = v), "--ipc": (s, v) => (s.ipc = v),
    "--platform": (s, v) => (s.platform = v),
    "--stop-signal": (s, v) => (s.stop_signal = v), "--stop-timeout": (s, v) => (s.stop_grace_period = `${v}s`),
    "--pull": (s, v) => (s.pull_policy = v),
    "--gpus": (s, v) => (s.deploy = { resources: { reservations: { devices: [{ driver: "nvidia", count: v === "all" ? "all" : Number(v) || v, capabilities: ["gpu"] }] } } }),
    "--health-cmd": (s, v) => (hc(s).test = ["CMD-SHELL", v]),
    "--health-interval": (s, v) => (hc(s).interval = v), "--health-timeout": (s, v) => (hc(s).timeout = v),
    "--health-retries": (s, v) => (hc(s).retries = Number(v)), "--health-start-period": (s, v) => (hc(s).start_period = v),
    "--ip": (_s, v, x) => x.notes.push(`--ip ${v}: set ipv4_address under the service's network by hand.`),
};
const hc = (s: Svc) => (s.healthcheck ??= {}) as Record<string, unknown>;

interface Extra { volumes: Set<string>; networks: Set<string>; notes: string[] }
function noteVolume(v: string, x: Extra) {
    const src = v.split(":")[0];
    if (v.includes(":") && /^[\w][\w.-]*$/.test(src)) x.volumes.add(src);
}

function convert(text: string) {
    const services: Record<string, Svc> = {};
    const x: Extra = { volumes: new Set(), networks: new Set(), notes: [] };
    // one command per "docker run" occurrence
    const commands = text.split(/(?=^\s*(?:sudo\s+)?(?:docker|podman)\s+(?:container\s+)?(?:run|create)\b)/m).map((c) => c.trim()).filter(Boolean);
    for (const cmd of commands) {
        const t = tokenize(cmd);
        let i = 0;
        if (t[i] === "sudo") i++;
        if (!/^(docker|podman)$/.test(t[i] ?? "")) throw new Error('Each command must start with "docker run".');
        i++;
        if (t[i] === "container") i++;
        if (!/^(run|create)$/.test(t[i] ?? "")) throw new Error('Only "docker run" (or "docker create") commands can be converted.');
        i++;
        const s: Svc = {};
        let image = "";
        for (; i < t.length; i++) {
            let tok = t[i];
            if (!tok.startsWith("-")) { image = tok; i++; break; }
            let val: string | undefined;
            const eq = tok.indexOf("=");
            if (tok.startsWith("--") && eq > 0) { val = tok.slice(eq + 1); tok = tok.slice(0, eq); }
            if (BOOL[tok]) { if (val !== "false") BOOL[tok](s); continue; }
            if (VALUE[tok]) { VALUE[tok](s, val ?? t[++i] ?? "", x); continue; }
            // combined short flags: -it, -dit, -p8080:80
            if (/^-[a-zA-Z]{2,}/.test(tok) && !tok.startsWith("--")) {
                const letters = tok.slice(1);
                let done = false;
                for (let j = 0; j < letters.length && !done; j++) {
                    const f = "-" + letters[j];
                    if (BOOL[f]) BOOL[f](s);
                    else if (VALUE[f]) { VALUE[f](s, letters.slice(j + 1) || t[++i] || "", x); done = true; }
                    else { x.notes.push(`Unknown flag ${f} was skipped.`); }
                }
                continue;
            }
            x.notes.push(`${tok} has no direct Compose equivalent here and was skipped.`);
            if (val === undefined && t[i + 1] && !t[i + 1].startsWith("-") && i + 2 < t.length) i++;
        }
        if (!image) throw new Error("No image name found in the command.");
        s.image = image;
        const rest = t.slice(i);
        if (rest.length) s.command = rest.length === 1 ? rest[0] : rest;
        let name = String(s.container_name ?? image.split("/").pop()!.split(/[:@]/)[0]).replace(/[^a-zA-Z0-9_-]/g, "-");
        const base = name;
        for (let n = 2; services[name]; n++) name = `${base}-${n}`;
        // image first, then the rest in a stable order
        const { image: img, container_name, ...other } = s;
        services[name] = { image: img, ...(container_name ? { container_name } : {}), ...other };
    }
    const doc: Record<string, unknown> = { services };
    if (x.volumes.size) doc.volumes = Object.fromEntries([...x.volumes].map((v) => [v, {}]));
    if (x.networks.size) doc.networks = Object.fromEntries([...x.networks].map((n) => [n, { external: true }]));
    return { yaml: dump(doc, { lineWidth: -1, noRefs: true }), notes: x.notes, external: x.networks.size > 0 };
}

const result = computed<{ yaml: string; notes: string[]; external?: boolean; error?: string }>(() => {
    if (!input.value.trim()) return { yaml: "", notes: [] };
    try {
        return convert(input.value);
    } catch (e) {
        return { yaml: "", notes: [], error: (e as Error).message };
    }
});
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="docker run" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="input = SAMPLE"><Sparkles /> Sample</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!input" @click="input = ''"><Trash2 /> Clear</Btn>
                </template>
                <CodeArea v-model="input" height="26rem" :invalid="!!result.error" placeholder="docker run -d -p 8080:80 nginx" />
            </Panel>
            <Panel title="compose.yaml" flush>
                <template #actions><CopyButton :text="result.yaml" /></template>
                <div v-if="result.error" class="p-4"><Notice type="error">{{ result.error }}</Notice></div>
                <CodeArea v-else :model-value="result.yaml" readonly :wrap="false" height="26rem" placeholder="Compose file appears here" />
            </Panel>
        </div>
        <Notice v-if="result.notes.length" type="warning">
            <ul class="list-inside list-disc space-y-0.5"><li v-for="n in result.notes" :key="n">{{ n }}</li></ul>
        </Notice>
        <p class="text-xs text-muted">
            Paste one or more <code class="code">docker run</code> commands; each becomes a service.
            <template v-if="result.external">Networks are marked <code class="code">external: true</code> because <code class="code">docker run --network</code> expects them to exist already; remove that line to let Compose create them.</template>
        </p>
    </ToolPage>
</template>
