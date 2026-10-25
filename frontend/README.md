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

- 개발 서버는 `/api`를 `http://127.0.0.1:8011`로 넘긴다. 다른 주소면 `HERMES_API_PROXY_TARGET`을 준다.
- 서버를 `uvicorn`이나 Docker로 띄우면 포트가 8000이다.

## 명령

- `npm test` — 단위 테스트(vitest)
- `npm run build` — 타입 검사 + 빌드
- `npm run build:geo -- <HangJeongDong_ver20250701.geojson>` — 지도 경계 파일(`public/geo`) 다시 만들기

## 환경변수

- `VITE_MODEL_API_BASE_URL` — 배포 때 API 주소. 비우면 같은 주소의 `/api`를 부른다.
- `VITE_BASE_PATH` — 배포 경로(예: `/final-client/`).

## 지도 경계

- 출처: 통계청 SGIS / [vuski/admdongkor](https://github.com/vuski/admdongkor) ver20250701, CC BY 4.0
- `scripts/build-geo.mjs`가 mapshaper로 단순화해 시도 1개 + 시도별 행정동 17개 파일을 만든다.

## 서버에 없어서 화면이 대신 처리하는 것

- 메인 자연어 질문: 문장에서 지역·연령만 뽑아 선택 상자에 채운다(`src/lib/parseQuestion.ts`). 분석은 선택 상자 값으로 한다.
- 메인 분석 기준월: 서버가 주는 가장 최근 달을 쓴다.
- 활동 변화 AI 요약: 서버 API가 없어 늘 실패 안내를 보여 준다(`src/api/summary.ts`에 연결하면 된다).
- 대화 이력: 이 브라우저(localStorage)에만 저장한다.
- 대응안 임시 저장: 서버에 저장하기 전 변경은 localStorage에 둔다. 그사이 서버 버전이 바뀌면 임시본을 버리고 서버 저장본을 불러온다.
- 지도 색: I5(0~100) 값을 `src/lib/indexScale.ts`의 5개 구간으로 칠한다. 시도 색은 행정동 I5의 인구 가중 평균이다.
