<template>
    <div class="min-h-screen bg-gray-50 py-8">
        <div class="container mx-auto px-4 max-w-7xl">
            <!-- Header -->
            <div class="text-center mb-8">
                <h1 class="text-4xl font-bold text-gray-900 mb-4">
                    JSON Formatter
                </h1>
                <p class="text-xl text-gray-600 max-w-3xl mx-auto">
                    Format, validate, and prettify your JSON data with syntax
                    highlighting and error detection
                </p>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-wrap justify-center gap-4 mb-6">
                <button
                    @click="formatJson"
                    class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                    Format JSON
                </button>
                <button
                    @click="minifyJson"
                    class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                    Minify JSON
                </button>
                <button
                    @click="validateJson"
                    class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                    Validate JSON
                </button>
                <button
                    @click="clearAll"
                    class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                    Clear All
                </button>
            </div>

            <!-- Main Content -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Input Section -->
                <div class="bg-white rounded-lg shadow-md overflow-hidden">
                    <div
                        class="bg-gray-800 text-white px-4 py-3 flex justify-between items-center"
                    >
                        <h3 class="font-semibold">Input JSON</h3>
                        <div class="flex gap-2">
                            <button
                                @click="pasteFromClipboard"
                                class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                            >
                                Paste
                            </button>
                            <button
                                @click="loadSampleJson"
                                class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                            >
                                Sample
                            </button>
                        </div>
                    </div>
                    <div class="relative">
                        <textarea
                            v-model="inputJson"
                            @input="onInputChange"
                            placeholder="Paste your JSON here..."
                            class="w-full h-96 p-4 font-mono text-sm resize-none border-none outline-none"
                            spellcheck="false"
                        ></textarea>
                        <div
                            class="absolute bottom-2 right-2 text-xs text-gray-500"
                        >
                            {{ inputJson.length }} characters
                        </div>
                    </div>
                </div>

                <!-- Output Section -->
                <div class="bg-white rounded-lg shadow-md overflow-hidden">
                    <div
                        class="bg-gray-800 text-white px-4 py-3 flex justify-between items-center"
                    >
                        <h3 class="font-semibold">Formatted JSON</h3>
                        <div class="flex gap-2">
                            <button
                                @click="copyToClipboard"
                                :disabled="!outputJson"
                                class="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:opacity-50 rounded text-sm transition-colors"
                            >
                                Copy
                            </button>
                            <button
                                @click="downloadJson"
                                :disabled="!outputJson"
                                class="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:opacity-50 rounded text-sm transition-colors"
                            >
                                Download
                            </button>
                        </div>
                    </div>
                    <div class="relative">
                        <pre
                            class="w-full h-96 p-4 font-mono text-sm overflow-auto bg-gray-50 whitespace-pre-wrap"
                            v-html="highlightedJson"
                        ></pre>
                        <div
                            v-if="outputJson"
                            class="absolute bottom-2 right-2 text-xs text-gray-500"
                        >
                            {{ outputJson.length }} characters
                        </div>
                    </div>
                </div>
            </div>

            <!-- JSON Tree View -->
            <div
                v-if="parsedJson && !parseError"
                class="mt-6 bg-white rounded-lg shadow-md overflow-hidden"
            >
                <div class="bg-gray-800 text-white px-4 py-3">
                    <h3 class="font-semibold">Tree View</h3>
                </div>
                <div class="p-4">
                    <JsonTreeNode
                        :data="parsedJson"
                        :key-name="'root'"
                        :level="0"
                    />
                </div>
            </div>

            <!-- JSON Statistics -->
            <div
                v-if="parsedJson && !parseError"
                class="mt-6 bg-white rounded-lg shadow-md p-6"
            >
                <h3 class="text-xl font-semibold mb-4">JSON Statistics</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="text-center">
                        <div class="text-2xl font-bold text-blue-600">
                            {{ jsonStats.size }}
                        </div>
                        <div class="text-sm text-gray-600">Size</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-green-600">
                            {{ jsonStats.keys }}
                        </div>
                        <div class="text-sm text-gray-600">Keys</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-purple-600">
                            {{ jsonStats.depth }}
                        </div>
                        <div class="text-sm text-gray-600">Max Depth</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-orange-600">
                            {{ jsonStats.arrays }}
                        </div>
                        <div class="text-sm text-gray-600">Arrays</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { toast } from "vue-sonner";

// Component for tree view
const JsonTreeNode = {
    name: "JsonTreeNode",
    props: {
        data: [Object, Array, String, Number, Boolean],
        keyName: String,
        level: Number,
    },
    template: `
    <div :style="{ marginLeft: level * 20 + 'px' }" class="json-tree-node">
      <div v-if="isObject || isArray" class="cursor-pointer" @click="toggleExpanded">
        <span class="text-gray-600">{{ expanded ? '▼' : '▶' }}</span>
        <span class="font-semibold text-blue-600">{{ keyName }}</span>
        <span class="text-gray-500">{{ isArray ? '[' + data.length + ']' : '{' + Object.keys(data).length + '}' }}</span>
      </div>
      <div v-else class="flex">
        <span class="font-semibold text-blue-600 mr-2">{{ keyName }}:</span>
        <span :class="getValueClass()">{{ formatValue() }}</span>
      </div>
      <div v-if="expanded && (isObject || isArray)" class="mt-1">
        <JsonTreeNode
          v-for="(value, key) in data"
          :key="key"
          :data="value"
          :key-name="String(key)"
          :level="level + 1"
        />
      </div>
    </div>
  `,
    setup(props: any) {
        const expanded = ref(props.level < 2);

        const isObject = computed(
            () =>
                typeof props.data === "object" &&
                props.data !== null &&
                !Array.isArray(props.data)
        );

        const isArray = computed(() => Array.isArray(props.data));

        const toggleExpanded = () => {
            expanded.value = !expanded.value;
        };

        const getValueClass = () => {
            const type = typeof props.data;
            switch (type) {
                case "string":
                    return "text-green-600";
                case "number":
                    return "text-blue-600";
                case "boolean":
                    return "text-purple-600";
                case "object":
                    return props.data === null
                        ? "text-gray-500"
                        : "text-red-600";
                default:
                    return "text-gray-700";
            }
        };

        const formatValue = () => {
            if (typeof props.data === "string") {
                return `"${props.data}"`;
            }
            return String(props.data);
        };

        return {
            expanded,
            isObject,
            isArray,
            toggleExpanded,
            getValueClass,
            formatValue,
        };
    },
};

// Main component state
const inputJson = ref("");
const outputJson = ref("");
const parsedJson = ref<any>(null);
const parseError = ref("");

// Computed properties
const highlightedJson = computed(() => {
    if (!outputJson.value) return "";
    return syntaxHighlight(outputJson.value);
});

const jsonStats = computed(() => {
    if (!parsedJson.value) return { size: 0, keys: 0, depth: 0, arrays: 0 };

    const stats = {
        size: JSON.stringify(parsedJson.value).length,
        keys: 0,
        depth: 0,
        arrays: 0,
    };

    function analyze(obj: any, depth = 0): void {
        if (depth > stats.depth) stats.depth = depth;

        if (Array.isArray(obj)) {
            stats.arrays++;
            obj.forEach((item) => analyze(item, depth + 1));
        } else if (typeof obj === "object" && obj !== null) {
            stats.keys += Object.keys(obj).length;
            Object.values(obj).forEach((value) => analyze(value, depth + 1));
        }
    }

    analyze(parsedJson.value);
    return stats;
});

// Methods
function formatJson() {
    try {
        const parsed = JSON.parse(inputJson.value);
        outputJson.value = JSON.stringify(parsed, null, 2);
        parsedJson.value = parsed;
        parseError.value = "";
        showStatus("JSON formatted successfully!", "success");
    } catch (error) {
        parseError.value =
            error instanceof Error ? error.message : "Invalid JSON";
        showStatus(`Error: ${parseError.value}`, "error");
    }
}

function minifyJson() {
    try {
        const parsed = JSON.parse(inputJson.value);
        outputJson.value = JSON.stringify(parsed);
        parsedJson.value = parsed;
        parseError.value = "";
        showStatus("JSON minified successfully!", "success");
    } catch (error) {
        parseError.value =
            error instanceof Error ? error.message : "Invalid JSON";
        showStatus(`Error: ${parseError.value}`, "error");
    }
}

function validateJson() {
    try {
        const parsed = JSON.parse(inputJson.value);
        parsedJson.value = parsed;
        parseError.value = "";
        showStatus("JSON is valid!", "success");
    } catch (error) {
        parseError.value =
            error instanceof Error ? error.message : "Invalid JSON";
        parsedJson.value = null;
        showStatus(`Invalid JSON: ${parseError.value}`, "error");
    }
}

function clearAll() {
    inputJson.value = "";
    outputJson.value = "";
    parsedJson.value = null;
    parseError.value = "";
}

function loadSampleJson() {
    inputJson.value = JSON.stringify(
        {
            name: "John Doe",
            age: 30,
            city: "New York",
            hobbies: ["reading", "swimming", "coding"],
            address: {
                street: "123 Main St",
                zipcode: "10001",
            },
            active: true,
            balance: 1250.5,
        },
        null,
        2
    );
}

async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        inputJson.value = text;
        showStatus("Pasted from clipboard!", "info");
    } catch (error) {
        showStatus("Failed to paste from clipboard", "error");
    }
}

async function copyToClipboard() {
    try {
        await navigator.clipboard.writeText(outputJson.value);
        showStatus("Copied to clipboard!", "success");
    } catch (error) {
        showStatus("Failed to copy to clipboard", "error");
    }
}

function downloadJson() {
    const blob = new Blob([outputJson.value], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "formatted.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus("JSON downloaded!", "success");
}

function onInputChange() {
    //
}

function showStatus(message: string, type: "success" | "error" | "info") {
    const toaster = toast[type];

    if (toaster) {
        toaster(message);
    } else {
        toast(message);
    }
}

function syntaxHighlight(json: string): string {
    return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match) => {
            let cls = "text-red-600"; // default
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = "text-blue-600"; // key
                } else {
                    cls = "text-green-600"; // string
                }
            } else if (/true|false/.test(match)) {
                cls = "text-purple-600"; // boolean
            } else if (/null/.test(match)) {
                cls = "text-gray-500"; // null
            } else if (/^-?\d/.test(match)) {
                cls = "text-orange-600"; // number
            }
            return `<span class="${cls}">${match}</span>`;
        }
    );
}

// Auto-format on input change (with debounce)
let debounceTimer: number;
watch(inputJson, () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        if (inputJson.value.trim()) {
            try {
                JSON.parse(inputJson.value);
                // Valid JSON - could auto-format here if desired
            } catch {
                // Invalid JSON - don't auto-format
            }
        }
    }, 500);
});
</script>

<style scoped>
.json-tree-node {
    line-height: 1.5;
}
</style>
