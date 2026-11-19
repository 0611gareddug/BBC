import { defineConfig } from 'vite';

// 원본 HTML은 web/ 에, 빌드 결과는 dist/ 와 저장소 맨 위(브랜치 배포용)에 둡니다.
export default defineConfig({
  root: 'web',
  publicDir: '../public',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  server: { host: true },
});
