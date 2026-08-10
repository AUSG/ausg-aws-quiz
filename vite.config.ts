import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base: './' 로 두면 빌드 산출물이 경로에 독립적이라
// 행사장 wifi가 죽었을 때 부스 노트북에서 `npx serve dist` 로 그대로 띄울 수 있다.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'AWS 상식 퀴즈',
        short_name: 'AWS 퀴즈',
        description: 'AWS를 전혀 몰라도 풀 수 있는 5문제 퀴즈',
        lang: 'ko',
        start_url: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0F172A',
        theme_color: '#232F3E',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
})
