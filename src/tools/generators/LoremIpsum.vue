<script setup lang="ts">
import { computed, ref } from "vue";
import { RefreshCw } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Field, Panel, Tabs, ToolPage } from "@/components/ui";

type Tab = "lorem" | "fake";
const tab = ref<Tab>("lorem");
const nonce = ref(0);
const regen = () => nonce.value++;

const WORDS = ("lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum integer nec odio praesent libero sollicitudin tristique vestibulum ante primis faucibus orci luctus ultrices posuere cubilia curae donec pharetra magna ac placerat vestibulum lectus mauris ultrices eros vitae nunc mattis ligula consequat suscipit risus pellentesque habitant morbi senectus netus malesuada fames turpis egestas aenean quam facilisis eleifend nibh tincidunt blandit maecenas faucibus hendrerit imperdiet").split(" ");
const START = "Lorem ipsum dolor sit amet, consectetur adipiscing elit";

const unit = ref<"paragraphs" | "sentences" | "words">("paragraphs");
const count = ref(3);
const startLorem = ref(true);
const asHtml = ref(false);

const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]) => a[rnd(a.length)];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function words(n: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
        let w = pick(WORDS);
        if (i > 0 && w === out[i - 1]) w = pick(WORDS);
        out.push(w);
    }
    return out;
}
function sentence(): string {
    const n = 6 + rnd(12);
    const w = words(n);
    if (n > 9) w[3 + rnd(n - 6)] += ",";
    return cap(w.join(" ")).replace(/,$/, "") + ".";
}
function paragraph(): string {
    return Array.from({ length: 3 + rnd(4) }, sentence).join(" ");
}

const n = computed(() => Math.min(200, Math.max(1, Math.floor(Number(count.value)) || 1)));
const lorem = computed(() => {
    void nonce.value;
    const k = n.value;
    if (unit.value === "words") {
        let w = words(k);
        if (startLorem.value) w = [...START.toLowerCase().replace(",", "").split(" "), ...w].slice(0, k);
        return w.join(" ");
    }
    if (unit.value === "sentences") {
        const s = Array.from({ length: k }, sentence);
        if (startLorem.value) s[0] = START + ".";
        return s.join(" ");
    }
    const p = Array.from({ length: k }, paragraph);
    if (startLorem.value) p[0] = START + ". " + p[0].split(". ").slice(1).join(". ");
    const html = asHtml.value;
    return html ? p.map((x) => `<p>${x}</p>`).join("\n") : p.join("\n\n");
});
const loremOut = computed(() => {
    if (!asHtml.value || unit.value === "paragraphs") return lorem.value;
    if (unit.value === "sentences") return `<p>${lorem.value}</p>`;
    return `<p>${lorem.value}</p>`;
});

// Fake data
const FIRST = ["Ava", "Liam", "Noah", "Emma", "Olivia", "Elijah", "Sophia", "Lucas", "Mia", "Mason", "Amara", "Kenji", "Priya", "Mateo", "Zara", "Omar", "Ines", "Hugo", "Yuki", "Leila", "Tomas", "Nadia", "Felix", "Chloe", "Rahul", "Elena", "Jonas", "Maya", "Idris", "Greta"];
const LAST = ["Smith", "Johnson", "Garcia", "Chen", "Patel", "Nguyen", "Kim", "Silva", "Müller", "Rossi", "Haddad", "Ivanov", "Okafor", "Tanaka", "Novak", "Larsen", "Dubois", "Santos", "Khan", "Murphy", "Costa", "Weber", "Singh", "Lopez", "Brown"];
const DOMAINS = ["example.com", "example.org", "example.net", "mail.test", "demo.dev"];
const TLDS = ["com", "org", "io", "dev", "net", "app"];
const TITLES_A = ["Getting Started with", "A Practical Guide to", "Ten Lessons from", "Rethinking", "Why We Moved Away from", "The Hidden Cost of", "Understanding", "Scaling", "Debugging", "The Future of"];
const TITLES_B = ["Modern Web Apps", "Distributed Systems", "Clean Architecture", "Remote Teams", "Data Pipelines", "Design Systems", "Cloud Costs", "Open Source", "Developer Tooling", "Small Teams", "Technical Debt", "Edge Computing"];

type Kind = "names" | "emails" | "urls" | "titles";
const kind = ref<Kind>("names");
const fakeCount = ref(10);
const asJson = ref(false);
const fc = computed(() => Math.min(500, Math.max(1, Math.floor(Number(fakeCount.value)) || 1)));

function fakeOne(k: Kind): string {
    const f = pick(FIRST), l = pick(LAST);
    const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    switch (k) {
        case "names": return `${f} ${l}`;
        case "emails": return `${slug(f)}.${slug(l)}${rnd(3) ? "" : rnd(99)}@${pick(DOMAINS)}`;
        case "urls": return `https://${pick(["www.", "app.", "blog.", ""])}${slug(pick(LAST))}${slug(pick(FIRST)).slice(0, 3)}.${pick(TLDS)}/${slug(pick(TITLES_B)).replace(/ /g, "-")}`;
        default: return `${pick(TITLES_A)} ${pick(TITLES_B)}`;
    }
}
const fake = computed(() => {
    void nonce.value;
    const arr = Array.from({ length: fc.value }, () => fakeOne(kind.value));
    return asJson.value ? JSON.stringify(arr, null, 2) : arr.join("\n");
});
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="tab" :options="[{ value: 'lorem', label: 'Lorem ipsum' }, { value: 'fake', label: 'Fake data' }]" />
        </template>

        <template v-if="tab === 'lorem'">
            <div class="flex flex-wrap items-end gap-x-5 gap-y-3 text-sm">
                <Field label="Unit">
                    <Tabs v-model="unit" :options="[{ value: 'paragraphs', label: 'Paragraphs' }, { value: 'sentences', label: 'Sentences' }, { value: 'words', label: 'Words' }]" />
                </Field>
                <Field label="Count (1–200)"><input v-model.number="count" type="number" min="1" max="200" class="input w-24" /></Field>
                <label class="flex items-center gap-2 pb-2"><input v-model="startLorem" type="checkbox" class="checkbox" /> Start with “Lorem ipsum”</label>
                <label class="flex items-center gap-2 pb-2"><input v-model="asHtml" type="checkbox" class="checkbox" /> HTML &lt;p&gt; tags</label>
            </div>
            <Panel title="Output" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="regen"><RefreshCw /> Regenerate</Btn>
                    <CopyButton :text="loremOut" />
                </template>
                <CodeArea :model-value="loremOut" readonly height="18rem" />
            </Panel>
        </template>

        <template v-else>
            <div class="flex flex-wrap items-end gap-x-5 gap-y-3 text-sm">
                <Field label="Type">
                    <Tabs v-model="kind" :options="[{ value: 'names', label: 'Names' }, { value: 'emails', label: 'Emails' }, { value: 'urls', label: 'URLs' }, { value: 'titles', label: 'Titles' }]" />
                </Field>
                <Field label="Count (1–500)"><input v-model.number="fakeCount" type="number" min="1" max="500" class="input w-24" /></Field>
                <label class="flex items-center gap-2 pb-2"><input v-model="asJson" type="checkbox" class="checkbox" /> JSON array</label>
            </div>
            <Panel title="Output" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="regen"><RefreshCw /> Regenerate</Btn>
                    <CopyButton :text="fake" />
                </template>
                <CodeArea :model-value="fake" readonly :wrap="false" height="18rem" />
            </Panel>
        </template>
    </ToolPage>
</template>
