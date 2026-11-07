import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// Content-Security-Policy, in the built page only (GitHub Pages cannot send headers; the dev server
// needs inline scripts). Limits what an injected script could load or where it could send data.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.open-meteo.com https://*.google.com https://services.arcgisonline.com https://tiles.maps.eox.at https://tile.openstreetmap.org",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ')

const contentSecurityPolicy = () => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
})

// Writes the list of built files into dist/sw.js so the service worker stores the whole app at install
// (screens opened for the first time without network then still work)
const precacheManifest = () => ({
  name: 'precache-manifest',
  apply: 'build',
  closeBundle() {
    const dist = 'dist'
    const files = []
    const walk = (dir) =>
      readdirSync(dir).forEach((name) => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (name !== 'sw.js' && !name.endsWith('.map')) files.push('./' + relative(dist, path).split('\\').join('/'))
      })
    walk(dist)
    const swPath = join(dist, 'sw.js')
    const sw = readFileSync(swPath, 'utf8').replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(['./', ...files])};`)
    writeFileSync(swPath, sw)
  }
})

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    contentSecurityPolicy(),
    precacheManifest()
  ],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('leaflet')) return 'vendor-leaflet';
            if (id.includes('@turf')) return 'vendor-turf';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('lucide-react')) return 'vendor-icons';
          }
        }
      }
    }
  }
})
