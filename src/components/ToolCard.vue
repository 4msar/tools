<template>
  <div class="bg-white rounded-lg p-6 border border-gray-200 hover:border-gray-300">
    
    <!-- Content -->
    <div>
      <!-- Tool Icon/Image placeholder -->
      <div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
        <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
      </div>

      <!-- Tool Name -->
      <h3 class="text-xl font-semibold text-gray-900 mb-2">
        {{ name }}
      </h3>

      <!-- Tool Description -->
      <p class="text-gray-600 text-sm leading-relaxed mb-6 line-clamp-3">
        {{ description }}
      </p>

      <!-- Visit Link Button -->
      <a 
        :href="visitLink" 
        target="_blank" 
        rel="noopener noreferrer"
        class="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
      >
        <span>Visit Tool</span>
        <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
        </svg>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface ToolCardProps {
  name: string;
  description: string;
  visitLink: string;
}

defineProps<ToolCardProps>();
</script>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>