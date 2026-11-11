<script setup lang="ts">
import { computed, ref } from "vue";
import semver from "semver";
import { Check, X } from "lucide-vue-next";
import { CodeArea, CopyButton, Notice, Panel, ToolPage } from "@/components/ui";

// 1. Range checker
const range = ref("^1.2.0 || >=3.0.0 <3.5.0");
const versionsText = ref("1.0.0\n1.2.3\n1.9.0\n2.0.0\n3.1.0\n3.5.0\n3.4.9-beta.1\nnot-a-version");

const rangeInfo = computed(() => {
    const r = range.value.trim();
    if (!r) return { valid: true, norm: "", rows: [], max: null as string | null, min: null as string | null };
    const norm = semver.validRange(r);
    const versions = versionsText.value.split("\n").map((v) => v.trim()).filter(Boolean);
    if (norm === null) return { valid: false, norm: "", rows: [], max: null, min: null };
    const rows = versions.map((v) => {
        const clean = semver.valid(v);
        return { v, valid: clean !== null, ok: clean !== null && semver.satisfies(clean, r) };
    });
    const valids = rows.filter((x) => x.valid).map((x) => x.v);
    return { valid: true, norm, rows, max: semver.maxSatisfying(valids, r), min: semver.minSatisfying(valids, r) };
});

// 2. Compare
const a = ref("1.4.2");
const b = ref("2.0.0-rc.1");
const cmp = computed(() => {
    const va = semver.parse(a.value.trim());
    const vb = semver.parse(b.value.trim());
    if (!va || !vb) return null;
    const c = semver.compare(va, vb);
    return { rel: c > 0 ? "greater than" : c < 0 ? "less than" : "equal to", gt: c > 0, lt: c < 0, eq: c === 0, diff: semver.diff(va, vb) };
});

// 3. Bump
const bumpVersion = ref("1.4.2");
const preid = ref("beta");
const releases = ["major", "minor", "patch", "premajor", "preminor", "prepatch", "prerelease"] as const;
const bumps = computed(() => {
    const v = semver.valid(bumpVersion.value.trim());
    if (!v) return null;
    const id = preid.value.trim();
    return releases.map((r) => ({ r, out: (id ? semver.inc(v, r, id) : semver.inc(v, r)) ?? "" }));
});
</script>

<template>
    <ToolPage>
        <Panel title="Range checker">
            <div class="grid gap-4 lg:grid-cols-2">
                <div class="space-y-3">
                    <div>
                        <label class="label" for="sv-range">Range</label>
                        <input id="sv-range" v-model="range" class="input font-mono" placeholder="^1.2.0 || >=3.0.0" spellcheck="false" />
                    </div>
                    <div class="overflow-hidden rounded-lg border border-line">
                        <CodeArea v-model="versionsText" height="9rem" placeholder="One version per line" />
                    </div>
                </div>
                <div class="space-y-3">
                    <Notice v-if="!rangeInfo.valid" type="error">Invalid range.</Notice>
                    <template v-else>
                        <dl class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
                            <dt class="text-muted">Simplified</dt>
                            <dd class="flex items-center gap-1"><code class="code break-all">{{ rangeInfo.norm || "*" }}</code><CopyButton :text="rangeInfo.norm" icon-only /></dd>
                            <dt class="text-muted">Highest match</dt>
                            <dd><code class="code">{{ rangeInfo.max ?? "none" }}</code></dd>
                            <dt class="text-muted">Lowest match</dt>
                            <dd><code class="code">{{ rangeInfo.min ?? "none" }}</code></dd>
                        </dl>
                        <ul v-if="rangeInfo.rows.length" class="max-h-56 divide-y divide-line overflow-auto rounded-lg border border-line">
                            <li v-for="(r, i) in rangeInfo.rows" :key="i" class="flex items-center gap-2 px-3 py-1.5 text-sm">
                                <Check v-if="r.ok" class="size-4 text-success" />
                                <X v-else class="size-4" :class="r.valid ? 'text-danger' : 'text-warning'" />
                                <code class="font-mono">{{ r.v }}</code>
                                <span class="ml-auto text-xs text-muted">{{ !r.valid ? "invalid version" : r.ok ? "satisfies" : "does not satisfy" }}</span>
                            </li>
                        </ul>
                    </template>
                </div>
            </div>
        </Panel>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Compare versions">
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="label" for="sv-a">Version A</label><input id="sv-a" v-model="a" class="input font-mono" spellcheck="false" /></div>
                    <div><label class="label" for="sv-b">Version B</label><input id="sv-b" v-model="b" class="input font-mono" spellcheck="false" /></div>
                </div>
                <Notice v-if="!cmp" type="error" class="mt-3">Enter two valid versions.</Notice>
                <div v-else class="mt-3 space-y-2 text-sm">
                    <p><code class="code">{{ a }}</code> is <strong>{{ cmp.rel }}</strong> <code class="code">{{ b }}</code></p>
                    <div class="flex flex-wrap gap-1.5">
                        <span class="chip" :class="cmp.gt ? 'border-success text-success' : ''">gt {{ cmp.gt }}</span>
                        <span class="chip" :class="cmp.lt ? 'border-success text-success' : ''">lt {{ cmp.lt }}</span>
                        <span class="chip" :class="cmp.eq ? 'border-success text-success' : ''">eq {{ cmp.eq }}</span>
                        <span class="chip">diff: {{ cmp.diff ?? "none" }}</span>
                    </div>
                </div>
            </Panel>

            <Panel title="Bump a version">
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="label" for="sv-bv">Version</label><input id="sv-bv" v-model="bumpVersion" class="input font-mono" spellcheck="false" /></div>
                    <div><label class="label" for="sv-id">Prerelease id</label><input id="sv-id" v-model="preid" class="input font-mono" placeholder="beta" spellcheck="false" /></div>
                </div>
                <Notice v-if="!bumps" type="error" class="mt-3">Enter a valid version.</Notice>
                <ul v-else class="mt-3 divide-y divide-line rounded-lg border border-line">
                    <li v-for="x in bumps" :key="x.r" class="flex items-center gap-2 px-3 py-1.5 text-sm">
                        <span class="w-24 text-muted">{{ x.r }}</span>
                        <code class="font-mono">{{ x.out }}</code>
                        <CopyButton class="ml-auto" :text="x.out" icon-only />
                    </li>
                </ul>
            </Panel>
        </div>
    </ToolPage>
</template>
