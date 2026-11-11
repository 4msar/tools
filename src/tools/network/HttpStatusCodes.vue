<script setup lang="ts">
import { computed, ref } from "vue";
import { Search } from "lucide-vue-next";
import { Notice, Tabs, ToolPage } from "@/components/ui";
import { copyText } from "@/composables/useClipboard";

interface Status { code: number; name: string; desc: string }
const statuses: Status[] = [
    { code: 100, name: "Continue", desc: "The server received the request headers; the client should send the body." },
    { code: 101, name: "Switching Protocols", desc: "The server is switching to the protocol requested in the Upgrade header." },
    { code: 102, name: "Processing", desc: "The server has accepted the request but has not finished processing it (WebDAV)." },
    { code: 103, name: "Early Hints", desc: "Preliminary headers, usually Link headers, so the client can preload resources." },
    { code: 200, name: "OK", desc: "The request succeeded." },
    { code: 201, name: "Created", desc: "The request succeeded and a new resource was created." },
    { code: 202, name: "Accepted", desc: "The request was accepted but processing is not complete." },
    { code: 203, name: "Non-Authoritative Information", desc: "The response was modified by a transforming proxy." },
    { code: 204, name: "No Content", desc: "The request succeeded and there is no body to return." },
    { code: 205, name: "Reset Content", desc: "The request succeeded; the client should reset the document view." },
    { code: 206, name: "Partial Content", desc: "Only part of the resource is returned, in response to a Range request." },
    { code: 207, name: "Multi-Status", desc: "Multiple status codes for multiple operations (WebDAV)." },
    { code: 208, name: "Already Reported", desc: "Members of a DAV binding were already enumerated earlier (WebDAV)." },
    { code: 226, name: "IM Used", desc: "The server fulfilled a GET using instance manipulations (delta encoding)." },
    { code: 300, name: "Multiple Choices", desc: "There are several possible responses for the request." },
    { code: 301, name: "Moved Permanently", desc: "The resource has a new permanent URL." },
    { code: 302, name: "Found", desc: "The resource is temporarily at a different URL." },
    { code: 303, name: "See Other", desc: "Fetch the response from another URL using GET." },
    { code: 304, name: "Not Modified", desc: "The cached version is still valid; no body is sent." },
    { code: 305, name: "Use Proxy", desc: "The resource must be accessed through a proxy (deprecated)." },
    { code: 307, name: "Temporary Redirect", desc: "Temporary redirect that keeps the request method and body." },
    { code: 308, name: "Permanent Redirect", desc: "Permanent redirect that keeps the request method and body." },
    { code: 400, name: "Bad Request", desc: "The server cannot process the request because of a client error." },
    { code: 401, name: "Unauthorized", desc: "Authentication is required or has failed." },
    { code: 402, name: "Payment Required", desc: "Reserved for future use; sometimes used for paywalls and quotas." },
    { code: 403, name: "Forbidden", desc: "The server understood the request but refuses to authorize it." },
    { code: 404, name: "Not Found", desc: "The requested resource could not be found." },
    { code: 405, name: "Method Not Allowed", desc: "The HTTP method is not supported for this resource." },
    { code: 406, name: "Not Acceptable", desc: "No content matches the Accept headers sent by the client." },
    { code: 407, name: "Proxy Authentication Required", desc: "Authentication with the proxy is required." },
    { code: 408, name: "Request Timeout", desc: "The server timed out waiting for the request." },
    { code: 409, name: "Conflict", desc: "The request conflicts with the current state of the resource." },
    { code: 410, name: "Gone", desc: "The resource has been permanently removed." },
    { code: 411, name: "Length Required", desc: "The request must include a Content-Length header." },
    { code: 412, name: "Precondition Failed", desc: "A precondition in the request headers evaluated to false." },
    { code: 413, name: "Content Too Large", desc: "The request body is larger than the server allows." },
    { code: 414, name: "URI Too Long", desc: "The request URI is longer than the server will interpret." },
    { code: 415, name: "Unsupported Media Type", desc: "The request's media type is not supported." },
    { code: 416, name: "Range Not Satisfiable", desc: "The Range header cannot be fulfilled for this resource." },
    { code: 417, name: "Expectation Failed", desc: "The Expect request header could not be met." },
    { code: 418, name: "I'm a teapot", desc: "The server refuses to brew coffee because it is a teapot (RFC 2324)." },
    { code: 421, name: "Misdirected Request", desc: "The request was sent to a server that cannot produce a response." },
    { code: 422, name: "Unprocessable Content", desc: "The request is well-formed but has semantic errors." },
    { code: 423, name: "Locked", desc: "The resource being accessed is locked (WebDAV)." },
    { code: 424, name: "Failed Dependency", desc: "The request failed because a previous request failed (WebDAV)." },
    { code: 425, name: "Too Early", desc: "The server is unwilling to risk processing a replayable request." },
    { code: 426, name: "Upgrade Required", desc: "The client must switch to a different protocol." },
    { code: 428, name: "Precondition Required", desc: "The server requires the request to be conditional." },
    { code: 429, name: "Too Many Requests", desc: "The client has sent too many requests (rate limiting)." },
    { code: 431, name: "Request Header Fields Too Large", desc: "The headers are too large for the server to process." },
    { code: 451, name: "Unavailable For Legal Reasons", desc: "Access is denied for legal reasons." },
    { code: 500, name: "Internal Server Error", desc: "The server hit an unexpected condition." },
    { code: 501, name: "Not Implemented", desc: "The server does not support the requested functionality." },
    { code: 502, name: "Bad Gateway", desc: "A gateway or proxy received an invalid response from upstream." },
    { code: 503, name: "Service Unavailable", desc: "The server is overloaded or down for maintenance." },
    { code: 504, name: "Gateway Timeout", desc: "A gateway or proxy timed out waiting for upstream." },
    { code: 505, name: "HTTP Version Not Supported", desc: "The HTTP version in the request is not supported." },
    { code: 506, name: "Variant Also Negotiates", desc: "Content negotiation resulted in a circular reference." },
    { code: 507, name: "Insufficient Storage", desc: "The server cannot store the representation needed (WebDAV)." },
    { code: 508, name: "Loop Detected", desc: "The server detected an infinite loop while processing (WebDAV)." },
    { code: 510, name: "Not Extended", desc: "Further extensions to the request are required." },
    { code: 511, name: "Network Authentication Required", desc: "The client must authenticate to gain network access." },
];

type Cls = "all" | "1" | "2" | "3" | "4" | "5";
const cls = ref<Cls>("all");
const query = ref("");

const classMeta: Record<string, { label: string; text: string; bg: string }> = {
    "1": { label: "Informational", text: "text-accent", bg: "bg-accent/10" },
    "2": { label: "Success", text: "text-success", bg: "bg-success/10" },
    "3": { label: "Redirection", text: "text-warning", bg: "bg-warning/10" },
    "4": { label: "Client error", text: "text-danger", bg: "bg-danger/10" },
    "5": { label: "Server error", text: "text-danger", bg: "bg-danger/20" },
};

const filtered = computed(() => {
    const q = query.value.trim().toLowerCase();
    return statuses.filter((s) => {
        if (cls.value !== "all" && String(s.code)[0] !== cls.value) return false;
        if (!q) return true;
        return String(s.code).includes(q) || s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q);
    });
});
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs
                v-model="cls"
                size="sm"
                :options="[
                    { value: 'all', label: 'All' },
                    { value: '1', label: '1xx' },
                    { value: '2', label: '2xx' },
                    { value: '3', label: '3xx' },
                    { value: '4', label: '4xx' },
                    { value: '5', label: '5xx' },
                ]"
            />
        </template>

        <div class="relative">
            <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input v-model="query" class="input pl-9" placeholder="Search by code, name or description…" spellcheck="false" />
        </div>

        <Notice v-if="!filtered.length" type="info">No status codes match your search.</Notice>
        <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <button
                v-for="s in filtered"
                :key="s.code"
                type="button"
                class="flex cursor-pointer gap-3 rounded-xl border border-line bg-surface p-3 text-left shadow-xs transition hover:border-line-strong hover:bg-subtle"
                :title="`Copy ${s.code}`"
                @click="copyText(String(s.code), `Copied ${s.code}`)"
            >
                <span
                    class="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg font-mono text-lg font-semibold"
                    :class="[classMeta[String(s.code)[0]].text, classMeta[String(s.code)[0]].bg]"
                >{{ s.code }}</span>
                <span class="min-w-0">
                    <span class="block text-sm font-semibold">{{ s.name }}</span>
                    <span class="mt-0.5 block text-xs text-muted">{{ s.desc }}</span>
                    <span class="mt-1 block text-[11px] font-medium" :class="classMeta[String(s.code)[0]].text">{{ classMeta[String(s.code)[0]].label }}</span>
                </span>
            </button>
        </div>
    </ToolPage>
</template>
