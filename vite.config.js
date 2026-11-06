// SPDX-License-Identifier: GPL-3.0-or-later
// 독립 뷰어 페이지 — base 를 상대 경로로 두어 어느 경로(`/` · 하위 경로 · 다른 도메인)에 놓아도 같은 결과물을 쓴다.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { defineConfig } from 'vite'
import { bundleBanner, noticeFiles, sourceUrlMissing } from './scripts/notices.mjs'

// 결과물 위치: DWG_VIEWER_OUT_DIR > (QBOX 저장소 안이면) 프론트의 public/dwg-viewer > dist
const hostPublic = fileURLToPath(new URL('../frontend/public', import.meta.url))
const outDir = process.env.DWG_VIEWER_OUT_DIR ?? (existsSync(hostPublic) ? `${hostPublic}/dwg-viewer` : 'dist')

/** 라이선스 전문 · 서드파티 고지 · '라이선스 · 소스' 페이지를 결과물에 같이 낸다 (GPL-3.0 5조 · 6조 d) */
function legalNotices() {
  return {
    name: 'qbox-dwg-viewer:legal-notices',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(file => file.type === 'chunk')
      // 압축기가 주석을 지우므로 한 줄 고지는 압축이 끝난 번들 머리에 붙인다
      for (const chunk of chunks)
        chunk.code = `${bundleBanner()}\n${chunk.code}`
      const scripts = chunks.map(file => file.fileName)
      for (const [fileName, source] of Object.entries(noticeFiles(scripts)))
        this.emitFile({ type: 'asset', fileName, source })
      if (sourceUrlMissing)
        this.warn('소스 공개 주소 미설정 — source-offer.config.mjs 의 SOURCE_URL(또는 DWG_VIEWER_SOURCE_URL)을 채우기 전에는 외부 배포 불가')
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [legalNotices()],
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
  },
  server: { port: 5177, strictPort: true },
})
