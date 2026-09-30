import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command }) => ({
  base: process.env.APP_BASE ?? (command === 'build' ? '/Proartuz/' : '/'),
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Arquivos pesados da área Arte (remoção de fundo) não entram no pré-carregamento:
        // são baixados na primeira vez que a ferramenta é usada e ficam em cache depois.
        globIgnores: ['**/*.wasm', '**/ort*.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\.wasm$|\/ort[^/]*\.js$|staticimgly\.com/.test(url.href),
            handler: 'CacheFirst',
            options: {
              cacheName: 'arte-modelos',
              expiration: { maxEntries: 40 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Proartuz',
        short_name: 'Proartuz',
        description: 'Gere propostas comerciais em PDF pelo celular',
        lang: 'pt-BR',
        theme_color: '#0f3d5e',
        background_color: '#f4f6f8',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
}))
