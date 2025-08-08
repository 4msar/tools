<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Hero Header -->
    <HeroHeader />
    
    <!-- Tools Section -->
    <ToolsGrid :tools="tools" />
  </div>
</template>

<script setup lang="ts">
import { tools } from '@/data';
import { HeroHeader, ToolsGrid } from '../components/index.js';
</script>
