# qbox-dwg-viewer

브라우저에서 DWG·DXF 도면을 여는 독립 뷰어 페이지입니다. 서버 변환 없이 브라우저가 파일을 직접 읽어 그립니다.

두 가지로 씁니다.

- **혼자 열기** — 페이지 주소를 바로 열면 [파일 열기] 또는 끌어 놓기로 PC 의 도면을 엽니다. 파일은 어디로도 보내지 않습니다.
- **끼워 넣기** — 다른 웹 프로그램이 이 페이지를 iframe 으로 끼워 넣고 메시지로 열 파일의 주소만 넘깁니다(QBOX 웹하드가 이렇게 씁니다).
  이 페이지는 끼워 넣는 쪽의 코드를 들여오지 않고, 끼워 넣는 쪽도 이 페이지의 코드를 들여오지 않습니다.

## 라이선스

**GPL-3.0-or-later** — 전문은 [`LICENSE`](LICENSE). 보증은 없습니다.

Copyright (C) 2026 andthebee

소스: <https://github.com/andthebee-net/qbox-dwg-viewer> — 배포한 판마다 `v{version}` 태그가 있습니다.

DWG 해석에 [GNU LibreDWG](https://www.gnu.org/software/libredwg/) 의 웹 빌드(`@mlightcad/libredwg-web` ·
`@mlightcad/libredwg-converter`, GPL-3.0)를 쓰기 때문에 이 뷰어 전체를 GPL 로 공개합니다.
이 저장소가 배포되는 뷰어 페이지의 소스 전부입니다(아래 서드파티 패키지는 고정한 판을 `pnpm install` 로 받습니다).

배포되는 페이지에는 고지가 같이 나갑니다 — 화면 오른쪽 아래 '라이선스 · 소스' 링크(`licenses.html`), `LICENSE.txt`,
`THIRD-PARTY-NOTICES.txt`, JS 번들 머리의 한 줄 고지. 모두 빌드할 때 설치된 패키지에서 읽어 만듭니다(`scripts/notices.mjs`).

### 고지에 들어가는 값

[`source-offer.config.mjs`](source-offer.config.mjs) 한 곳:

- `SOURCE_URL` — 이 소스를 받을 수 있는 공개 주소(환경 변수 `DWG_VIEWER_SOURCE_URL` 로도 줄 수 있음).
  고쳐서 배포하는 경우 고친 소스를 받을 수 있는 주소로 바꿉니다. 비어 있으면 빌드가 경고합니다.
- `COPYRIGHT` — 고지에 표시하는 저작권 표시.

배포한 판과 같은 판의 소스를 받을 수 있어야 합니다 — 배포할 때마다 공개 저장소에 `v{version}` 태그를 둡니다.

## 빌드

Node 22 이상 · pnpm 9 이상.

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm dev       # http://localhost:5177 (혼자 열기 화면 — '라이선스 · 소스' 페이지는 빌드 결과물에만 있습니다)
```

결과물 위치:

| 경우 | 위치 |
| --- | --- |
| 환경 변수 `DWG_VIEWER_OUT_DIR` 지정 | 그 경로 |
| 옆에 `../frontend/public` 이 있음 (QBOX 저장소 안) | `../frontend/public/dwg-viewer` |
| 그 밖 (이 폴더만 떼어 빌드) | `dist/` |

결과물은 정적 파일입니다. 어느 경로에 놓아도 됩니다(`base: './'`). 워커 · wasm · 글꼴은 `scripts/copy-assets.mjs` 가
`node_modules` 에서 `public/` 으로 옮깁니다(원본 그대로).

## 끼워 넣는 방법 (메시지 프로토콜)

```
끼워 넣는 쪽 → 뷰어   { type: 'dwg-viewer:open', url, name }
뷰어 → 끼워 넣는 쪽   { type: 'dwg-viewer:ready' }
                      { type: 'dwg-viewer:state', state: 'loading' | 'done' | 'error', message? }
```

- 끼워 넣는 쪽은 `<iframe src="…/index.html">` 로 이 페이지를 띄웁니다. 뷰어는 `ready` 를 보낸 뒤 `open` 을 기다립니다. `url` 은 뷰어가 인증 정보 없이(`credentials: 'omit'`) 직접 받을 수 있는 주소,
  `name` 은 파일 이름(확장자로 DWG · DXF 를 가립니다)입니다.
- 같은 오리진의 창이 보낸 메시지만 받습니다 — 다른 사이트가 이 페이지를 끼워 넣어 파일을 열게 하지 못합니다.
- 주고받는 것은 주소 · 이름 · 상태 글자뿐입니다. 도면 데이터나 내부 자료 구조는 넘기지 않습니다.

## 쓰는 라이브러리

뷰어 번들 · 워커에 들어가는 것(빌드 도구 제외). 판은 `package.json` · `pnpm-lock.yaml` 에 고정돼 있고,
정확한 목록과 라이선스 전문은 빌드 결과물의 `THIRD-PARTY-NOTICES.txt` 입니다.

| 패키지 | 판 | 라이선스 | 들어가는 곳 | 소스 |
| --- | --- | --- | --- | --- |
| `@mlightcad/libredwg-web` | 0.8.4 | GPL-3.0 | `workers/libredwg-web.wasm` · DWG 워커 | [mlightcad/libredwg-web](https://github.com/mlightcad/libredwg-web) `v0.8.4` (LibreDWG C 소스 포함) |
| `@mlightcad/libredwg-converter` | 3.15.22 | GPL-3.0 | 번들 · `workers/libredwg-parser-worker.js` | [mlightcad/realdwg-web](https://github.com/mlightcad/realdwg-web) `v1.15.22` |
| `@mlightcad/cad-simple-viewer` · `three-renderer` | 1.7.8 | MIT | 번들 | [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer) `v1.7.8` |
| `@mlightcad/data-model` · `common` | 1.15.21 | MIT | 번들 (DXF 해석 포함) | [mlightcad/realdwg-web](https://github.com/mlightcad/realdwg-web) `v1.15.21` |
| `@mlightcad/geometry-engine` · `graphic-interface` | 3.15.21 | MIT | 번들 | 같은 저장소 |
| `@mlightcad/emf-converter` | 1.15.21 | Apache-2.0 | 번들 | 같은 저장소 |
| `@mlightcad/mtext-renderer` | 0.13.7 | MIT | 번들 · `workers/mtext-renderer-worker.js` | [mlightcad/mtext-renderer](https://github.com/mlightcad/mtext-renderer) |
| `@mlightcad/mtext-parser` | 1.5.7 | MIT | 번들 | [mlightcad/mtext-parser](https://github.com/mlightcad/mtext-parser) |
| `@mlightcad/shx-parser` | 1.4.5 | MIT | 글자 그리기(워커) | [mlightcad/shx-parser](https://github.com/mlightcad/shx-parser) |
| `three` | 0.186.1 | MIT | 번들 · 워커 | [mrdoob/three.js](https://github.com/mrdoob/three.js) |
| `lodash-es` · `loglevel` · `uid` · `@lukeed/csprng` · `opentype.js` · `iconv-lite` · `safer-buffer` | — | MIT | 번들 · 워커 | 각 패키지 저장소 |
| `idb` | 8.0.4 | ISC | 글꼴 캐시 | [jakearchibald/idb](https://github.com/jakearchibald/idb) |
| `@velipso/polybool` · `tslib` | — | 0BSD | 번들 | 각 패키지 저장소 |
| `@fontsource/nanum-gothic` (나눔고딕) | 5.3.0 | OFL-1.1 | `cad-data/fonts/nanumgothic.woff` | [fontsource/font-files](https://github.com/fontsource/font-files) |

워커 두 개와 wasm 은 위 패키지가 배포한 파일을 고치지 않고 그대로 옮긴 것입니다.
글꼴은 재배포 가능한 나눔고딕 하나만 같이 배포하고, 외부 글꼴 저장소(CDN)에는 접속하지 않습니다.

## 알려진 한계

- 아주 옛 형식(R14) 도면은 글자 일부가 `?` 로 나올 수 있습니다.
- 외부 참조 · 배경 이미지는 나오지 않습니다.
- 처음 열 때 해석기(wasm) 약 11MB 를 받습니다.
