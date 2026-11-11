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
