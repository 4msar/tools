<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900">
    <!-- Hero Header -->
    <HeroHeader />
    
    <!-- Tools Section -->
    <ToolsGrid :tools="tools" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { HeroHeader, ToolsGrid, type Tool } from '../components/index.js';

// Sample tools data - replace this with your actual tools
const tools = ref<Tool[]>([
  {
    id: '1',
    name: 'JSON Formatter',
    description: 'A powerful JSON formatter and validator that helps you format, validate, and prettify JSON data with syntax highlighting and error detection.',
    visitLink: '#'
  },
  {
    id: '2',
    name: 'Color Palette Generator',
    description: 'Generate beautiful color palettes for your design projects with various harmony rules, accessibility checks, and export options.',
    visitLink: '#'
  },
  {
    id: '3',
    name: 'Base64 Encoder/Decoder',
    description: 'Encode and decode Base64 strings quickly and easily. Perfect for developers working with data encoding and API integrations.',
    visitLink: '#'
  },
  {
    id: '4',
    name: 'URL Shortener',
    description: 'Create short, memorable URLs for your links with detailed analytics, custom domains, and expiration settings.',
    visitLink: '#'
  },
  {
    id: '5',
    name: 'QR Code Generator',
    description: 'Generate QR codes for URLs, text, WiFi credentials, and more with customizable colors, sizes, and download formats.',
    visitLink: '#'
  },
  {
    id: '6',
    name: 'Password Generator',
    description: 'Create strong, secure passwords with customizable length, character sets, and complexity requirements for enhanced security.',
    visitLink: '#'
  }
]);
</script>
