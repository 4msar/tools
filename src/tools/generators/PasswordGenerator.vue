<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Copy, RefreshCw, Trash2 } from "lucide-vue-next";
import { Btn, CopyButton, Field, Notice, Panel, ToolPage } from "@/components/ui";
import { copyText } from "@/composables/useClipboard";

// Character sets
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUMBERS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?";
const SIMILAR_CHARS = "0Ol1I";
const AMBIGUOUS_CHARS = "{}[]()/\\'\"` ~,;.<>";

const passwordLength = ref(16);
const generatedPassword = ref("");
const customCharacters = ref("");
const passwordHistory = ref<string[]>([]);

const options = reactive({
    lowercase: true,
    uppercase: true,
    numbers: true,
    symbols: false,
    excludeSimilar: false,
    excludeAmbiguous: false,
    requireFromEachType: false,
});

const hasValidOptions = computed(
    () => options.lowercase || options.uppercase || options.numbers || options.symbols || customCharacters.value.length > 0,
);

function filterCharacters(charSet: string): string {
    let filtered = charSet;
    if (options.excludeSimilar) filtered = filtered.split("").filter((c) => !SIMILAR_CHARS.includes(c)).join("");
    if (options.excludeAmbiguous) filtered = filtered.split("").filter((c) => !AMBIGUOUS_CHARS.includes(c)).join("");
    return filtered;
}

const availableCharacters = computed(() => {
    let chars = "";
    if (options.lowercase) chars += LOWERCASE;
    if (options.uppercase) chars += UPPERCASE;
    if (options.numbers) chars += NUMBERS;
    if (options.symbols) chars += SYMBOLS;
    if (customCharacters.value) chars += customCharacters.value;
    return filterCharacters(chars);
});

const passwordEntropy = computed(() => {
    if (!generatedPassword.value) return 0;
    const size = new Set(availableCharacters.value).size;
    return size > 1 ? generatedPassword.value.length * Math.log2(size) : 0;
});

const strength = computed(() => {
    const e = passwordEntropy.value;
    if (e < 30) return { pct: 20, text: "Very weak", text_cls: "text-danger", bar: "bg-danger" };
    if (e < 50) return { pct: 40, text: "Weak", text_cls: "text-danger", bar: "bg-danger" };
    if (e < 70) return { pct: 60, text: "Fair", text_cls: "text-warning", bar: "bg-warning" };
    if (e < 90) return { pct: 80, text: "Strong", text_cls: "text-success", bar: "bg-success" };
    return { pct: 100, text: "Very strong", text_cls: "text-success", bar: "bg-success" };
});

function randomInt(max: number): number {
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    do crypto.getRandomValues(buf);
    while (buf[0] >= limit);
    return buf[0] % max;
}

const getRandomChar = (set: string): string => set[randomInt(set.length)];

function shuffleString(str: string): string {
    const a = str.split("");
    for (let i = a.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a.join("");
}

function addToHistory(password: string) {
    if (passwordHistory.value.includes(password)) return;
    passwordHistory.value = [password, ...passwordHistory.value].slice(0, 10);
}

function generatePassword(notify = true) {
    if (!hasValidOptions.value) {
        if (notify) toast.error("Please select at least one character type");
        return;
    }
    const chars = availableCharacters.value;
    if (chars.length === 0) {
        if (notify) toast.error("No valid characters available with current settings");
        return;
    }
    let password = "";
    const len = Number(passwordLength.value);
    if (options.requireFromEachType) {
        const required: string[] = [];
        const sets: [boolean, string][] = [
            [options.lowercase, LOWERCASE],
            [options.uppercase, UPPERCASE],
            [options.numbers, NUMBERS],
            [options.symbols, SYMBOLS],
        ];
        for (const [on, set] of sets) {
            const f = filterCharacters(set);
            if (on && f) required.push(getRandomChar(f));
        }
        password = required.join("");
        for (let i = required.length; i < len; i++) password += getRandomChar(chars);
        password = shuffleString(password);
    } else {
        for (let i = 0; i < len; i++) password += getRandomChar(chars);
    }
    generatedPassword.value = password;
    addToHistory(password);
    if (notify) toast.success("Password generated");
}

function clearHistory() {
    passwordHistory.value = [];
    toast.info("Password history cleared");
}

generatePassword(false);

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
watch(
    [passwordLength, options, customCharacters],
    () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => generatePassword(false), 300);
    },
    { deep: true },
);

const checks: { key: keyof typeof options; label: string }[] = [
    { key: "lowercase", label: "Lowercase letters (a-z)" },
    { key: "uppercase", label: "Uppercase letters (A-Z)" },
    { key: "numbers", label: "Numbers (0-9)" },
    { key: "symbols", label: "Symbols (!@#$%^&*...)" },
];
const advanced: { key: keyof typeof options; label: string }[] = [
    { key: "excludeSimilar", label: "Exclude similar characters (0, O, l, I, 1)" },
    { key: "excludeAmbiguous", label: "Exclude ambiguous characters ({ } [ ] ( ) / \\ ' \" ` ~ , ; . < >)" },
    { key: "requireFromEachType", label: "Require at least one character from each selected type" },
];
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-[1fr_20rem]">
            <div class="space-y-4">
                <Panel title="Generated password">
                    <template #actions>
                        <CopyButton :text="generatedPassword" />
                        <Btn size="sm" variant="ghost" :disabled="!hasValidOptions" @click="generatePassword()"><RefreshCw /> Regenerate</Btn>
                    </template>
                    <input
                        type="text"
                        :value="generatedPassword"
                        readonly
                        class="input py-3 font-mono text-lg"
                        placeholder="Select options to generate a password"
                        @focus="($event.target as HTMLInputElement).select()"
                    />
                    <div v-if="generatedPassword" class="mt-4 space-y-2">
                        <div class="flex items-center justify-between text-sm">
                            <span class="text-muted">Strength</span>
                            <span class="font-medium" :class="strength.text_cls">{{ strength.text }}</span>
                        </div>
                        <div class="h-2 w-full overflow-hidden rounded-full bg-subtle">
                            <div class="h-2 rounded-full transition-all duration-300" :class="strength.bar" :style="{ width: strength.pct + '%' }"></div>
                        </div>
                        <div class="text-xs text-muted">{{ generatedPassword.length }} characters · ~{{ Math.round(passwordEntropy) }} bits of entropy</div>
                    </div>
                    <Notice v-if="!hasValidOptions" type="error" class="mt-4">Select at least one character type or add custom characters.</Notice>
                </Panel>

                <Panel v-if="passwordHistory.length > 0" title="Recent passwords">
                    <template #actions>
                        <Btn size="sm" variant="ghost" @click="clearHistory"><Trash2 /> Clear</Btn>
                    </template>
                    <ul class="space-y-2">
                        <li v-for="(password, i) in passwordHistory.slice(0, 5)" :key="i" class="flex items-center justify-between gap-2 rounded-lg bg-subtle px-3 py-2">
                            <span class="flex-1 truncate font-mono text-sm">{{ password }}</span>
                            <Btn size="sm" variant="ghost" title="Copy password" @click="copyText(password, 'Password copied')"><Copy /></Btn>
                        </li>
                    </ul>
                </Panel>
            </div>

            <Panel title="Options">
                <div class="space-y-5">
                    <Field :label="`Length: ${passwordLength}`">
                        <input v-model.number="passwordLength" type="range" min="4" max="128" class="range" />
                        <div class="mt-1 flex justify-between text-xs text-muted"><span>4</span><span>128</span></div>
                    </Field>

                    <div>
                        <span class="label">Character types</span>
                        <div class="space-y-2 text-sm">
                            <label v-for="c in checks" :key="c.key" class="flex items-center gap-2">
                                <input v-model="options[c.key]" type="checkbox" class="checkbox" /> {{ c.label }}
                            </label>
                        </div>
                    </div>

                    <div>
                        <span class="label">Advanced</span>
                        <div class="space-y-2 text-sm">
                            <label v-for="c in advanced" :key="c.key" class="flex items-start gap-2">
                                <input v-model="options[c.key]" type="checkbox" class="checkbox mt-0.5 shrink-0" /> <span>{{ c.label }}</span>
                            </label>
                        </div>
                    </div>

                    <Field label="Custom characters (optional)">
                        <input v-model="customCharacters" type="text" class="input" placeholder="Add custom characters to include" />
                    </Field>

                    <Btn variant="primary" class="w-full" :disabled="!hasValidOptions" @click="generatePassword()"><RefreshCw /> Generate password</Btn>
                </div>
            </Panel>
        </div>
    </ToolPage>
</template>
