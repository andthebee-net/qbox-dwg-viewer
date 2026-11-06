/**
 * 도면 뷰어 페이지 — DWG·DXF 를 브라우저에서 읽어 그린다.
 *
 * 이 페이지는 독립된 프로그램이다. 두 가지로 쓴다:
 *  1) 혼자 열기 — 주소로 바로 열면 [파일 열기] 또는 끌어 놓기로 PC 의 도면을 연다 (파일은 어디로도 보내지 않는다)
 *  2) 끼워 넣기 — 다른 웹 프로그램이 iframe 으로 끼우고 메시지로 열 파일의 주소만 넘긴다:
 *   끼워 넣는 쪽 → 뷰어  { type: 'dwg-viewer:open', url, name }   // 같은 오리진의 창이 보낸 것만 받는다
 *   뷰어 → 끼워 넣는 쪽  { type: 'dwg-viewer:ready' }             // 열 준비가 됐다
 *                        { type: 'dwg-viewer:state', state: 'loading' | 'done' | 'error', message? }
 *
 * DWG 해석은 LibreDWG(GPL)의 웹 빌드가 워커에서 한다 — 그래서 이 페이지는 GPL-3.0-or-later 로 공개한다.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 이 프로그램은 자유 소프트웨어다. GNU GPL 버전 3 또는 그 이후 버전의 조건에 따라 재배포 · 수정 가능하다.
 * 보증은 없다. 전문은 LICENSE, 배포본의 고지는 '라이선스 · 소스' 페이지(licenses.html).
 */
import {
  AcApDocManager,
  AcApSettingManager,
  LIBREDWG_PARSER_WORKER_FILE,
  MTEXT_RENDERER_WORKER_FILE,
} from '@mlightcad/cad-simple-viewer'
import { AcDbDatabaseConverterManager, AcDbFileType } from '@mlightcad/data-model'
import { AcDbLibreDwgConverter } from '@mlightcad/libredwg-converter'

const note = document.getElementById('note')
const bar = document.getElementById('bar')
const fit = document.getElementById('fit')
const pick = document.getElementById('pick')
const picker = document.getElementById('picker')
const asset = path => new URL(path, document.baseURI).href
// 끼워 넣지 않고 주소로 바로 연 경우 — 파일을 고르는 화면을 낸다
const standalone = window.parent === window
const host = standalone ? null : window.parent

let shown = false
function tell(state, message) {
  shown = state === 'done'
  note.textContent = message ?? ''
  note.hidden = !message
  fit.hidden = state !== 'done'
  bar.hidden = !standalone && state !== 'done'
  host?.postMessage({ type: 'dwg-viewer:state', state, message }, window.location.origin)
}

const dwgParserUrl = asset(`workers/${LIBREDWG_PARSER_WORKER_FILE}`)
AcDbDatabaseConverterManager.instance.register(
  AcDbFileType.DWG,
  new AcDbLibreDwgConverter({ convertByEntityType: false, useWorker: true, parserWorkerUrl: dwgParserUrl }),
)

const manager = AcApDocManager.createInstance({
  container: document.getElementById('cad'),
  autoResize: true,
  // 글꼴은 이 페이지와 같이 배포한 것만 쓴다 (외부 저장소에 접속하지 않는다)
  baseUrl: asset('cad-data/'),
  webworkerFileUrls: { dwgParser: dwgParserUrl, mtextRender: asset(`workers/${MTEXT_RENDERER_WORKER_FILE}`) },
  builtinOpenFileDialog: false,
  notificationCenter: false,
  disableExport: true,
})
// 보기 전용 — 명령줄 · 도구 모음 · 좌표 표시 등 편집기 화면 요소는 끈다
for (const key of [
  'isShowCommandLine',
  'isShowCoordinate',
  'isShowEntityInfo',
  'isShowLanguageSelector',
  'isShowRibbon',
  'isShowToolbar',
  'isShowShortCutToolbar',
  'isShowStats',
]) {
  AcApSettingManager.instance.set(key, false, { persist: false })
}

const fontsReady = manager.loadDefaultFonts(['nanumgothic']).catch(() => undefined)

async function fetchContent(url) {
  const res = await fetch(url, { credentials: 'omit' })
  if (!res.ok)
    throw new Error(`파일 수신 실패 (${res.status})`)
  return res.arrayBuffer()
}

let opening = 0
/** load = 도면 내용(ArrayBuffer)을 돌려주는 함수 — 주소에서 받거나, 고른 파일을 읽는다 */
async function open(name, load) {
  const turn = ++opening
  tell('loading', '도면을 불러오는 중…')
  try {
    await fontsReady
    const content = await load()
    if (turn !== opening)
      return
    const ok = await manager.openDocument(name, content, { minimumChunkSize: 1000 })
    if (turn !== opening)
      return
    if (!ok)
      throw new Error('도면 해석 실패')
    manager.curView.zoomToFitDrawing(3000)
    tell('done')
  }
  catch {
    if (turn === opening)
      tell('error', standalone ? '도면 표시 불가합니다.' : '도면 표시 불가합니다. 다운로드 후 확인 가능합니다.')
  }
}

fit.addEventListener('click', () => manager.curView.zoomToFitDrawing(1000))

function openFile(file) {
  if (!file)
    return
  if (!/\.(?:dwg|dxf)$/i.test(file.name)) {
    const message = 'DWG · DXF 파일만 표시 가능합니다.'
    if (!shown) {
      tell('error', message)
      return
    }
    // 보고 있던 도면은 그대로 둔다 — 안내만 잠깐 보인다
    note.textContent = message
    note.hidden = false
    setTimeout(() => {
      if (shown && note.textContent === message)
        note.hidden = true
    }, 4000)
    return
  }
  void open(file.name, () => file.arrayBuffer())
}

if (standalone) {
  pick.hidden = false
  fit.hidden = true
  bar.hidden = false
  note.textContent = 'DWG · DXF 파일을 끌어 놓거나 [파일 열기]로 선택 가능합니다.'
  pick.addEventListener('click', () => picker.click())
  picker.addEventListener('change', () => {
    openFile(picker.files?.[0])
    picker.value = ''
  })
  window.addEventListener('dragover', event => event.preventDefault())
  window.addEventListener('drop', (event) => {
    event.preventDefault()
    openFile(event.dataTransfer?.files?.[0])
  })
}

window.addEventListener('message', (event) => {
  // 같은 오리진의 창이 보낸 요청만 — 다른 사이트가 이 페이지를 끼워 넣어 파일을 열게 하지 못한다
  if (event.origin !== window.location.origin)
    return
  const data = event.data
  if (data?.type !== 'dwg-viewer:open' || typeof data.url !== 'string' || typeof data.name !== 'string')
    return
  void open(data.name, () => fetchContent(data.url))
})

host?.postMessage({ type: 'dwg-viewer:ready' }, window.location.origin)
