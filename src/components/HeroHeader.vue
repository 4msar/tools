<template>
  <header class="bg-gray-50 py-20 px-4 min-h-screen flex justify-center items-center">
    <div class="max-w-4xl mx-auto text-center">
      <!-- Main heading -->
      <h1 class="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
        Developer Tools
      </h1>
      
      <!-- Subtext -->
      <p class="text-xl text-gray-600 mb-8 leading-relaxed max-w-2xl mx-auto">
        A curated collection of powerful tools to enhance your development workflow.
        Build faster, debug smarter, and ship better code.
      </p>
      
      <!-- CTA button -->
      <button 
        @click="scrollToTools"
        class="px-8 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800"
      >
        Explore Tools
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
const scrollToTools = () => {
  const toolsSection = document.getElementById('tools-section');
  if (toolsSection) {
    toolsSection.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  }
};
</script>
