import { ref } from "vue";
import type { InitProgressReport, WebWorkerMLCEngine } from "@mlc-ai/web-llm";

export type EngineStatus =
    "idle" | "unsupported" | "downloading" | "ready" | "generating" | "error";

export const engineStatus = ref<EngineStatus>("idle");
export const engineProgress = ref<InitProgressReport>({
    progress: 0,
    timeElapsed: 0,
    text: "",
});
export const engineError = ref("");

let engine: WebWorkerMLCEngine | undefined;
let worker: Worker | undefined;
let loadedModelId = "";

export async function supportsWebGPU() {
    if (!("gpu" in navigator)) return false;
    try {
        return !!(await navigator.gpu.requestAdapter());
    } catch {
        return false;
    }
}

export async function load(modelId: string) {
    if (loadedModelId === modelId && engine) {
        engineStatus.value = "ready";
        return;
    }
    if (!(await supportsWebGPU())) {
        engineStatus.value = "unsupported";
        throw new Error("WebGPU is not available in this browser.");
    }
    await unload();
    engineStatus.value = "downloading";
    engineError.value = "";
    worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
    });
    try {
        const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");
        engine = await CreateWebWorkerMLCEngine(worker, modelId, {
            initProgressCallback: (report) => (engineProgress.value = report),
        });
        loadedModelId = modelId;
        engineStatus.value = "ready";
    } catch (error) {
        engineStatus.value = "error";
        engineError.value =
            error instanceof Error
                ? error.message
                : "Unable to load the model.";
        worker?.terminate();
        worker = undefined;
        engine = undefined;
        throw error;
    }
}

export async function ask(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    onToken: (token: string) => void,
) {
    if (!engine) throw new Error("The model is not loaded.");
    engineStatus.value = "generating";
    try {
        const stream = await engine.chat.completions.create({
            messages,
            stream: true,
            temperature: 0.2,
            max_tokens: 180,
        });
        for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content;
            if (token) onToken(token);
        }
        engineStatus.value = "ready";
    } catch (error) {
        engineStatus.value = "error";
        engineError.value =
            error instanceof Error ? error.message : "Generation failed.";
        throw error;
    }
}

export function stop() {
    engine?.interruptGenerate();
    if (engineStatus.value === "generating") engineStatus.value = "ready";
}

export async function unload() {
    if (engine) await engine.unload();
    worker?.terminate();
    engine = undefined;
    worker = undefined;
    loadedModelId = "";
    if (engineStatus.value !== "unsupported") engineStatus.value = "idle";
}

export async function deleteModel(modelId: string) {
    if (loadedModelId === modelId) await unload();
    const { deleteModelAllInfoInCache } = await import("@mlc-ai/web-llm");
    await deleteModelAllInfoInCache(modelId);
}

export async function isCached(modelId: string) {
    const { hasModelInCache } = await import("@mlc-ai/web-llm");
    return hasModelInCache(modelId);
}

export async function storageEstimate() {
    return navigator.storage?.estimate();
}
