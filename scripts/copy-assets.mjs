// SPDX-License-Identifier: GPL-3.0-or-later
// 빌드 전에 public/ 으로 옮기는 정적 파일 — 워커 · wasm(GPL, 원본 그대로) · 한글 글꼴(OFL)
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// 패키지의 exports 표가 package.json 을 내보내지 않아 경로로 직접 찾는다
const pkgDir = name => join(root, 'node_modules', name)

const workers = join(root, 'public/workers')
const fonts = join(root, 'public/cad-data/fonts')
mkdirSync(workers, { recursive: true })
mkdirSync(fonts, { recursive: true })

const viewer = pkgDir('@mlightcad/cad-simple-viewer')
const converter = pkgDir('@mlightcad/libredwg-converter')
cpSync(join(viewer, 'dist/mtext-renderer-worker.js'), join(workers, 'mtext-renderer-worker.js'))
cpSync(join(converter, 'dist/libredwg-parser-worker.js'), join(workers, 'libredwg-parser-worker.js'))
cpSync(join(converter, 'dist/libredwg-web.wasm'), join(workers, 'libredwg-web.wasm'))

// 글꼴은 재배포할 수 있는 것 하나만 둔다(나눔고딕, OFL) — 도면이 쓰는 글꼴이 없으면 이것으로 그린다.
// 뷰어의 기본 글꼴 저장소(외부 CDN)는 쓰지 않는다.
cpSync(join(pkgDir('@fontsource/nanum-gothic'), 'files/nanum-gothic-korean-400-normal.woff'), join(fonts, 'nanumgothic.woff'))
cpSync(join(pkgDir('@fontsource/nanum-gothic'), 'LICENSE'), join(fonts, 'nanumgothic-LICENSE.txt'))
const aliases = [
  'nanumgothic', 'NanumGothic', '나눔고딕',
  'malgun', 'malgunbd', 'malgungothic', 'Malgun Gothic', '맑은고딕', '맑은 고딕',
  'gulim', 'gulimche', '굴림', '굴림체', 'dotum', 'dotumche', '돋움', '돋움체',
  'batang', 'batangche', '바탕', '바탕체', 'gungsuh', '궁서',
]
writeFileSync(join(fonts, 'fonts.json'), `${JSON.stringify([{ file: 'nanumgothic.woff', name: aliases, type: 'mesh' }], null, 2)}\n`)
console.log('dwg-viewer: 워커 · wasm · 글꼴 복사 완료')
