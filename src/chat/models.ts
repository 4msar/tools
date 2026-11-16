import { useStorage } from "@vueuse/core";
import type { AppConfig, ModelRecord } from "@mlc-ai/web-llm";

export interface ChatModel {
    id: string;
    label: string;
    size: string;
    note: string;
}

export const chatModels: ChatModel[] = [
    {
        id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
        label: "Small",
        size: "360M · ~198 MB",
        note: "English, quickest to download",
    },
    {
        id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
        label: "Balanced",
        size: "0.5B · ~350 MB",
        note: "Better answers, larger download",
    },
    {
        id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
        label: "Large",
        size: "1.5B · ~950 MB",
        note: "Most capable, largest download",
    },
];

export const defaultModelId = chatModels[0].id;

// ---------- Full catalog (General Chat) ----------


/** A model the user added by URL. Same shape WebLLM expects in its app config. */
export interface CustomModel {
    model_id: string;
    /** Hugging Face repo with MLC-converted weights, e.g. https://huggingface.co/mlc-ai/… */
    model: string;
    /** WebGPU model library (.wasm) built for this architecture and quantization. */
    model_lib: string;
    vram_required_MB?: number;
    context_window_size?: number;
}

export const customModels = useStorage<CustomModel[]>("devtools:chat:custom-models", []);

export interface CatalogModel {
    id: string;
    family: string;
    vramMB?: number;
    lowResource: boolean;
    contextWindow?: number;
    custom: boolean;
    record: ModelRecord;
}

/** WebLLM's prebuilt list plus the user's custom models, loaded lazily (the library is large). */
export async function appConfig(): Promise<AppConfig> {
    const { prebuiltAppConfig } = await import("@mlc-ai/web-llm");
    const custom: ModelRecord[] = customModels.value.map((m) => ({
        model: m.model,
        model_id: m.model_id,
        model_lib: m.model_lib,
        vram_required_MB: m.vram_required_MB,
        overrides: m.context_window_size ? { context_window_size: m.context_window_size } : undefined,
    }));
    const ids = new Set(custom.map((m) => m.model_id));
    return { ...prebuiltAppConfig, model_list: [...custom, ...prebuiltAppConfig.model_list.filter((m) => !ids.has(m.model_id))] };
}

/** Text-generation models only (no embedding or vision models), smallest first. */
export async function listModels(): Promise<CatalogModel[]> {
    const cfg = await appConfig();
    const customIds = new Set(customModels.value.map((m) => m.model_id));
    return cfg.model_list
        .filter((m) => !m.model_type)
        .map((m) => ({
            id: m.model_id,
            family: m.model_id.split(/-(?=\d|v\d|Instruct|it\b|q\d)/)[0].replace(/-$/, ""),
            vramMB: m.vram_required_MB,
            lowResource: !!m.low_resource_required,
            contextWindow: m.overrides?.context_window_size,
            custom: customIds.has(m.model_id),
            record: m,
        }))
        .sort((a, b) => Number(b.custom) - Number(a.custom) || (a.vramMB ?? 1e9) - (b.vramMB ?? 1e9));
}
