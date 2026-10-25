# HERMES Final Client · 동행관측소

`hermes-complete@6a83418`에서 화면 영역을 분리. API는 [final-server](https://github.com/bigcontest-2026/final-server).

팀 **헤르메스(HERMES)**의 빅콘테스트 2026 **화면 저장소**입니다. **전국 I5 참고지수**와 **자료가 있는 시군구의 SKT·카드 활동변화**를 조회하고, 근거·복지자원 후보·분석 및 대응 보고서를 검토하는 HERMES 화면을 제공합니다. 모든 자료는 final-server의 `/api`로 조회합니다.

> **읽기 기준 — 2026-10-26**: [`hermes-complete`](https://github.com/bigcontest-2026/hermes-complete)의 `main`(`6a83418`)에서 `service/` 아래 화면 영역만 복사해 새 이력으로 시작했습니다. 그때의 `service/frontend`, `service/shared`가 이 저장소의 `frontend/`, `shared/`입니다.

## 🏗️ 구성

```text
final-client/
├── frontend/                       # Vite 진입점·HERMES HTML 연결·테스트
│   └── tests/fixtures/             # final-server I5 번들에서 뽑은 테스트용 행
├── shared/                         # 정적 화면(hermes-complete.html, hermi-*.js/css)·지도·목업
├── scripts/
│   ├── check_mock_data.py          # 목업 데이터 계약 검사
│   ├── build_mock_data.py          # 목업 데이터 생성
│   ├── build_i5_fixtures.py        # 테스트 fixture 재생성
│   └── browser_smoke.cjs           # 선택형 브라우저 점검
└── docs/                           # 화면 가져오기·구현·QA 기록
```

Vite는 `shared/`를 정적 파일 폴더(`publicDir`)로 씁니다. `shared/mock/dataset.json`과 `shared/research/isolation_snapshot.json`은 final-server의 `service/shared/`에도 같은 파일이 있습니다. 바꿀 때는 두 레포를 함께 바꿉니다.

## ▶️ 로컬 실행

**준비물:** Node.js 22 이상. 테스트와 스크립트에는 Python 3.12 이상이 필요합니다.

먼저 [final-server README](https://github.com/bigcontest-2026/final-server#readme)대로 API를 `http://127.0.0.1:8011`에서 실행합니다. 그다음 이 저장소에서:

**macOS / Linux**

```bash
cd frontend
npm ci
MODEL_API_PROXY=http://127.0.0.1:8011 npm run dev -- --port 5175
```

**Windows PowerShell**

```powershell
cd frontend
npm ci
$env:MODEL_API_PROXY='http://127.0.0.1:8011'
npm run dev -- --port 5175
```

브라우저에서 **http://127.0.0.1:5175/** 접속. 기본 진입점은 HERMES HTML이며 이전 React 화면은 `/?mode=legacy`, 합성 시연은 `/?mode=mock`입니다. Vite가 `/api` 요청을 `MODEL_API_PROXY`로 넘깁니다. API 포트를 바꾸면 서버의 `PORT`와 이 값을 함께 맞춥니다.

## ✅ 검사

```bash
python3 scripts/check_mock_data.py
cd frontend
npm test
npm run build
```

2026-10-26 분리 직후 검증: **21 files / 393 passed**, production build 통과.

### 테스트 fixture 다시 만들기

`frontend/tests/fixtures/`의 두 파일은 final-server의 I5 번들에서 테스트가 읽는 행만 뽑은 것입니다. 서버의 I5 번들이 바뀌면 다시 만듭니다.

```bash
python3 scripts/build_i5_fixtures.py <final-server 경로>/model/data/i5/national_2025
```

- `sgg_isolation_index_202512.jsonl`: 2025년 12월 시군구 행 264개
- `dong_isolation_index_seoul_202512.jsonl`: 2025년 12월 서울 행정동 행 427개

## 🧩 화면 쪽 자료와 저장 범위

| 구분 | 현재 사용 방식 | 주의 |
| --- | --- | --- |
| 지역·지도·I5·활동·복지·보고서 | final-server의 `/api/model/*` | 서버 연결 실패 시 저장본 추천으로 조용히 대체하지 않음 |
| 전국 기준값·행정동 통신·보조 맥락 | 원본 HTML에서 가져온 해시 검증 **보관 자료** | 새로운 서버 실측 조회 결과가 아님 |
| 대화·검토·후속 조치·정책 초안 | 브라우저 `localStorage` | 서버 공용 저장·기관 전송·다기기 동기화 아님 |
| 이전 정책 초안 | 기존 브라우저 검토 화면 보존 | 새 서버 대응안으로 자동 이관하지 않음 |

행정동 지도는 2025년 7월 경계를 단순화한 `shared/hermes/dashboard-dongs.geojson`을 사용합니다. 출처·코드 대조·월별 연결 범위는 경계 파일의 `source`에 기록합니다. 서버 API의 계약은 [최종 모델 연동](https://github.com/bigcontest-2026/final-server/blob/main/service/docs/FINAL_MODEL_INTEGRATION.md)과 [조사 계약](https://github.com/bigcontest-2026/final-server/blob/main/service/docs/INVESTIGATION_CONTRACT.md)에 있습니다.

## 🚀 배포

`.github/workflows/deploy-pages.yml`은 수동 실행(`workflow_dispatch`)으로 `final` 화면을 GitHub Pages에 빌드합니다. 경로는 `/final-client/`입니다. 실행 전에 다음이 필요합니다.

- 저장소 변수 `VITE_MODEL_API_BASE_URL`: 배포된 final-server의 HTTPS 주소
- final-server의 `CORS_ORIGINS`에 Pages 주소 등록
- 저장소 설정에서 Pages 소스를 GitHub Actions로 지정

로컬 변경만으로 원격 사이트가 바뀌지 않습니다.

## 📚 문서

- [HTML 가져오기 가이드](docs/HERMES_COMPLETE_IMPORT.md)
- [분석·대응 보고서 연결 수정](docs/REPORT_FLOW_FIXES_20261026.md)
- [배포](docs/DEPLOYMENT.md) · [QA](docs/QA.md)
- 추천/근거 로직: [final-server 단계별 구현](https://github.com/bigcontest-2026/final-server/blob/main/agent/docs/implementation/README.md)
