<script setup lang="ts">
import { RouterLink } from "vue-router";
import { Github, Globe, ShieldCheck, WifiOff, Wrench } from "lucide-vue-next";
import { Panel } from "@/components/ui";
import { categories, tools } from "@/tools/registry";
import { AUTHOR, SITE_NAME } from "@/site";

const points = [
    { icon: ShieldCheck, title: "Private by design", text: "Everything runs in your browser. Input is never uploaded, and there are no accounts, analytics or trackers." },
    { icon: WifiOff, title: "Works offline", text: "Install DevTools as an app and every tool keeps working without a connection once the page has loaded." },
    { icon: Wrench, title: "Built for everyday work", text: "Small, focused tools for the things developers do all day: formatting, converting, decoding, generating and checking." },
];
</script>

<template>
    <div class="mx-auto max-w-3xl space-y-8">
        <section class="space-y-4">
            <p class="text-sm text-fg-subtle">About</p>
            <h1 class="font-display text-4xl leading-tight font-semibold text-fg sm:text-5xl">
                <span class="text-accent">{{ SITE_NAME }}</span> is a set of free developer tools that stay in your browser.
            </h1>
            <p class="text-base leading-7 text-fg-muted">
                DevTools brings {{ tools.length }} tools across {{ categories.length }} categories into one place: JSON and YAML, regex, hashes and UUIDs, encoders,
                cron, colors, time zones, network helpers and a few AI utilities. There is nothing to sign up for and nothing to install unless you want to.
            </p>
        </section>

        <div class="grid gap-4 sm:grid-cols-3">
            <Panel v-for="p in points" :key="p.title">
                <component :is="p.icon" class="mb-3 size-5 text-accent" stroke-width="1.75" />
                <h2 class="text-sm font-semibold text-fg">{{ p.title }}</h2>
                <p class="mt-1.5 text-sm leading-6 text-fg-muted">{{ p.text }}</p>
            </Panel>
        </div>

        <Panel title="Why it exists">
            <div class="space-y-3 text-sm leading-7 text-fg-muted">
                <p>
                    Many online tools ask you to paste sensitive data into a server you don't control: tokens, configs, payloads, personal details. DevTools is built the other way
                    round. The code is delivered once, and from then on your data never leaves the tab you are using.
                </p>
                <p>
                    Tabs keep your work while you move between tools, and favorites and recent tools are stored only on your device.
                </p>
            </div>
        </Panel>

        <Panel title="Who made it">
            <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0">
                    <p class="text-sm font-medium text-fg">{{ AUTHOR }}</p>
                    <p class="mt-1 text-sm leading-6 text-fg-muted">Built and maintained as a personal project. The source code is open on GitHub.</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <a
                        href="https://msar.me"
                        target="_blank"
                        rel="noopener"
                        class="inline-flex h-9 items-center gap-2 rounded-full bg-subtle px-3.5 text-sm font-medium text-fg ring-1 ring-line ring-inset transition-colors hover:bg-surface hover:text-accent"
                    >
                        <Globe class="size-4" stroke-width="1.75" /> msar.me
                    </a>
                    <a
                        href="https://github.com/4msar/tools"
                        target="_blank"
                        rel="noopener"
                        class="inline-flex h-9 items-center gap-2 rounded-full bg-subtle px-3.5 text-sm font-medium text-fg ring-1 ring-line ring-inset transition-colors hover:bg-surface hover:text-accent"
                    >
                        <Github class="size-4" stroke-width="1.75" /> Source
                    </a>
                </div>
            </div>
        </Panel>

        <p class="text-sm text-fg-subtle">
            Ready to start? <RouterLink to="/" class="font-medium text-accent hover:underline">Browse all tools</RouterLink>.
        </p>
    </div>
</template>
