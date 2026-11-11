<script setup lang="ts">
import { computed, ref } from "vue";
import Ajv2020 from "ajv/dist/2020";
import * as yaml from "js-yaml";
import { FileJson } from "lucide-vue-next";
import { Btn, CodeArea, Notice, Panel, ToolPage } from "@/components/ui";

const SCHEMA = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["name", "age", "email"],
  "properties": {
    "name": { "type": "string", "minLength": 2 },
    "age": { "type": "integer", "minimum": 0, "maximum": 120 },
    "email": { "type": "string", "pattern": "^[^@\\\\s]+@[^@\\\\s]+$" },
    "tags": { "type": "array", "items": { "type": "string" }, "uniqueItems": true }
  },
  "additionalProperties": false
}`;
const DATA = `name: A
age: 130
email: not-an-email
tags: [a, a]
extra: true
`;

const schemaText = ref(SCHEMA);
const dataText = ref(DATA);

function parse(text: string): { value?: unknown; error?: string } {
    if (!text.trim()) return { error: "Empty input" };
    try {
        return { value: JSON.parse(text) };
    } catch (jsonErr) {
        try {
            return { value: yaml.load(text) };
        } catch (yamlErr) {
            const looksJson = /^\s*[[{]/.test(text);
            return { error: ((looksJson ? jsonErr : yamlErr) as Error).message };
        }
    }
}

interface Err {
    path: string;
    message: string;
    keyword: string;
}

const result = computed<{ schemaError?: string; dataError?: string; errors: Err[]; valid: boolean; ready: boolean }>(() => {
    const s = parse(schemaText.value);
    const d = parse(dataText.value);
    if (s.error || d.error) {
        return { schemaError: s.error, dataError: d.error, errors: [], valid: false, ready: false };
    }
    try {
        const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
        const validate = ajv.compile(s.value as object);
        const valid = validate(d.value) as boolean;
        return {
            valid,
            ready: true,
            errors: (validate.errors ?? []).map((e) => ({
                path: e.instancePath || "(root)",
                message: e.message ?? "invalid",
                keyword: e.keyword,
            })),
        };
    } catch (e) {
        return { schemaError: (e as Error).message, errors: [], valid: false, ready: false };
    }
});
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Schema (JSON or YAML)" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="((schemaText = SCHEMA), (dataText = DATA))"><FileJson /> Sample</Btn>
                </template>
                <CodeArea v-model="schemaText" :wrap="false" height="18rem" placeholder="Paste a JSON Schema…" :invalid="!!result.schemaError" />
                <div v-if="result.schemaError" class="border-t border-line p-3"><Notice type="error">Schema: {{ result.schemaError }}</Notice></div>
            </Panel>
            <Panel title="Data (JSON or YAML)" flush>
                <CodeArea v-model="dataText" :wrap="false" height="18rem" placeholder="Paste data to validate…" :invalid="!!result.dataError" />
                <div v-if="result.dataError" class="border-t border-line p-3"><Notice type="error">Data: {{ result.dataError }}</Notice></div>
            </Panel>
        </div>

        <Panel title="Result">
            <Notice v-if="result.ready && result.valid" type="success">Valid. The data conforms to the schema.</Notice>
            <Notice v-else-if="!result.ready" type="warning">Fix the parse errors above to validate.</Notice>
            <div v-else>
                <Notice type="error">{{ result.errors.length }} validation error{{ result.errors.length === 1 ? "" : "s" }}</Notice>
                <ul class="mt-3 divide-y divide-line rounded-lg border border-line">
                    <li v-for="(e, i) in result.errors" :key="i" class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm">
                        <code class="code text-danger break-all">{{ e.path }}</code>
                        <span>{{ e.message }}</span>
                        <span class="chip ml-auto">{{ e.keyword }}</span>
                    </li>
                </ul>
            </div>
        </Panel>
    </ToolPage>
</template>
