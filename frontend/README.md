# HERMES final-client

React + TypeScript + Tailwind CSS (Vite) 화면. 서버는 `final-server`다.

## 실행

```bash
# 1. 서버 (final-server 폴더에서, 기본 포트 8011)
.venv/bin/python scripts/run_api.py

# 2. 화면 (이 폴더에서)
npm install
npm run dev        # http://localhost:5173
```

두 저장소가 형제 폴더에 있다면 서버의 `.env`를 설정한 뒤 `final-server`에서
`.venv/bin/python scripts/dev.py start`로 둘 다 실행할 수 있다. `status`는 DB·모델 인증·자료 번들·저장소를 확인하고,
`stop`은 이 실행기가 시작한 프로세스만 중지한다. 자세한 준비는 서버의 `docs/LOCAL_SERVICE_SETUP.md`를 참고한다.

- 개발 서버는 `/api`를 `http://127.0.0.1:8011`로 넘긴다. 다른 주소면 `HERMES_API_PROXY_TARGET`을 준다.
- 서버를 `uvicorn`이나 Docker로 띄우면 포트가 8000이다.

## 명령

- `npm test` — 단위 테스트(vitest)
- `npm run build` — 타입 검사 + 빌드
- `npm run build:geo -- <HangJeongDong_ver20250701.geojson>` — 지도 경계 파일(`public/geo`) 다시 만들기

## 환경변수

- `VITE_MODEL_API_BASE_URL` — 배포 때 API 주소. 비우면 같은 주소의 `/api`를 부른다.
- `VITE_BASE_PATH` — 배포 경로(예: `/final-client/`).

## 화면 모드

상단의 화면 모드 선택기에서 `시스템 / 라이트 / 다크`를 고른다. 기본은 시스템이며,
직접 고른 값은 이 브라우저에 저장되고 다른 탭에도 반영된다. 시스템 모드에서는 기기의 설정 변경을 따른다.
다크는 순수 검은 배경·회색 카드·파란색 강조색을 사용한다. 지도·폼·모달·보고서도 같은 테마를 쓴다.

`public/theme-init.js`가 React 로딩 전에 테마를 적용하고, React는 같은 상태 저장소를 구독한다.
테마 변경은 입력·선택 상태를 초기화하거나 서버 요청을 만들지 않는다.

테스트는 `npm test`, 전체 브라우저 점검은 서버와 저장 보고서가 준비된 로컬 환경에서
`python3 scripts/check-theme-browser.py`로 실행한다(Python Playwright 필요).
브라우저 점검은 모든 API 쓰기를 가로채므로 보고서 저장이나 실제 모델 호출을 실행하지 않는다.

## 지도 경계

- 출처: 통계청 SGIS / [vuski/admdongkor](https://github.com/vuski/admdongkor) ver20250701, CC BY 4.0
- `scripts/build-geo.mjs`가 mapshaper로 단순화해 시도 1개 + 시도별 행정동 17개 파일을 만든다.

## 서버에 없어서 화면이 대신 처리하는 것

- 메인 자연어 질문: 문장에서 지역·연령만 뽑아 선택 상자에 채운다(`src/lib/parseQuestion.ts`). 분석은 선택 상자 값으로 한다.
- 메인 분석 기준월: 서버가 주는 가장 최근 달을 쓴다.
- 활동 변화 AI 요약: 저장된 보고서를 열 때 서버에 자동 요청하고, 성공한 요약은 서버 SQLite에서 재사용한다. 다른 AI 작업 중이거나 생성에 실패하면 재시도 버튼을 표시한다.
- 대화 이력: 이 브라우저(localStorage)에만 저장한다.
- 대응안 임시 저장: 서버에 저장하기 전 변경은 localStorage에 둔다. 그사이 서버 버전이 바뀌면 임시본을 버리고 서버 저장본을 불러온다.
- 지도 색: I5(0~100) 값을 `src/lib/indexScale.ts`의 5개 구간으로 칠한다. 시도 색은 행정동 I5의 인구 가중 평균이다.
