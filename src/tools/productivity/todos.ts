// To-do store, shared by the tool page and the chat assistant.
import { useStorage } from "@vueuse/core";

export type Priority = "high" | "medium" | "low";
export interface Todo {
    id: string;
    text: string;
    done: boolean;
    priority: Priority;
    due?: string; // yyyy-mm-dd
    createdAt: number;
    doneAt?: number;
}

export const todos = useStorage<Todo[]>("devtools:todos", []);

export function addTodo(text: string, priority: Priority = "medium", due?: string) {
    const todo: Todo = { id: crypto.randomUUID(), text, done: false, priority, due, createdAt: Date.now() };
    todos.value.unshift(todo);
    return todo;
}
