<template>
  <div class="group relative bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:border-white/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
    <!-- Card gradient overlay -->
    <div class="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    
    <!-- Content -->
    <div class="relative z-10">
      <!-- Tool Icon/Image placeholder -->
      <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
      </div>

      <!-- Tool Name -->
      <h3 class="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors duration-300">
        {{ name }}
      </h3>

      <!-- Tool Description -->
      <p class="text-gray-300 text-sm leading-relaxed mb-6 line-clamp-3">
        {{ description }}
      </p>

      <!-- Visit Link Button -->
      <a 
        :href="visitLink" 
        target="_blank" 
        rel="noopener noreferrer"
        class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 group-hover:shadow-lg"
      >
        <span>Visit Tool</span>
        <svg class="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
        </svg>
      </a>
    </div>

    <!-- Shine effect -->
    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 rounded-2xl"></div>
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