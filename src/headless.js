/**
 * 헤드리스 렌더 API — 서버의 브라우저 자동화(tools/dwg-render)가 이 페이지를 열어 도면을 배치(출력 도곽)마다 쪽 그림으로 찍는다.
 *
 *   window.qboxHeadless.open(url, name)        → 배치 목록 [{ btrId, name, isModel, tabOrder, paper: { width, height } | null, empty }]
 *   window.qboxHeadless.show(btrId, w, h)      → 그 배치를 w×h px 화면에 흰 배경 · 검정 선으로 맞춰 그린다 (끝나면 돌아온다)
 *   window.qboxHeadless.canvasRect()           → 찍을 영역 { x, y, width, height }
 *
 * 사람이 보는 뷰어(main.js)와 같은 해석기를 쓴다 — 결과도 같다. 쪽 크기는 배치의 출력 용지 비율을 따른다(없으면 도면 범위 비율).
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import {
  AcApDocManager,
  AcApSettingManager,
  LIBREDWG_PARSER_WORKER_FILE,
  MTEXT_RENDERER_WORKER_FILE,
  layoutBackgroundColorFromRgb,
} from '@mlightcad/cad-simple-viewer'
import { AcDbDatabaseConverterManager, AcDbFileType, acdbHostApplicationServices } from '@mlightcad/data-model'
import { AcDbLibreDwgConverter } from '@mlightcad/libredwg-converter'

const asset = path => new URL(path, document.baseURI).href
const container = document.getElementById('cad')

const dwgParserUrl = asset(`workers/${LIBREDWG_PARSER_WORKER_FILE}`)
AcDbDatabaseConverterManager.instance.register(
  AcDbFileType.DWG,
  new AcDbLibreDwgConverter({ convertByEntityType: false, useWorker: true, parserWorkerUrl: dwgParserUrl }),
)

const manager = AcApDocManager.createInstance({
  container,
  autoResize: true,
  baseUrl: asset('cad-data/'),
  webworkerFileUrls: { dwgParser: dwgParserUrl, mtextRender: asset(`workers/${MTEXT_RENDERER_WORKER_FILE}`) },
  builtinOpenFileDialog: false,
  notificationCenter: false,
  disableExport: true,
})
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
const WHITE = layoutBackgroundColorFromRgb(0xffffff)

const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

async function idle(ms = 120000) {
  await manager.curView.waitUntilIdle(ms)
}

function paperOf(layout) {
  const size = layout.plotPaperSize
  if (!size || !(size.x > 0) || !(size.y > 0))
    return null
  // 회전(90° · 270°)이면 가로세로를 바꾼다
  const rotated = layout.plotRotation === 1 || layout.plotRotation === 3
  return rotated ? { width: size.y, height: size.x } : { width: size.x, height: size.y }
}

function isEmptyBox(box) {
  if (!box)
    return true
  const min = box.min ?? box.minPoint
  const max = box.max ?? box.maxPoint
  if (!min || !max)
    return true
  return !(max.x > min.x) || !(max.y > min.y)
}

async function open(url, name) {
  await fontsReady
  const res = await fetch(url, { credentials: 'omit' })
  if (!res.ok)
    throw new Error(`파일 수신 실패 (${res.status})`)
  const content = await res.arrayBuffer()
  const ok = await manager.openDocument(name, content, {
    minimumChunkSize: 1000,
    convertAllLayouts: true,
    cooperativeYield: false,
    skipSpatialIndex: true,
    sysVars: { modelbkcolor: WHITE, paperbkcolor: WHITE, lwdisplay: true },
  })
  if (!ok)
    throw new Error('도면 해석 실패')
  await idle()
  const db = manager.curDocument.database
  const modelId = db.tables.blockTable.modelSpace.objectId
  const layouts = []
  for (const layout of db.objects.layout.newIterator()) {
    layouts.push({
      btrId: String(layout.blockTableRecordId),
      name: layout.layoutName,
      isModel: layout.blockTableRecordId === modelId,
      tabOrder: layout.tabOrder ?? 0,
      paper: paperOf(layout),
      empty: isEmptyBox(layout.extents) && isEmptyBox(layout.limits),
    })
  }
  layouts.sort((a, b) => (a.isModel === b.isModel ? a.tabOrder - b.tabOrder : a.isModel ? -1 : 1))
  return layouts
}

async function show(btrId, width, height) {
  container.style.width = `${width}px`
  container.style.height = `${height}px`
  await nextFrame()
  const view = manager.curView
  const db = manager.curDocument.database
  const layoutManager = acdbHostApplicationServices().layoutManager
  layoutManager.setCurrentLayoutBtrId(btrId, db)
  await idle()
  // 흰 바탕 — 흰 선(ACI 7)은 라이브러리가 검정으로 바꾼다. 읽기 모드(선 전부 검정)는 쓰지 않는다: 색 채움 상자가 검게 되어 그 안 글자가 묻힌다
  view.backgroundColor = 0xffffff
  await nextFrame()
  // 크기가 반영될 때까지 (ResizeObserver 는 디바운스된다)
  for (let i = 0; i < 20 && (view.width !== width || view.height !== height); i++)
    await new Promise(resolve => setTimeout(resolve, 50))
  // 처음 보는 배치는 라이브러리가 뒤늦게 한 번 더 자기 맞춤을 건다 — 그것이 지나간 뒤 도면 범위에 다시 맞춘다
  const fit = () => {
    const extents = view.getDrawingExtents()
    if (!isEmptyBox(extents))
      view.zoomTo(extents, 1.02)
  }
  fit()
  await idle()
  await new Promise(resolve => setTimeout(resolve, 400))
  await idle()
  fit()
  view.activeLayoutView.render(view.cadScene)
  await nextFrame()
  await nextFrame()
  return { width: view.width, height: view.height, active: String(view.activeLayoutBtrId) }
}

function canvasRect() {
  const rect = manager.curView.canvas.getBoundingClientRect()
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
}

window.qboxHeadless = { open, show, canvasRect }
