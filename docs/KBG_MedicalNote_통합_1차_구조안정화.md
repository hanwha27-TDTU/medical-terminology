# KBG_MedicalNote 통합 1차 구조 안정화 (Migration Plan)

> **작업 성격:** 코드 대수술이 아니라 **문서·설계 산출물**. 이번 단계에서 `index.html`의 기능/저장/동기화/해시체인 로직은 변경하지 않는다.
> **기준 버전:** `APP_INFO.version = v2.33` (2026-07-02)
> **본체:** 단일 HTML (`index.html`, 약 27,100줄 / 1.4MB) — React/Vue/Next 전환 금지, 단일 HTML 유지.
> **목표:** 기존 Medical Note를 향후 "Dr. Bugeon Medical Note Platform"으로 확장하기 위한 (1) 현재 구조 분석 (2) 새 정보구조 매핑 (3) 위험 정리 (4) 안전한 migration plan.
> **소유 식별 전략:** 신규 코드/구획에 `KBG_MedicalNote` 최상위 namespace 적용(기존 코드 즉시 rename 금지).

---

## 0. 핵심 판단 요약 (먼저 읽을 것)

1. **namespace는 신규 코드 전용 — 강제 사항.** `scripts/golden-tests.mjs`·`scripts/check-index-scripts.mjs`가 `index.html`에서 **함수·상수를 정확한 이름으로 추출**해 삭제/변조를 감지한다. 기존 함수(`sbPushAll`, `_rnComputeHash`, `stableForHash` 등)를 `KBG_MedicalNote.*` 안으로 이동하면 **CI가 즉시 깨진다.** 따라서 지시 원칙 #2/#3("신규 코드에만 적용, 기존 대규모 rename 금지")은 선호가 아니라 **기술적 강제 제약**이다.
2. **"단일 canonical entity"는 이미 부분 구현.** `medical_terms`에 `category`+`concept_category`+`system_tags(jsonb)`가 존재한다. 새 `primaryCategory`/`tags`는 이 기존 필드에 매핑하고, **새 메뉴(의학용어/해부·생리/검사·수치)는 같은 테이블을 태그로 거른 뷰**로 설계한다(새 테이블·중복 저장 금지).
3. **연구노트 격리(`RN_PROJECT_NAME`)가 Language-main 흡수의 열쇠.** 전용 테이블 `research_notes_med` + 프로젝트명 필터(`_rnIsOwnProject`)가 이미 있어 자매 앱과 안전하게 통합 가능. Language-main의 별도 TSA/연구노트는 이 시스템으로 흡수한다.
4. **새 8개 최상위 메뉴는 저장소가 아니라 라우팅/뷰 계층.** 기존 6개 라이브러리 모드(terms/microbes/drugs/formulas/diseases/notes)와 7개 도메인 테이블은 그대로 두고, 그 위에 얇은 `AppRouter`(shell)를 얹어 "연결"만 한다.

---

## 1. 현재 Medical Note 구조 분석표

### 1.1 메뉴/탭 구조

| 위치 | 항목 | 트리거 함수 |
|---|---|---|
| 하단 네비(`.bottom-nav`) | 🔍 검색(홈) | `goSearchHome(this)` |
| | ⭐ 즐겨찾기 | `switchTab('bookmark', this)` |
| | 📝 퀴즈 | `openUtilityWindow('quiz', this)` |
| | 📁 데이터 | `openUtilityWindow('export', this)` |
| | 🔎 외부검색 | `showExternalMedicalSearchModal(event)` |
| | 📖 가이드 | `openUtilityWindow('guide', this)` |
| | 🌐 사이트 | `showUsefulSitesModal(event)` |
| 라이브러리 모드 스위처(`role="tab"`) | 📘 일반용어 | `setLibraryMode('terms')` |
| | 🧫 미생물 | `setLibraryMode('microbes')` |
| | 💊 약물명 및 정보 | `setLibraryMode('drugs')` |
| | ∑ 주요 의학계산공식 | `setLibraryMode('formulas')` |
| | 🩺 주요 질환 | `setLibraryMode('diseases')` |
| | 🧠 개념·오답 노트 | `setLibraryMode('notes')` (동적 삽입, `libraryModeNotesBtn`) |

`switchTab(tab, btn)` (index.html:13302): `export`→`showExportMenu`, `guide`→`showGuide`, `ai`→`showAISettings`, `quiz`→`showQuizSetup`, `add`→`showAddTermModal`, `bookmark`→`setLibraryMode('terms')`+`setFilter('즐겨찾기')`.

### 1.2 주요 화면 구역 (`<main id="mainContent">`)

| DOM id | 용도 | 렌더 함수(접두) |
|---|---|---|
| `sectionLabel` | 현재 모드 라벨 | `setSectionLabel` |
| `termList` | 용어 카드 목록 | `renderTerms`/`applyFilters` |
| `drugFrame` | 약물 프레임 | `renderDrugFrame` |
| `formulaFrame` | 공식 프레임 | `renderFormulaFrame` |
| `microbeFrame` | 미생물 프레임 | `renderMicrobeFrame` |
| `diseaseFrame` | 질환 프레임 (목록/목차 토글) | `renderDiseaseFrame`/`renderDiseaseTocHtml` |
| `emptyState` | 데이터 없음 | — |
| 상단 | `totalCount`/`bookmarkCount`/필터바(`filterRow`) | `setFilter`/`renderFilterControls` |

### 1.3 주요 모달/드로어 (id)

`termDrawer`(+`drawerOverlay`) · `drugDrawer`(+`drugDrawerOverlay`) · `microbeDrawer`(+`microbeDrawerOverlay`) · `diseaseDrawer`(+`diseaseDrawerOverlay`) · `integratedNoteModal` · `integratedNoteViewModal` · `integratedNoteTrashModal` · `noteOriginalMcqPanel` · 질환 아형 트리 모달(`diseaseTreeModal`) · 연구노트 패널(`rnOpenNotebook`) · 저장본 버전 확인(`showSavedVersionInfo`) · 개발자 정보(`showDeveloperInfo`) · 외부검색/사이트/AI 설정 모달.

### 1.4 데이터 저장 기능 & localStorage 키 (§복원명세 §4.3 기준)

| 키 | 용도 | 백엔드 |
|---|---|---|
| `kma_medical_terms_v2_terms`/`_meta` | 용어 본체/메타 | IndexedDB / localStorage(메타) |
| `kma_medical_terms_v2_drugs`/`_drugs_meta` | 약물 | IDB |
| `kma_medical_terms_v2_formulas`/`_formulas_meta` | 공식 | IDB |
| `kma_medical_terms_v2_microbes`/`_microbes_meta` | 미생물 | IDB |
| `kma_medical_terms_v2_diseases`/`_diseases_meta` | 질환 | IDB |
| `dr_bugeon_integrated_notes_v1`/`_meta` | 개념·오답 노트 | IDB |
| `kma_medical_terms_v2_tombstones` (+`_drug_/_formula_/_microbe_/_disease_tombstones`) | 도메인별 삭제기록 | localStorage |
| `dr_bugeon_integrated_note_tombstones_v1` | 노트 삭제기록 | localStorage |
| `kma_medical_terms_v2_learning` | 학습상태(SRS/북마크) | IDB |
| `kma_medical_terms_v2_sync_meta` | 로컬 동기화 메타(기준본 버전/리비전/pending) | localStorage |
| `kma_medical_terms_v2_device_id` | 기기 UUID | localStorage |
| `kma_medical_terms_v2_cache_meta` | 캐시 백엔드 상태 | localStorage |
| `kma_supabase_config` | `{url, key}` | localStorage |
| `kma_cloudinary_config` | `{cloudName, uploadPreset, folder}` | localStorage |
| `kma_medical_terms_v2_ai_config` | AI/LLM 키·라우팅 | localStorage |
| `kma_medical_terms_v2_theme` | 테마 | localStorage |
| `dr_bugeon_domain_favorites_v1` | 도메인 즐겨찾기 | localStorage |
| `drbugeon_rn_migrated_v1` | 연구노트 테이블 이관 완료 플래그 | localStorage |

**대용량 캐시 래퍼:** `scheduleLargeCacheWrite(key,value,metaKey,meta)` / `readLargeCacheValue(key,fallback)` — 본체는 IndexedDB, 요약 메타는 localStorage. (불변조건 16: 동기 읽기 경로가 localStorage 직접 읽기 금지)

### 1.5 Supabase 연동 (테이블)

| 테이블 | 형태 | 정규화/매핑 함수 |
|---|---|---|
| `medical_terms` | 정규 컬럼형 | `normalizeTermForStorage`/`termToRow`/`rowToTerm` |
| `medical_drugs` | 정규 컬럼형 | `submitAddDrug`/`saveDrugEdit`/`drugToRow` |
| `medical_formulas` | 정규 컬럼형 | `formulaToRow`/`rowToFormula` |
| `medical_microbes` | 정규 컬럼형 | `normalizeMicrobe*`/`microbeToRow` |
| `medical_diseases` | 하이브리드(플랫 + `body jsonb`, `DISEASE_SECTIONS` 스키마 공유) | `normalizeDiseaseForStorage`/`diseaseToRow`/`rowToDisease` |
| `medical_notes` | JSONB형(`data jsonb`) | `normalizeIntegratedNote`/`noteToRow`/`rowToNote` |
| `medical_term_learning_state` | 학습상태 PK=term_id | `getLearningStateMap` |
| `language_sync_meta` | key/value 만능 메타(canonical 버전/기기상태) | `sbLoadSyncMetaMap`/`sbSetCanonicalSnapshotMeta` |
| `research_notes_med` (레거시 `research_notes`) | 연구노트 append-only | `rn*`/`_rn*` |

**동기화 3동작:** `sbPushAll`(최종상태 저장=이 기기를 기준본) / `pullFromCloud`(클라우드 최종본으로 교체) / `syncWithCloud`(양방향 병합, `pickSyncWinner`+fence). 헤더 `sbHeaders()`(`Prefer: resolution=merge-duplicates`).

### 1.6 Cloudinary/이미지

`kma_cloudinary_config` · unsigned upload(`uploadImageToCloudinary`) → `{url,publicId,width,height,addedAt}` · 썸네일 `cloudinaryThumb()` · 완전삭제는 Edge Function `delete-cloudinary-image`(`/functions/v1/delete-cloudinary-image`, `verify_jwt=true`) via `deleteImageFromCloudinary`. 이미지 바이트는 DB에 저장 안 함(URL만).

### 1.7 백업/복원 · 가져오기/내보내기

전체 JSON export/import(용어·약물·공식·미생물·질환·노트·학습상태) + xlsx/csv/TSV import. 가져오기 수렴점 `applyPendingDataImport`(모드: append=신규만 / merge=updatedAt 더 최신일 때만 / replace=교체). 미리보기=적용 일치 원칙(§복원명세 §9).

### 1.8 플래시카드 · 개념·오답노트 · 연구노트

- **플래시카드(v2.31):** 전 도메인 랜덤 능동 회상 Tier 1 MVP. 퀴즈(`showQuizSetup`)와 별개 진입.
- **개념·오답노트:** `medical_notes`(JSONB), `normalizeIntegratedNote`(화이트리스트) + `sanitizeNoteHtml`(XSS, Cloudinary URL만 허용) + 자동링크(`detectNoteResourceLinksFromText`) + 본문 이미지 삽입(`insertNoteBodyImage`).
- **연구노트(특허 증거 로그):** `rnOpenNotebook`/`rnRenderList`/`rnOpenForm`/`rnShowDetail`/`rnRunVerify`/`rnExport`. append-only.

### 1.9 해시체인 · TSA/RFC3161

`_rnComputeHash`(SHA-256 체인, `previous_entry_hash` 포함) + ECDSA P-256 서명(`_rnSign`/`_rnVerifySig`) + RFC3161 TSA(`_rnRequestTsa`/`_rnAttachTsa`, `/functions/v1/rfc...` Edge Function 릴레이). 격리: `RN_PROJECT_NAME='Dr. Bugeon의 Medical Note'` + `_rnIsOwnProject`. `stableForHash`(canonical 직렬화)는 골든테스트로 잠금. **🔴 CRITICAL ZONE — 리팩토링/재정렬 금지(불변조건 19).**

### 1.10 test / golden test 구조

`scripts/`:
- `check-index-scripts.mjs` — script 문법(node --check)·블록수·`</html>` 종료·**필수 심볼 정확명 존재**·도메인 parity (CI: `index-scripts-check.yml`, push마다)
- `golden-tests.mjs` — 순수함수 추출·characterization(예: `stableForHash`, 이름 정규화)
- `check-schema-drift.mjs` — SQL 스키마 드리프트
- `check-restore-drift.mjs` — 백업/복원 필드 드리프트
- `build-research-manifest.mjs` — 연구노트 공개 해시 매니페스트 (CI: `research-manifest.yml`)
- `check-version-bump.mjs` · `check-skill-docs.mjs` · `sync-instruction-doc.mjs`

---

## 2. 기존 기능 → 새 구조트리 매핑표

> 위험도: 낮음/중간/높음/매우 높음. "변경 필요"는 **이번 1차엔 전부 '아니오(연결만)'** 가 원칙 — 저장/함수/스키마는 유지하고 라우팅 shell만 신설.

### Dashboard (신규 뷰 — 저장소 없음, 기존 데이터 집계만)
| 새 위치 | 현재 기능/데이터 출처 | 변경 필요 | 위험도 | 비고 |
|---|---|---|---|---|
| 오늘의 복습 | `medical_term_learning_state`(due_at, SRS) | 아니오 | 낮음 | 기존 퀴즈/SRS 집계 재사용 |
| 최근 학습 | learning_state `last_reviewed_at` | 아니오 | 낮음 | 읽기 전용 집계 |
| 미완성 노트 | `medical_notes` (bodyHtml 빈 것 등) | 아니오 | 낮음 | 필터 뷰 |
| 오답/취약 개념 | learning_state `wrong_count` + 노트 `noteType='wrong'` | 아니오 | 낮음 | 필터 뷰 |
| 연구노트 최근 로그 | `rnRenderList` 최근 N | 아니오 | **높음** | 🔴 읽기만, 절대 write 경로 신설 금지 |

### Medical Core (기존 5개 도메인 + 노트를 태그/카테고리로 재노출)
| 새 위치 | 현재 기능/DOM/함수 | 현재 저장소 | 변경 필요 | 위험도 | 비고 |
|---|---|---|---|---|---|
| 의학 용어 | `setLibraryMode('terms')`, `termList` | `medical_terms` | 아니오 | 낮음 | |
| 해부·생리 | (신규 뷰) `medical_terms` 필터 | `medical_terms.concept_category/system_tags` | 아니오 | 중간 | **새 테이블 금지 — 태그 필터 뷰** (canonical §3) |
| 약물 | `setLibraryMode('drugs')`, `drugFrame` | `medical_drugs` | 아니오 | 낮음 | |
| 미생물 | `setLibraryMode('microbes')` | `medical_microbes` | 아니오 | 낮음 | |
| 질환 | `setLibraryMode('diseases')`, 목차/트리 | `medical_diseases` | 아니오 | 중간 | parent_id 계층 유지 |
| 검사/수치 | (신규 뷰) 용어/공식 태그 필터 | `medical_terms`/`medical_formulas` | 아니오 | 중간 | 태그 뷰(새 테이블 금지) |
| 공식/계산 | `setLibraryMode('formulas')` | `medical_formulas` | 아니오 | 낮음 | |
| 개념·오답노트 | `setLibraryMode('notes')` | `medical_notes` | 아니오 | 중간 | Review Engine과 **중복 관리 금지** |

### Clinical Language / CPX·OSCE (신규 — 이번엔 **빈 shell만**)
| 새 위치 | 현재 상태 | 변경 필요 | 위험도 | 비고 |
|---|---|---|---|---|
| 일반 회화 / 의학 문장 / 단어장 / 회화 프레임 / IPA·발음 / 녹음·재생 | 없음(Language-main 이식 후보) | shell만 | 중간 | Language-main 흡수 대상, §7 |
| CPX 문진·증례 / OSCE 술기 / 환자 설명 / 진료실 대화 | 없음 | shell만 | 중간 | 동상 |

### Review Engine (기존 퀴즈/플래시카드/SRS를 통합 진입점으로)
| 새 위치 | 현재 기능/함수 | 저장소 | 변경 필요 | 위험도 | 비고 |
|---|---|---|---|---|---|
| 전체 랜덤 복습 | 플래시카드(v2.31) | 전 도메인 | 아니오 | 중간 | |
| 의학/언어/CPX·OSCE/오답 카드 | `showQuizSetup`, learning_state | learning_state | 아니오 | 중간 | 언어/CPX 카드는 이식 후 |
| Anki/TSV 내보내기 | (v2.30에 Anki TSV 버튼 제거됨) | — | 아니오 | 낮음 | 재도입 시 별도 결정 |

### Unified Search / Data Management / Evidence
| 새 위치 | 현재 기능/함수 | 저장소 | 변경 필요 | 위험도 | 비고 |
|---|---|---|---|---|---|
| 전체·도메인별 검색 | `goSearchHome`, 통합검색 | 전 도메인 | 아니오 | 낮음 | 검색 대상에 언어/CPX 추가는 이식 후 |
| 연결 노트 검색 | 자동링크/`detectNoteResourceLinksFromText` | notes | 아니오 | 중간 | |
| 가져오기/내보내기/백업/복원 | `applyPendingDataImport` 등 | 전 도메인 | 아니오 | **높음** | 포맷 호환성 필수 유지 |
| Supabase 동기화 | `sbPushAll`/`pullFromCloud`/`syncWithCloud` | 전 테이블 | 아니오 | **매우 높음** | 🔴 모드 절대 혼용 금지 |
| 미디어/이미지 관리 | Cloudinary + Edge Function | Cloudinary | 아니오 | 높음 | 보호집합 불변조건 12 |
| Evidence(착상~변경이력) | `rnOpenForm`(카테고리) | `research_notes_med` | 아니오 | **매우 높음** | 🔴 append-only, 정정만 |
| 해시체인 / TSA·RFC3161 | `_rnComputeHash`/`_rnRequestTsa` | research_notes_med | 아니오 | **매우 높음** | 🔴 CRITICAL ZONE |

---

## 3. "KBG_MedicalNote" namespace 도입 계획

### 3.1 목적과 한계
- 목적: 코드 소유자 식별, 전역 충돌 방지, 연구노트/특허 증거화 보조.
- **한계 명시(원칙 #6):** prefix 명명만으로 소유권이 증명되지 않는다 → Git commit + 연구노트 + 변경 로그 + 해시체인 + TSA/RFC3161과 **함께** 유지해야 증거력이 생긴다.

### 3.2 도입 방식 — **신규 코드 전용, additive**
```js
// index.html 신규 <script> 블록 상단(기존 4블록 뒤, 15. App Init 전)
const KBG_MedicalNote = {
  AppConfig:      {},   // 신규: 플랫폼 메뉴/라우트 상수 (기존 APP_INFO는 유지·미이동)
  AppSchema:      {},   // 신규: canonical entity 태그 사전(§4), 기존 DISEASE_SECTIONS는 유지
  AppStore:       {},   // 신규 상태만. 기존 TERMS/DRUGS/... 전역 배열은 미이동
  AppServices:    {},   // 신규 서비스. sb*/rn*/cloudinary*는 미이동(참조만)
  AppUI:          {},   // 신규 shell 렌더
  AppModules:     {},   // Clinical Language / CPX·OSCE 신규 모듈 자리
  AppRouter:      {},   // 8개 최상위 메뉴 라우팅(기존 switchTab/setLibraryMode를 호출만)
  AppMigration:   {},   // 이 문서의 단계 상태 추적/가드
  AppEvidence:    {},   // 연구노트 연결 헬퍼(읽기·기록 트리거만, 해시로직 미이동)
  AppResearchLog: {},   // 연구노트 표시 어댑터
  init() { console.info("[KBG_MedicalNote] init"); }
};
```

### 3.3 **금지 사항 (CI 보호)**
`golden-tests.mjs`/`check-index-scripts.mjs`가 정확명으로 검사하는 심볼 — 다음을 namespace 안으로 **이동/rename 금지**:
`sbPushAll`, `pullFromCloud`, `syncWithCloud`, `pickSyncWinner`, `filterLocalRowsAfterCanonicalFence`, `normalizeIntegratedNote`, `sanitizeNoteHtml`, `noteToRow`, `_rnComputeHash`, `_rnSign`, `stableForHash`, `computeSnapshotHash`/`canonical*HashPayload`, `normalize*ForStorage`, `*ToRow`/`rowTo*`, `DISEASE_SECTIONS`, `APP_INFO`, `UPDATE_HISTORY` 등.
→ namespace 도입 후 반드시 `node scripts/check-index-scripts.mjs && node scripts/golden-tests.mjs` 통과 확인.

### 3.4 전역 충돌 방지 원칙
`window.KBG_AppConfig`, `window.KBG_AppStore`처럼 여러 전역을 흩뿌리지 말고 **단일 `KBG_MedicalNote` 아래 배치**(원칙 #4). 신규 함수는 `KBG_MedicalNote.AppUI.renderDashboard()`처럼 namespaced.

---

## 4. 단일 canonical entity 설계안

### 4.1 원칙 (지시 그대로)
1. 하나의 의학 개념 = 하나의 canonical entity로만 저장.
2. `primaryCategory` = 가장 본질적 분류.
3. 일반용어/USMLE/KMLE/CPX/질환 연결 = `tags` 또는 `linkedConcepts`.
4. UI 메뉴는 여러 곳에서 같은 entity 노출, DB는 중복 저장 안 함.
5. 플래시카드도 canonical entity 기준 → 중복 카드 방지.

### 4.2 **기존 스키마 매핑 (신규 필드 병렬 생성 금지)**
새 예시 필드는 이미 있는 컬럼에 매핑한다:

| 예시 필드 | 기존 `medical_terms` 컬럼 | 처리 |
|---|---|---|
| `primaryCategory: "anatomy_physiology"` | `concept_category` | 기존 컬럼 재사용 |
| `subCategory: "anatomy_structure"` | `category` | 기존 컬럼 재사용 |
| `tags: [...]` | `system_tags (jsonb[])` | 기존 컬럼 재사용 |
| `linkedConcepts: [...]` | (노트) `linkedTerms/Drugs/Microbes/Formulas` 또는 신규 `system_tags` 관례 | 노트 링크 재사용 우선 |
| `ko/en/uz` | `ko/en/uz` | 그대로 |

예시(심방)는 **`medical_terms`의 한 행**으로 저장하고, "의학 용어" 메뉴와 "해부·생리" 메뉴 **양쪽에서 태그 필터로 노출**한다. → `medical_terms`와 별도 `anatomy` 테이블에 중복 저장하지 않는다.

### 4.3 도메인 경계 원칙 (5개 테이블은 유지)
현 스키마는 terms/drugs/microbes/formulas/diseases가 **별도 테이블**이다. canonical 원칙은 "이 5개를 하나로 합쳐라"가 **아니라**:
- **동일 도메인 내 중복 금지**(같은 용어를 의학용어+해부·생리 두 행으로 넣지 않음 → 태그로 해결).
- **도메인 간 연결은 `linkedConcepts`/노트 자동링크**로(중복 저장 아님).

### 4.4 태그 사전 (`KBG_MedicalNote.AppSchema` 신규)
`primaryCategory` 허용값, `tags` 표준 어휘(예: `general_medical_term`, `anatomy`, `cardiovascular`, `usmle`, `kmle`, `cpx`)를 신규 상수로 정의. **기존 데이터 일괄 재분류는 하지 않음**(v1.50 교훈: 업로드 전용 정규화는 `normalize*ForStorage`에 넣지 말 것 — 기존 데이터까지 변경됨).

---

## 5. 충돌 위험도 평가표

| 항목 | 위험도 | 근거/완화 |
|---|---|---|
| localStorage key 충돌 | **낮음** | 기존 키 접두 `kma_`/`dr_bugeon_`. 신규는 `kbg_` 또는 `KBG_MedicalNote.*` 관례로 분리. 기존 키 변경 금지. |
| IndexedDB store 충돌 | **낮음** | `LOCAL_CACHE_STORE` 단일. 신규 데이터도 같은 래퍼(`scheduleLargeCacheWrite`) 키만 추가. |
| Supabase table/schema 충돌 | **중간** | 새 언어/CPX 데이터를 기존 테이블에 태그로? or 신규 테이블? → 1차엔 스키마 변경 0(shell만). 신규 테이블 필요 시 `check-schema-drift` 갱신 필수. |
| Cloudinary 충돌 | **낮음** | 단일 config·Edge Function. 언어 녹음/이미지도 동일 파이프 재사용. |
| 백업/복원 포맷 충돌 | **높음** | 새 도메인 추가 시 export/import·미리보기=적용·`check-restore-drift` 동시 갱신 필요. 1차엔 변경 0. |
| 가져오기/내보내기 포맷 충돌 | **중간** | `applyPendingDataImport` 수렴점 유지. 새 도메인은 그 파이프에 편입해야(별도 파서 금지). |
| 플래시카드 중복 생성 | **중간** | canonical entity 기준 생성 + Review Engine과 Medical Core 이중관리 금지(원칙). |
| canonical entity 중복 | **중간** | 태그 뷰로 해결(§4). 새 테이블/행 복제 금지. |
| **연구노트 해시체인 손상** | **매우 높음** | 🔴 `_rnComputeHash` 필드순서/제외목록/canonical 직렬화 불변. append-only, 정정 엔트리만. CRITICAL ZONE. |
| **TSA/RFC3161 손상** | **매우 높음** | 🔴 사후부착(tsa/서명/server_time) 해시 제외 규칙 유지. Edge Function 릴레이 불변. |
| DOM id 중복 | **중간** | 신규 shell은 `kbg-` prefix DOM id. 기존 id 재사용/rename 금지. |
| 이벤트 핸들러 끊김 | **중간** | 기존 inline `onclick` 대량 존재 → 신규 라우터는 기존 함수 **호출만**, 재바인딩 금지. |
| test/golden test 실패 | **높음** | namespace/구획 이동이 정확명 심볼 추출을 깨뜨릴 수 있음 → §3.3 금지목록 + 커밋 전 CI 실행. |
| Language-main 이식 충돌 | **높음** | 별도 Supabase/백업/연구노트/TSA/테마/AI/device_id 중복(§7). 시스템 코어는 Medical Note로 단일화. |
| 단일 HTML 구획 재배치 충돌 | **중간** | 대용량 파일 저장 시 끝 절단 위험 → `</html>` 종료·블록수 검사(check-index-scripts). 1차엔 이동 없이 주석 구획만. |
| KBG namespace 도입 충돌 | **낮음(신규)/높음(기존이동시)** | additive면 낮음. 기존 함수 이동 시 CI·이벤트 핸들러 깨짐 → 신규 전용 원칙 준수. |

---

## 6. 단일 HTML 내부 구획 재설계안

### 6.1 목표
단일 `index.html` 유지 + 내부를 주석 구획으로 정리(**즉시 이동 없음**). 현재 코드가 어느 구획에 해당하는지 매핑만 한다.

### 6.2 권장 구획 ↔ 현재 위치 매핑
| 구획 | 현재 위치(대략) | 이번 조치 |
|---|---|---|
| 0. KBG Metadata | `APP_INFO`/`UPDATE_HISTORY` 근처 | 주석 배너만 추가 |
| 1. CSS Design System | `<head>` CSS 3블록 | 유지 |
| 2. HTML App Shell | `<body>` 상단~`.bottom-nav` | 유지, 신규 shell은 하단 추가 |
| 3. HTML Templates | 각 모달/드로어 markup | 유지 |
| 4. AppConfig | `APP_INFO`, 모델 프리셋 상수 | 신규 상수만 `KBG_MedicalNote.AppConfig` |
| 5. AppSchema | `DISEASE_SECTIONS`, 정규화 스키마 | 유지 + 신규 태그사전 |
| 6. AppStore | `TERMS/DRUGS/...` 전역 배열, IDB 래퍼 | 유지(미이동) |
| 7. AppServices | `sb*`, `rn*`, Cloudinary | 유지(미이동) |
| 8. AppUI | `render*Frame`, `setFilter` | 유지 |
| 9. AppModules | (신규) 언어/CPX·OSCE | 신규 자리 |
| 10. AppRouter | `switchTab`/`setLibraryMode` | 유지 + 얇은 신규 라우터가 호출 |
| 11. AppMigration | 없음 | 신규(이 문서 단계 가드) |
| 12. AppEvidence | `rn*` 연결부 | 참조만 |
| 13. AppResearchLog | `rnRenderList` 등 | 어댑터만 |
| 14. Backup/Sync/Cloudinary Protection | 백업·동기화·이미지삭제 | 유지, 🔴 보호 |
| 15. App Init | 앱 시작 부트스트랩 | 유지 + `KBG_MedicalNote.init()` 마지막 호출 |

### 6.3 실행 규칙
- 즉시 대이동 금지. **주석 배너(`/* ===== 6. KBG_MedicalNote.AppStore ===== */`)만** 먼저 삽입.
- 저장 후 항상 `</html>` 종료·script 블록수·`node scripts/check-index-scripts.mjs` 검증.

---

## 7. Language-main 이식 후보 / 제외 후보

> **범위 정정(사용자 지시):** 이번 목적은 Language Master **전체 시스템 병합이 아니다.** Language-main `index.html` 내부에 **실제 사용자 기능으로 구현된 학습 기능만** 식별해 이식 후보로 분류한다. 시스템 계층(아래 §7.2)은 **1차 분석 대상에서 완전히 제외**한다 — Medical Note의 시스템 코어를 기준으로 유지하고, Language-main은 **기능 참고 자료로만** 쓴다.
>
> ⚠️ **소스 접근 상태(2026-07-02):** Language-main `index.html` 원본이 이 세션에 없다(워크스페이스에 없고, 저장소 접근 범위는 `hanwha27-tdtu/medical-note` 단일). 따라서 아래 이식 후보는 **기능명 수준의 분류 틀**이며, 실제 함수/DOM id/데이터 구조 대조는 소스 확보 후 `docs/KBG_MedicalNote_Language이식후보_분석틀.md`의 빈칸을 채워 확정한다. 소스 없이 목록을 지어내지 않는다.

### 7.1 이식 후보 (사용자 기능만) → Clinical Language / CPX·OSCE 모듈
| 기능 | 새 모듈 위치 | Medical Note 재사용 코어(예상) |
|---|---|---|
| 일반 회화 | Clinical Language | 노트/카드 렌더 패턴, `speakText`/`ttsSpeed`(TTS) |
| 의학 문장 | Clinical Language | 자동링크(`detectNoteResourceLinksFromText`) |
| 단어장 | Clinical Language | `medical_terms` 태그 뷰 or 신규 모듈 데이터 |
| 회화 프레임 | Clinical Language | 카드/드로어 골격 |
| IPA/발음 | Clinical Language | `speakText`/`.speak-btn`/`ttsSpeed` |
| 녹음/재생 | Clinical Language | `MediaRecorder`(`start(200)`+`requestData()`), Cloudinary 업로드 |
| CPX 문진 문장 | CPX/OSCE | 문장 카드 + TTS |
| CPX 증례 | CPX/OSCE | 드로어 골격 |
| OSCE 술기 | CPX/OSCE | 체크리스트형 카드 |
| 환자 설명 문장 | CPX/OSCE | 문장 카드 + TTS |
| (진료실 대화 시뮬레이션) | CPX/OSCE | 소스 확인 후 후보 여부 판단 |

### 7.2 1차 분석 제외 대상 (Medical Note 코어 기준 유지 · Language-main 참고자료로만)
아래는 **식별·이식·흡수 어느 것도 하지 않는다.** Medical Note에 이미 있는 시스템 코어를 그대로 쓴다.
- Language-main의 별도 **Supabase 설정**
- Language-main의 별도 **백업/복원 구조**
- Language-main의 별도 **연구노트 구조**
- Language-main의 별도 **TSA/RFC3161 구조**
- Language-main의 별도 **`.claude/skills`**
- Language-main의 **`AGENTS.md`**
- Language-main의 별도 **테마 / AI 설정 / device_id 체계**

### 7.3 절대 원칙
- Language-main `index.html`을 **그대로 복사 붙여넣기 금지**.
- 이식 후보 기능은 Medical Note 모듈로 재구현하되 **시스템 코어(저장·동기화·해시·TSA·백업·테마·AI·device_id)는 Medical Note 것만** 사용.
- 이번 1차엔 **실제 이식 금지** — 후보 식별·shell 설계까지만.

---

## 8. 단계별 Migration Plan

| 단계 | 내용 | 이번 1차 산출물 | 코드 변경 |
|---|---|---|---|
| 1 | 현재 구조 분석 | §1 (완료) | 없음 |
| 2 | 기존→새 구조트리 매핑 | §2 (완료) | 없음 |
| 3 | 위험도 평가 | §5 (완료) | 없음 |
| 4 | 단일 HTML 내부 구획 주석 설계 | §6 (설계 완료) | (다음) 주석 배너만 |
| 5 | KBG namespace 도입 계획 | §3 (완료) | (다음) additive 객체 |
| 6 | 빈 메뉴 shell 설계 | §2 Dashboard/Language/CPX 뷰 | (다음) shell DOM |
| 7 | 기존 기능을 새 메뉴에서 "연결" | `AppRouter`가 기존 함수 호출 | (다음) 라우터 |
| 8 | Clinical Language 빈 모듈 설계 | §7.1 | (미래) |
| 9 | CPX/OSCE 빈 모듈 설계 | §7.1 | (미래) |
| 10 | Unified Search 설계 | 기존 검색 확장 대상 명시 | (미래) |
| 11 | Review Engine 통합 설계 | 퀴즈/플래시/SRS 단일 진입 | (미래) |
| 12 | Data Mgmt & Evidence 보호 계획 | §5 매우높음 항목 🔴 | 보호(변경 0) |
| 13 | Language-main 이식 전 점검표 | §7 + §10 아래 | 없음 |
| 14 | 백업/복원 호환성 검증 계획 | §11 | 없음 |
| 15 | test/golden test 확장 후보 | §11 | 없음 |

**진행 규칙:** 4→5→6→7 순서로만 진행하고 각 단계 후 `check-index-scripts`+`golden-tests` 통과 확인. 기능 구현을 구조 분석/plan보다 먼저 하지 않는다(금지 사항).

---

## 9. 절대 건드리면 안 되는 기능 목록 (🔴 Freeze)

- `index.html` 전체 재작성 / 프레임워크 전환 / Language-main 단순 복붙.
- 기존 localStorage key(§1.4), IndexedDB store(`LOCAL_CACHE_STORE`), Supabase 스키마(7테이블), Cloudinary 설정.
- 백업/복원 포맷 호환성(`applyPendingDataImport`, 미리보기=적용).
- 연구노트(`rn*`) 삭제/단순화, `_rnComputeHash` 해시체인, ECDSA 서명, TSA/RFC3161, `RN_PROJECT_NAME` 격리 — **CRITICAL ZONE, append-only, 정정 엔트리만**.
- 기존 DOM id 대규모 rename, 기존 inline 이벤트 핸들러 구조 대변경.
- 동일 의학 개념 다중 카테고리 중복 저장, 플래시카드 이중 관리.
- 정확명 심볼(§3.3) namespace 이동, 기존 test/golden test 무시한 리팩토링.
- 동기화 3모드 혼용(일반 동기화 ≠ 최종본 덮어쓰기).

---

## 10. 다음 단계 실제 수정 파일/구역 (범위 최소화)

> **구현 상태(v2.34):** 아래 shell 계층을 additive로 실제 구현 완료 — 헤더 `🏠 플랫폼` 버튼 + 좌측 사이드바 8개 방 오버레이(`KBG_MedicalNote` namespace). 6개 방은 기존 함수로 연결, Dashboard는 실데이터, Clinical Language·CPX/OSCE는 빈 방. CI(check-index/golden/version-bump/schema-drift/restore-drift) 전부 통과 + 브라우저 동작 검증(8방 렌더·라우팅·닫기·dispatch·양 화면폭 가로스크롤 없음). 기존 로직/DOM/저장/동기화/해시/TSA 무변경.


| 파일 | 구역 | 변경 유형 | 검증 |
|---|---|---|---|
| `index.html` | 신규 `<script>` 블록(15 App Init 앞) | `KBG_MedicalNote` additive 객체(§3.2) | check-index-scripts |
| `index.html` | 각 구획 상단 | 주석 배너(§6.2), 이동 없음 | 블록수·`</html>` |
| `index.html` | `<body>` 하단 | 신규 shell DOM(`kbg-` prefix id), display:none 기본 | golden-tests |
| `index.html` | `AppRouter` | 8메뉴→기존 `switchTab`/`setLibraryMode` 호출 매핑 | 수동 UI(양테마·3화면폭) |
| `docs/` | (본 문서) | 계획/로그 | check-skill-docs |

**하지 않을 것:** 5개 도메인 테이블·동기화·해시·백업 로직, 기존 함수 rename. Language-main 실제 이식.

---

## 11. test / golden test 확인 및 확장 후보

### 11.1 현행 자동 게이트(변경 후 필수 실행)
```
node scripts/check-index-scripts.mjs
node scripts/golden-tests.mjs
node scripts/check-schema-drift.mjs
node scripts/check-restore-drift.mjs
```
CI: `index-scripts-check.yml`, `research-manifest.yml`, `skill-docs-check.yml`, `instruction-doc-sync.yml`.

### 11.2 확장 후보
1. **namespace 존재 검사** — `check-index-scripts` 필수 심볼에 `KBG_MedicalNote`·`init` 추가(도입 후).
2. **AppRouter 매핑 golden** — 8개 메뉴 키가 유효 핸들러로 라우팅되는지 순수함수 테스트.
3. **canonical entity 무중복 golden** — 태그 사전 유효값 검증, 동일 도메인 중복 방지 헬퍼.
4. **백업 라운드트립 확장** — 새 도메인 추가 시 `check-restore-drift`에 필드 등록(이식 단계).
5. **연구노트 매니페스트 불변** — 기존 `build-research-manifest` 그대로 유지, 회귀 감시.
6. **수동 UI(사용자 실기기):** 다크/라이트 2테마 × 모바일(≤600)/태블릿(≤1100)/데스크톱 3화면폭에서 신규 shell 가로스크롤 없음·닫기버튼 가시성(code-review §6).

---

## 12. 연구노트에 남길 작업 로그 초안

> ⚠️ 아래는 **연구노트에 append할 초안 텍스트**일 뿐, 실제 기록은 앱의 `rnOpenForm`을 통해 해시체인·서명·TSA와 함께 남긴다(문서만으로는 증거화 미완 — 원칙 #6).

- **[착상]** Medical Note를 "Dr. Bugeon Medical Note Platform"으로 확장. 어학앱(Language-main)을 본체(Medical Note)에 흡수 통합. 단일 HTML 유지.
- **[방향결정]** (1) 저장/동기화/해시/TSA 코어 = Medical Note 단일화 (2) 신규 코드에 `KBG_MedicalNote` namespace (3) canonical entity + 태그 뷰로 중복 저장 방지 (4) 새 8메뉴는 라우팅/뷰 계층(저장소 아님).
- **[코드 기여]** 1차: 구조 분석·매핑·위험평가·migration plan 문서화(`docs/KBG_MedicalNote_통합_1차_구조안정화.md`). 코드 변경 0.
- **[코드 리뷰 관점]** CI 정확명 심볼 추출 제약 발견 → 기존 함수 namespace 이동 금지 확정. 동기화 3모드·해시체인 CRITICAL ZONE 재확인.
- **[검증 로그]** 문서 단계 — index.html 로직 미변경, 기존 CI 게이트 영향 없음.
- **[변경 이력]** APP_INFO 미변경(문서 전용). 다음 단계에서 namespace 도입 시 버전 +0.01 + UPDATE_HISTORY 추가 예정.
- **[해시체인/TSA]** 이번 단계 연구노트 기록 시 기존 체인에 append(정정 아님, 신규 착상 엔트리). 기존 엔트리 무변경.

---

### 성공 기준 자체점검
- [x] 기존 기능 삭제 없음 (문서 전용)
- [x] 데이터 호환성 유지 (스키마·키·포맷 무변경)
- [x] 백업/복원 가능성 보존
- [x] 연구노트/해시체인/TSA 보존 (읽기·계획만)
- [x] 단일 HTML 유지
- [x] 신규 구조에 `KBG_MedicalNote` namespace 전략 반영
- [x] Language-main 이식 전 위험 요소 파악(§7, §5)
- [x] 다음 단계 코드 수정 범위 최소화(§10)
