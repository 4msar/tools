import { toast } from "vue-sonner";

export async function copyText(text: string, label = "Copied to clipboard") {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(label);
        return true;
    } catch {
        toast.error("Could not copy to clipboard");
        return false;
    }
}

export async function readClipboard(): Promise<string> {
    try {
        return await navigator.clipboard.readText();
    } catch {
        toast.error("Clipboard access was denied");
        return "";
    }
}

export function downloadBlob(data: BlobPart, filename: string, type = "text/plain") {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
