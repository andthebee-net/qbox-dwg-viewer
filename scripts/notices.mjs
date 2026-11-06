// SPDX-License-Identifier: GPL-3.0-or-later
// 빌드 결과물에 같이 나가는 고지 파일 — 라이선스 전문 · 서드파티 고지 · '라이선스 · 소스' 페이지.
// 값은 설치된 패키지(node_modules)에서 읽는다 — 손으로 적은 표가 실제와 어긋나지 않게.
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COPYRIGHT, SOURCE_URL } from '../source-offer.config.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = file => JSON.parse(readFileSync(file, 'utf8'))
const own = readJson(join(root, 'package.json'))

const GPL_URL = 'https://www.gnu.org/licenses/gpl-3.0.html'
const LICENSE_URLS = {
  'GPL-3.0': GPL_URL,
  'GPL-3.0-or-later': GPL_URL,
  'MIT': 'https://opensource.org/license/mit',
  'OFL-1.1': 'https://openfontlicense.org/open-font-license-official-text/',
}

/** 패키지 폴더 찾기 — 패키지의 exports 표가 package.json 을 내보내지 않아 node_modules 를 직접 거슬러 오른다 */
function findPackage(name, fromDir) {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json')))
      return realpathSync(candidate)
    if (dirname(dir) === dir)
      return null
  }
}

function repositoryUrl(pkg) {
  const raw = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
  if (!raw)
    return pkg.homepage ?? ''
  const url = raw.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '')
  return /^https?:\/\//.test(url) ? url : `https://github.com/${url.replace(/^github:/, '')}`
}

function describe(dir) {
  const pkg = readJson(join(dir, 'package.json'))
  const licenseFile = readdirSync(dir).find(file => /^(?:licen[sc]e|copying)/i.test(file))
  return {
    dir,
    pkg,
    name: pkg.name,
    version: pkg.version,
    license: typeof pkg.license === 'string' ? pkg.license : 'UNKNOWN',
    repository: repositoryUrl(pkg),
    licenseText: licenseFile ? readFileSync(join(dir, licenseFile), 'utf8').trim() : '',
  }
}

/** 뷰어에 들어갈 수 있는 패키지 전부 — dependencies 에서 시작해 딸린 패키지까지 (빌드 도구는 뺀다) */
function productionPackages() {
  const seen = new Map()
  const visit = (name, fromDir) => {
    const dir = findPackage(name, fromDir)
    if (!dir || seen.has(dir))
      return
    const info = describe(dir)
    seen.set(dir, info)
    for (const dep of Object.keys({ ...info.pkg.dependencies, ...info.pkg.optionalDependencies, ...info.pkg.peerDependencies }))
      visit(dep, dir)
  }
  for (const name of Object.keys(own.dependencies))
    visit(name, root)
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}

const escapeHtml = text => String(text).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch])
const link = (url, label = url) => (url ? `<a href="${escapeHtml(url)}" rel="noopener">${escapeHtml(label)}</a>` : escapeHtml(label))

function thirdPartyText(packages) {
  const head = [
    `${own.name} ${own.version} — 서드파티 고지 (THIRD-PARTY NOTICES)`,
    '',
    '이 뷰어 페이지는 아래 패키지의 코드 · 글꼴을 포함하거나 포함할 수 있습니다.',
    'GPL-3.0 패키지의 라이선스 전문은 같은 폴더의 LICENSE.txt 입니다.',
    '',
  ]
  const body = packages.map((p) => {
    const text = /^GPL-3\.0/.test(p.license) ? '(라이선스 전문: LICENSE.txt — GNU General Public License version 3)' : p.licenseText || '(패키지에 라이선스 파일 없음 — 위 저장소 참조)'
    return [`${'='.repeat(78)}`, `${p.name} ${p.version}`, `License: ${p.license}`, `Source: ${p.repository}`, '', text, ''].join('\n')
  })
  return `${[...head, ...body].join('\n')}\n`
}

/** 배포 파일마다 라이선스 · 소스 — FSF 의 JavaScript License Web Labels 표 모양 (id="jslicense-labels1") */
function labelRows(scripts, byName) {
  const upstream = (name) => {
    const p = byName.get(name)
    return p ? { license: p.license, source: p.repository, version: `${p.name} ${p.version}` } : { license: 'UNKNOWN', source: '', version: name }
  }
  const converter = upstream('@mlightcad/libredwg-converter')
  const wasm = upstream('@mlightcad/libredwg-web')
  const mtext = upstream('@mlightcad/mtext-renderer')
  const font = upstream('@fontsource/nanum-gothic')
  return [
    ...scripts.map(file => ({ file, license: own.license, source: SOURCE_URL, note: `${own.name} ${own.version} (서드파티 고지의 패키지를 묶은 번들)` })),
    { file: 'workers/libredwg-parser-worker.js', license: converter.license, source: converter.source, note: converter.version },
    { file: 'workers/libredwg-web.wasm', license: wasm.license, source: wasm.source, note: `${wasm.version} (LibreDWG 웹 빌드)` },
    { file: 'workers/mtext-renderer-worker.js', license: mtext.license, source: mtext.source, note: mtext.version },
    { file: 'cad-data/fonts/nanumgothic.woff', license: font.license, source: font.source, note: `${font.version} (나눔고딕)` },
  ]
}

function licensesHtml(scripts, packages) {
  const byName = new Map(packages.map(p => [p.name, p]))
  const rows = labelRows(scripts, byName).map(row => `
        <tr>
          <td><a href="${escapeHtml(row.file)}">${escapeHtml(row.file)}</a><br><small>${escapeHtml(row.note)}</small></td>
          <td>${link(LICENSE_URLS[row.license] ?? '', row.license)}</td>
          <td>${row.source ? link(row.source) : '소스 주소 미설정'}</td>
        </tr>`).join('')
  const source = SOURCE_URL
    ? `<p>소스 코드: ${link(SOURCE_URL)} (이 판의 태그 <code>v${escapeHtml(own.version)}</code>)</p>`
    : '<p>소스 코드: 공개 주소 미설정 (배포 전 설정 필요)</p>'
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>도면 뷰어 — 라이선스 · 소스</title>
    <style>
      body { margin: 0 auto; max-width: 860px; padding: 24px 16px 48px; font: 14px/1.7 system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1f2630; word-break: keep-all; }
      h1 { font-size: 20px; } h2 { margin-top: 28px; font-size: 16px; }
      table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #d5dbe3; padding: 6px 8px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
      th { background: #eef2f6; } small { color: #5b6472; } code { font-size: 13px; }
    </style>
  </head>
  <body>
    <h1>도면 뷰어 — 라이선스 · 소스</h1>
    <p>${escapeHtml(own.name)} ${escapeHtml(own.version)}<br>${escapeHtml(COPYRIGHT)}</p>
    <p>
      이 도면 뷰어는 자유 소프트웨어입니다. GNU 일반 공중 사용 허가서(GNU General Public License) 버전 3 또는 그 이후 버전의 조건에 따라
      재배포 · 수정 가능합니다. 이 프로그램은 보증 없이 배포됩니다. 상품성 · 특정 목적 적합성에 대한 묵시적 보증도 없습니다.
    </p>
    <p lang="en">
      This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by
      the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the
      hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
      PURPOSE. See the GNU General Public License for more details.
    </p>
    ${source}
    <p>라이선스 전문: <a href="LICENSE.txt">LICENSE.txt</a> · 서드파티 고지: <a href="THIRD-PARTY-NOTICES.txt">THIRD-PARTY-NOTICES.txt</a></p>
    <p>
      DWG 해석은 <a href="https://www.gnu.org/software/libredwg/" rel="noopener">GNU LibreDWG</a> 의 웹 빌드가 맡습니다.
      이 뷰어는 끼워 넣는 쪽 프로그램과 별개의 프로그램이며, 열 파일의 주소만 메시지로 받습니다.
    </p>
    <h2>배포 파일별 라이선스 · 소스</h2>
    <table id="jslicense-labels1">
      <thead><tr><th>파일</th><th>라이선스</th><th>소스</th></tr></thead>
      <tbody>${rows}
      </tbody>
    </table>
  </body>
</html>
`
}

/** 빌드 결과물에 더할 파일 — { 파일명: 내용 }. scripts 는 번들러가 만든 JS 파일 이름들 */
export function noticeFiles(scripts) {
  const packages = productionPackages()
  return {
    'LICENSE.txt': readFileSync(join(root, 'LICENSE'), 'utf8'),
    'THIRD-PARTY-NOTICES.txt': thirdPartyText(packages),
    'licenses.html': licensesHtml(scripts, packages),
  }
}

/** JS 번들 머리에 남기는 한 줄 고지 */
export function bundleBanner() {
  const where = SOURCE_URL ? ` Source: ${SOURCE_URL}` : ''
  return `/*! ${own.name} ${own.version} | ${COPYRIGHT} | SPDX-License-Identifier: ${own.license} | License and source: licenses.html, LICENSE.txt, THIRD-PARTY-NOTICES.txt.${where} */`
}

export const sourceUrlMissing = !SOURCE_URL
