<template>
  <section id="tools-section" class="py-20 px-4 bg-gray-900/50">
    <div class="max-w-7xl mx-auto">
      <!-- Section Header -->
      <div class="text-center mb-16">
        <h2 class="text-4xl md:text-5xl font-bold text-white mb-4">
          <span class="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Available Tools
          </span>
        </h2>
        <p class="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
          Discover a carefully curated collection of development tools designed to streamline your workflow and boost productivity.
        </p>
      </div>

      <!-- Tools Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <ToolCard
          v-for="tool in tools"
          :key="tool.id"
          :name="tool.name"
          :description="tool.description"
          :visit-link="tool.visitLink"
        />
      </div>

      <!-- Empty State -->
      <div v-if="tools.length === 0" class="text-center py-20">
        <div class="w-24 h-24 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
          </svg>
        </div>
        <h3 class="text-2xl font-bold text-white mb-4">No Tools Available Yet</h3>
        <p class="text-gray-400 max-w-md mx-auto">
          Tools will appear here as they are added to the collection. Check back soon for updates!
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import ToolCard from './ToolCard.vue';

export interface Tool {
  id: string;
  name: string;
  description: string;
  visitLink: string;
}

export interface ToolsGridProps {
  tools: Tool[];
}

defineProps<ToolsGridProps>();
</script>
