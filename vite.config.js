import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  // Base URL for GitHub Pages - can be overridden by --base flag
  // base: './' // Adding in package.json build command instead
})
