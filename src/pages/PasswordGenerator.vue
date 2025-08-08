<template>
    <div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div class="max-w-2xl mx-auto">
            <!-- Header -->
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">
                    Password Generator
                </h1>
                <p class="text-gray-600">
                    Generate secure passwords with customizable options
                </p>
            </div>

            <!-- Main Card -->
            <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
                <!-- Generated Password Display -->
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Generated Password
                    </label>
                    <div class="relative">
                        <input
                            type="text"
                            :value="generatedPassword"
                            readonly
                            class="w-full px-4 py-3 pr-24 border border-gray-300 rounded-lg bg-gray-50 font-mono text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Click generate to create a password"
                        />
                        <div
                            class="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-2"
                        >
                            <button
                                @click="copyPassword"
                                :disabled="!generatedPassword"
                                class="p-2 text-gray-500 hover:text-blue-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                                title="Copy password"
                            >
                                <svg
                                    class="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    ></path>
                                </svg>
                            </button>
                            <button
                                @click="generatePassword"
                                class="p-2 text-gray-500 hover:text-green-600 transition-colors"
                                title="Generate new password"
                            >
                                <svg
                                    class="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    ></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Password Length -->
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Password Length: {{ passwordLength }}
                    </label>
                    <input
                        type="range"
                        v-model="passwordLength"
                        min="4"
                        max="128"
                        class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div
                        class="flex justify-between text-xs text-gray-500 mt-1"
                    >
                        <span>4</span>
                        <span>128</span>
                    </div>
                </div>

                <!-- Character Types -->
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 mb-3">
                        Character Types
                    </label>
                    <div class="space-y-3">
                        <div class="flex items-center">
                            <input
                                id="lowercase"
                                type="checkbox"
                                v-model="options.lowercase"
                                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label
                                for="lowercase"
                                class="ml-3 text-sm text-gray-700"
                            >
                                Lowercase letters (a-z)
                            </label>
                        </div>
                        <div class="flex items-center">
                            <input
                                id="uppercase"
                                type="checkbox"
                                v-model="options.uppercase"
                                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label
                                for="uppercase"
                                class="ml-3 text-sm text-gray-700"
                            >
                                Uppercase letters (A-Z)
                            </label>
                        </div>
                        <div class="flex items-center">
                            <input
                                id="numbers"
                                type="checkbox"
                                v-model="options.numbers"
                                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label
                                for="numbers"
                                class="ml-3 text-sm text-gray-700"
                            >
                                Numbers (0-9)
                            </label>
                        </div>
                        <div class="flex items-center">
                            <input
                                id="symbols"
                                type="checkbox"
                                v-model="options.symbols"
                                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label
                                for="symbols"
                                class="ml-3 text-sm text-gray-700"
                            >
                                Symbols (!@#$%^&*()_+-=[]{}|;:,.<>?)
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Advanced Options -->
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 mb-3">
                        Advanced Options
                    </label>
                    <div class="space-y-3">
                        <div class="flex items-center">
                            <input
                                id="excludeSimilar"
                                type="checkbox"
                                v-model="options.excludeSimilar"
                                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label
                                for="excludeSimilar"
                                class="ml-3 text-sm text-gray-700"
                            >
                                Exclude similar characters (0, O, l, I, 1)
                            </label>
                        </div>
                        <div class="flex items-center">
                            <input
                                id="excludeAmbiguous"
                                type="checkbox"
                                v-model="options.excludeAmbiguous"
                                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label
                                for="excludeAmbiguous"
                                class="ml-3 text-sm text-gray-700"
                            >
                                Exclude ambiguous characters ({ } [ ] ( ) / \ '
                                " ` ~ , ; . < >)
                            </label>
                        </div>
                        <div class="flex items-center">
                            <input
                                id="requireFromEachType"
                                type="checkbox"
                                v-model="options.requireFromEachType"
                                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label
                                for="requireFromEachType"
                                class="ml-3 text-sm text-gray-700"
                            >
                                Require at least one character from each
                                selected type
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Custom Characters -->
                <div class="mb-6">
                    <label
                        for="customChars"
                        class="block text-sm font-medium text-gray-700 mb-2"
                    >
                        Custom Characters (optional)
                    </label>
                    <input
                        id="customChars"
                        type="text"
                        v-model="customCharacters"
                        placeholder="Add custom characters to include"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                <!-- Generate Button -->
                <button
                    @click="generatePassword"
                    :disabled="!hasValidOptions"
                    class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                    Generate Password
                </button>

                <!-- Error Message -->
                <div
                    v-if="!hasValidOptions"
                    class="mt-3 text-sm text-red-600 text-center"
                >
                    Please select at least one character type or add custom
                    characters
                </div>
            </div>

            <!-- Password History -->
            <div
                v-if="passwordHistory.length > 0"
                class="bg-white rounded-lg shadow-lg p-6"
            >
                <h3 class="text-lg font-medium text-gray-900 mb-4">
                    Recent Passwords
                </h3>
                <div class="space-y-2">
                    <div
                        v-for="(password, index) in passwordHistory.slice(0, 5)"
                        :key="index"
                        class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                        <span
                            class="font-mono text-sm text-gray-700 flex-1 truncate"
                        >
                            {{ password }}
                        </span>
                        <button
                            @click="copyToClipboard(password)"
                            class="ml-2 p-1 text-gray-500 hover:text-blue-600 transition-colors"
                            title="Copy password"
                        >
                            <svg
                                class="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                ></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <button
                    @click="clearHistory"
                    class="mt-4 text-sm text-red-600 hover:text-red-800 transition-colors"
                >
                    Clear History
                </button>
            </div>

            <!-- Password Strength Indicator -->
            <div
                v-if="generatedPassword"
                class="mt-6 bg-white rounded-lg shadow-lg p-6"
            >
                <h3 class="text-lg font-medium text-gray-900 mb-4">
                    Password Strength
                </h3>
                <div class="space-y-3">
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-700">Strength:</span>
                        <span
                            :class="strengthColor"
                            class="text-sm font-medium"
                        >
                            {{ strengthText }}
                        </span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div
                            :class="strengthColor.replace('text-', 'bg-')"
                            :style="{ width: strengthPercentage + '%' }"
                            class="h-2 rounded-full transition-all duration-300"
                        ></div>
                    </div>
                    <div class="text-xs text-gray-600">
                        <div>
                            Length: {{ generatedPassword.length }} characters
                        </div>
                        <div>
                            Entropy: ~{{ Math.round(passwordEntropy) }} bits
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, reactive } from "vue";
import { toast } from "vue-sonner";

// Character sets
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUMBERS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?";
const SIMILAR_CHARS = "0Ol1I";
const AMBIGUOUS_CHARS = "{}[]()\/\\'\"` ~,;.<>";

// Reactive state
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

// Computed properties
const hasValidOptions = computed(() => {
    return (
        options.lowercase ||
        options.uppercase ||
        options.numbers ||
        options.symbols ||
        customCharacters.value.length > 0
    );
});

const availableCharacters = computed(() => {
    let chars = "";

    if (options.lowercase) chars += LOWERCASE;
    if (options.uppercase) chars += UPPERCASE;
    if (options.numbers) chars += NUMBERS;
    if (options.symbols) chars += SYMBOLS;
    if (customCharacters.value) chars += customCharacters.value;

    // Remove similar characters if requested
    if (options.excludeSimilar) {
        chars = chars
            .split("")
            .filter((char) => !SIMILAR_CHARS.includes(char))
            .join("");
    }

    // Remove ambiguous characters if requested
    if (options.excludeAmbiguous) {
        chars = chars
            .split("")
            .filter((char) => !AMBIGUOUS_CHARS.includes(char))
            .join("");
    }

    return chars;
});

const passwordEntropy = computed(() => {
    if (!generatedPassword.value) return 0;
    const charSetSize = availableCharacters.value.length;
    return Math.log2(Math.pow(charSetSize, generatedPassword.value.length));
});

const strengthPercentage = computed(() => {
    const entropy = passwordEntropy.value;
    if (entropy < 30) return 20;
    if (entropy < 50) return 40;
    if (entropy < 70) return 60;
    if (entropy < 90) return 80;
    return 100;
});

const strengthText = computed(() => {
    const entropy = passwordEntropy.value;
    if (entropy < 30) return "Very Weak";
    if (entropy < 50) return "Weak";
    if (entropy < 70) return "Fair";
    if (entropy < 90) return "Strong";
    return "Very Strong";
});

const strengthColor = computed(() => {
    const entropy = passwordEntropy.value;
    if (entropy < 30) return "text-red-600";
    if (entropy < 50) return "text-orange-600";
    if (entropy < 70) return "text-yellow-600";
    if (entropy < 90) return "text-blue-600";
    return "text-green-600";
});

// Methods
const generatePassword = () => {
    if (!hasValidOptions.value) {
        toast.error("Please select at least one character type");
        return;
    }

    const chars = availableCharacters.value;
    if (chars.length === 0) {
        toast.error("No valid characters available with current settings");
        return;
    }

    let password = "";

    // If requiring from each type, ensure at least one character from each selected type
    if (options.requireFromEachType) {
        const requiredChars: string[] = [];

        if (options.lowercase) {
            const filteredLowercase = filterCharacters(LOWERCASE);
            if (filteredLowercase) {
                requiredChars.push(getRandomChar(filteredLowercase));
            }
        }

        if (options.uppercase) {
            const filteredUppercase = filterCharacters(UPPERCASE);
            if (filteredUppercase) {
                requiredChars.push(getRandomChar(filteredUppercase));
            }
        }

        if (options.numbers) {
            const filteredNumbers = filterCharacters(NUMBERS);
            if (filteredNumbers) {
                requiredChars.push(getRandomChar(filteredNumbers));
            }
        }

        if (options.symbols) {
            const filteredSymbols = filterCharacters(SYMBOLS);
            if (filteredSymbols) {
                requiredChars.push(getRandomChar(filteredSymbols));
            }
        }

        // Add required characters to password
        requiredChars.forEach((char) => {
            password += char;
        });

        // Fill remaining length with random characters
        for (let i = requiredChars.length; i < passwordLength.value; i++) {
            password += getRandomChar(chars);
        }

        // Shuffle the password to avoid predictable patterns
        password = shuffleString(password);
    } else {
        // Generate completely random password
        for (let i = 0; i < passwordLength.value; i++) {
            password += getRandomChar(chars);
        }
    }

    generatedPassword.value = password;
    addToHistory(password);
    toast.success("Password generated successfully!");
};

const filterCharacters = (charSet: string): string => {
    let filtered = charSet;

    if (options.excludeSimilar) {
        filtered = filtered
            .split("")
            .filter((char) => !SIMILAR_CHARS.includes(char))
            .join("");
    }

    if (options.excludeAmbiguous) {
        filtered = filtered
            .split("")
            .filter((char) => !AMBIGUOUS_CHARS.includes(char))
            .join("");
    }

    return filtered;
};

const getRandomChar = (charSet: string): string => {
    const randomIndex = Math.floor(Math.random() * charSet.length);
    return charSet[randomIndex];
};

const shuffleString = (str: string): string => {
    const array = str.split("");
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array.join("");
};

const copyPassword = () => {
    if (generatedPassword.value) {
        copyToClipboard(generatedPassword.value);
    }
};

const copyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        toast.success("Password copied to clipboard!");
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        toast.success("Password copied to clipboard!");
    }
};

const addToHistory = (password: string) => {
    if (passwordHistory.value.includes(password)) return;

    passwordHistory.value.unshift(password);

    // Keep only last 10 passwords
    if (passwordHistory.value.length > 10) {
        passwordHistory.value = passwordHistory.value.slice(0, 10);
    }
};

const clearHistory = () => {
    passwordHistory.value = [];
    toast.info("Password history cleared");
};

// Generate initial password
generatePassword();

let debounceTimer: NodeJS.Timeout;
// add watch to generate on any field changes
watch([passwordLength, options], () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        generatePassword();
    }, 300); // Debounce to avoid too many calls
});
</script>

<style scoped>
/* Custom slider styling */
input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
}

input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    height: 20px;
    width: 20px;
    border-radius: 50%;
    background: #2563eb;
    cursor: pointer;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

input[type="range"]::-moz-range-thumb {
    height: 20px;
    width: 20px;
    border-radius: 50%;
    background: #2563eb;
    cursor: pointer;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

input[type="range"]::-webkit-slider-track {
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
}

input[type="range"]::-moz-range-track {
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    border: none;
}

/* Custom checkbox styling */
input[type="checkbox"]:checked {
    background-color: #2563eb;
    border-color: #2563eb;
}
</style>
