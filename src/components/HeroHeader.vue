<template>
  <header class="relative min-h-screen flex items-center justify-center overflow-hidden">
    <!-- Animated Background -->
    <div class="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <!-- Animated particles/shapes -->
      <div class="absolute inset-0">
        <div class="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div class="absolute top-3/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div class="absolute bottom-1/4 left-1/2 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>
      
      <!-- Animated grid overlay -->
      <div class="absolute inset-0 opacity-30">
        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform rotate-12 animate-pulse"></div>
        <div class="absolute inset-0 bg-gradient-to-l from-transparent via-white/5 to-transparent transform -rotate-12 animate-pulse delay-1000"></div>
      </div>
    </div>

    <!-- Content -->
    <div class="relative z-10 text-center px-4 max-w-4xl mx-auto">
      <!-- Main heading with animation -->
      <h1 class="text-5xl md:text-7xl font-bold text-white mb-6 animate-fade-in-up">
        <span class="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
          Developer Tools
        </span>
      </h1>
      
      <!-- Subtext with animation -->
      <p class="text-xl md:text-2xl text-gray-300 mb-8 animate-fade-in-up delay-300 leading-relaxed">
        A curated collection of powerful tools to enhance your development workflow.
        <br class="hidden md:block">
        Build faster, debug smarter, and ship better code.
      </p>
      
      <!-- CTA button with animation -->
      <div class="animate-fade-in-up delay-500">
        <button 
          @click="scrollToTools"
          class="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-full hover:from-purple-700 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl"
        >
          <span class="relative z-10">Explore Tools</span>
          <div class="absolute inset-0 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full blur opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
        </button>
      </div>
    </div>

    <!-- Scroll indicator -->
    <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
      <svg class="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
      </svg>
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

<style scoped>
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.8s ease-out forwards;
}

.delay-300 {
  animation-delay: 0.3s;
}

.delay-500 {
  animation-delay: 0.5s;
}

.delay-1000 {
  animation-delay: 1s;
}

.delay-2000 {
  animation-delay: 2s;
}
</style>
