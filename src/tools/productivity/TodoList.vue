<script setup lang="ts">
import { computed, ref } from "vue";
import { CalendarDays, Download, Flag, Plus, Trash2 } from "lucide-vue-next";
import { Btn, CopyButton, Panel, Tabs, ToolPage } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";
import { addTodo, todos, type Priority, type Todo } from "./todos";

const text = ref("");
const priority = ref<Priority>("medium");
const due = ref("");
const filter = ref<"all" | "active" | "done">("active");
const sort = ref<"priority" | "due" | "created">("priority");

function add() {
    const t = text.value.trim();
    if (!t) return;
    addTodo(t, priority.value, due.value || undefined);
    text.value = "";
    due.value = "";
}

function toggle(t: Todo) {
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : undefined;
}
const remove = (id: string) => (todos.value = todos.value.filter((t) => t.id !== id));
const clearDone = () => (todos.value = todos.value.filter((t) => !t.done));
const cyclePriority = (t: Todo) => (t.priority = t.priority === "high" ? "medium" : t.priority === "medium" ? "low" : "high");

const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const today = () => new Date().toLocaleDateString("en-CA");

const shown = computed(() => {
    const list = todos.value.filter((t) => (filter.value === "all" ? true : filter.value === "done" ? t.done : !t.done));
    return [...list].sort((a, b) => {
        if (a.done !== b.done) return Number(a.done) - Number(b.done);
        if (sort.value === "priority") return rank[a.priority] - rank[b.priority] || (a.due ?? "~").localeCompare(b.due ?? "~");
        if (sort.value === "due") return (a.due ?? "~").localeCompare(b.due ?? "~") || rank[a.priority] - rank[b.priority];
        return b.createdAt - a.createdAt;
    });
});

const stats = computed(() => {
    const total = todos.value.length;
    const done = todos.value.filter((t) => t.done).length;
    const overdue = todos.value.filter((t) => !t.done && t.due && t.due < today()).length;
    return { total, done, active: total - done, overdue, pct: total ? Math.round((done / total) * 100) : 0 };
});

function dueLabel(d: string) {
    const t = today();
    if (d === t) return "Today";
    const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA");
    if (d === tomorrow) return "Tomorrow";
    return new Date(`${d}T00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
}

const markdown = computed(() => shown.value.map((t) => `- [${t.done ? "x" : " "}] ${t.text}${t.due ? ` (due ${t.due})` : ""}${t.priority === "high" ? " !" : ""}`).join("\n"));

const editing = ref<string | null>(null);
function finishEdit(t: Todo, e: Event) {
    const v = (e.target as HTMLInputElement).value.trim();
    if (v) t.text = v;
    editing.value = null;
}

const priorityColor: Record<Priority, string> = { high: "text-danger", medium: "text-warn", low: "text-muted" };
</script>

<template>
    <ToolPage>
        <Panel>
            <form class="flex flex-wrap items-center gap-2" @submit.prevent="add">
                <input v-model="text" class="input min-w-56 flex-1" placeholder="What needs to be done?" aria-label="New task" autofocus />
                <select v-model="priority" class="select w-auto" aria-label="Priority">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
                <input v-model="due" type="date" class="input w-auto" aria-label="Due date" />
                <Btn type="submit" variant="primary" :disabled="!text.trim()"><Plus /> Add</Btn>
            </form>
        </Panel>

        <div class="grid gap-3 sm:grid-cols-4">
            <div class="rounded-xl border border-line bg-surface p-4"><div class="text-2xl font-semibold tabular-nums">{{ stats.active }}</div><div class="text-xs text-muted">to do</div></div>
            <div class="rounded-xl border border-line bg-surface p-4"><div class="text-2xl font-semibold tabular-nums">{{ stats.done }}</div><div class="text-xs text-muted">done</div></div>
            <div class="rounded-xl border border-line bg-surface p-4"><div class="text-2xl font-semibold tabular-nums" :class="stats.overdue ? 'text-danger' : ''">{{ stats.overdue }}</div><div class="text-xs text-muted">overdue</div></div>
            <div class="rounded-xl border border-line bg-surface p-4">
                <div class="text-2xl font-semibold tabular-nums">{{ stats.pct }}%</div>
                <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle"><div class="h-full bg-accent transition-[width]" :style="{ width: `${stats.pct}%` }" /></div>
            </div>
        </div>

        <Panel flush>
            <template #title>
                <Tabs v-model="filter" size="sm" :options="[{ value: 'active', label: `Active (${stats.active})` }, { value: 'done', label: `Done (${stats.done})` }, { value: 'all', label: 'All' }]" />
            </template>
            <template #actions>
                <select v-model="sort" class="select h-7 w-auto py-0 text-xs" aria-label="Sort">
                    <option value="priority">By priority</option>
                    <option value="due">By due date</option>
                    <option value="created">Newest first</option>
                </select>
                <CopyButton :text="markdown" label="Copy" />
                <Btn size="sm" variant="ghost" :disabled="!todos.length" @click="downloadBlob(JSON.stringify(todos, null, 2), 'todos.json', 'application/json')"><Download /> JSON</Btn>
                <Btn size="sm" variant="ghost" :disabled="!stats.done" @click="clearDone">Clear done</Btn>
            </template>
            <p v-if="!shown.length" class="p-8 text-center text-sm text-muted">
                {{ filter === "done" ? "Nothing finished yet." : todos.length ? "All done. Nice work!" : "No tasks yet. Add one above." }}
            </p>
            <ul v-else class="divide-y divide-line">
                <li v-for="t in shown" :key="t.id" class="group flex items-center gap-3 px-4 py-2.5">
                    <input type="checkbox" class="checkbox" :checked="t.done" :aria-label="`Mark ${t.text} done`" @change="toggle(t)" />
                    <div class="min-w-0 flex-1">
                        <input v-if="editing === t.id" :value="t.text" class="input h-8 py-0" autofocus @blur="finishEdit(t, $event)" @keydown.enter="($event.target as HTMLInputElement).blur()" @keydown.esc="editing = null" />
                        <button v-else type="button" class="block w-full cursor-text truncate text-left text-sm" :class="t.done ? 'text-muted line-through' : ''" title="Click to edit" @click="editing = t.id">{{ t.text }}</button>
                    </div>
                    <span v-if="t.due" class="chip" :class="!t.done && t.due < today() ? 'text-danger ring-danger/40' : ''">
                        <CalendarDays class="size-3" /> {{ dueLabel(t.due) }}
                    </span>
                    <button type="button" class="cursor-pointer" :class="priorityColor[t.priority]" :title="`${t.priority} priority (click to change)`" @click="cyclePriority(t)">
                        <Flag class="size-4" :fill="t.priority === 'high' ? 'currentColor' : 'none'" />
                    </button>
                    <Btn size="sm" variant="ghost" class="opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label="Delete" @click="remove(t.id)"><Trash2 /></Btn>
                </li>
            </ul>
        </Panel>
        <p class="text-xs text-muted">Tasks are saved in this browser only.</p>
    </ToolPage>
</template>
