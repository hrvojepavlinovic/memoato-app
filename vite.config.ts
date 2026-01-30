import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    open: true,
  },
  preview: {
    allowedHosts: [
      'app.memoato.com',
      'dev.memoato.com',
      'localhost',
      '127.0.0.1',
    ],
  },
})
