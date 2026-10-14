import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return
          if (id.includes('/node_modules/@supabase/')) return 'supabase'
          if (id.includes('/node_modules/zod/') || id.includes('/node_modules/react-hook-form/') || id.includes('/node_modules/@hookform/')) return 'forms'
          if (id.includes('/node_modules/lucide-react/')) return 'icons'
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router/')) return 'react-vendor'
        },
      },
    },
  },
})
