# Tools

A collection of useful web-based utility tools built with Vue 3, TypeScript, and Tailwind CSS.

## Available Tools

- **JSON Formatter** - Format and validate JSON data
- **Color Palette Generator** - Generate color palettes for your projects
- **Random Color Generator** - Generate random colors in various formats

## Development

### Setup
```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production
yarn build
```

### Tech Stack
- Vue 3 with TypeScript
- Vue Router for navigation
- Tailwind CSS for styling
- Vite for bundling

## Deployment

This project is automatically deployed to GitHub Pages using GitHub Actions. The deployment workflow:

1. Triggers on pushes to the `main` branch
2. Builds the Vue application using Vite
3. Deploys to GitHub Pages with proper base URL handling

### Live Demo
The tools are available at: `https://4msar.github.io/tools/`

### Manual Deployment
To deploy manually:
1. Ensure GitHub Pages is enabled in repository settings
2. Set the source to "GitHub Actions"
3. Push to the main branch to trigger deployment