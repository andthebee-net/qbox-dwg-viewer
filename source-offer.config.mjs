// SPDX-License-Identifier: GPL-3.0-or-later
// 배포되는 뷰어 페이지의 '라이선스 · 소스' 고지에 들어가는 값 — 이 파일 한 곳만 바꾼다.
import process from 'node:process'

/**
 * 이 뷰어의 대응 소스(Corresponding Source)를 받을 수 있는 공개 주소 (GPL-3.0 6조 d).
 * 비어 있으면 빌드가 경고한다 — 비운 채로 외부에 배포하지 않는다.
 * 배포한 판과 같은 판의 소스여야 한다: 공개 저장소에 `v{package.json 의 version}` 태그를 둔다.
 */
export const SOURCE_URL = process.env.DWG_VIEWER_SOURCE_URL ?? 'https://github.com/andthebee-net/qbox-dwg-viewer'

/** 고지에 표시하는 저작권 표시 (GPL-3.0 5조 · 0조 'Appropriate Legal Notices') */
export const COPYRIGHT = 'Copyright (C) 2026 andthebee'
