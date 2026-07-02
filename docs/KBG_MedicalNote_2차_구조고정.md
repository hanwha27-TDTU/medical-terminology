# KBG_MedicalNote — 2차 구조 안정화 (기준 정보구조 고정)

> **성격:** 기능 추가가 아니라, 완성된 8-룸 구조트리를 **Medical-Note-main의 기준(canonical) 정보구조로 고정**하고, 기존 기능을 그 위에 안전하게 재배치·연결하기 위한 2차 구조 안정화. **문서 중심 · index.html 코드 무변경.**
> **기준 버전:** v2.35 (2026-07-02) · 단일 `index.html` 유지.
> **선행:** `KBG_MedicalNote_통합_1차_구조안정화.md`(1차 분석) · v2.34(플랫폼 셸 구현) · v2.35(연구노트 v2.0 보강).
> **원칙 재확認:** 기존 기능/데이터/localStorage/IndexedDB/Supabase/Cloudinary/백업·복원/연구노트/해시체인/TSA 삭제·단순화 금지 · DOM id·핸들러 대규모 rename 금지 · 실제 이동보다 "참조·연결" 우선 · 신규 명명은 `KBG_MedicalNote` namespace · Language-main 미이식·미참조.

---

## 1. 확정 구조트리 (기준 정보구조 · FROZEN)

이 트리를 **기준 정보구조로 고정**한다. 이후 모든 재배치·연결·이식은 이 트리를 기준으로 한다.

```
KBG Medical Note Platform
├─ 1. Dashboard              오늘의 복습 · 최근 학습 · 미완성 노트 · 오답/취약 · 연구노트 최근 로그
├─ 2. Medical Core           의학용어 · 해부·생리 · 약물 · 미생물 · 질환 · 검사/수치 · 공식/계산 · 개념·오답노트
├─ 3. Clinical Language      일반회화 · 의학문장 · 단어장 · 회화프레임 · IPA/발음 · 녹음/재생   [빈 방]
├─ 4. CPX / OSCE             CPX문진 · CPX증례 · OSCE술기 · 환자설명 · 진료실대화              [빈 방]
├─ 5. Review Engine          전체랜덤복습(플래시카드) · 의학/언어/CPX·OSCE/오답 카드 · Anki/TSV
├─ 6. Unified Search         전체 · 의학 · 언어 · CPX·OSCE · 연결노트 · 연결 시각화
├─ 7. Data Management        가져오기 · 내보내기 · 백업 · 복원 · Supabase 동기화 · 미디어/이미지  [보호]
└─ 8. Evidence/Research Note 착상·방향결정·코드기여·리뷰·검증로그·변경이력·해시체인·TSA/RFC3161  [보호]
```

- **구현 상태:** 8개 방은 v2.34에서 좌측 사이드바 오버레이(`KBG_MedicalNote.AppRouter`)로 이미 존재. 6개 방은 기존 기능 연결, Dashboard 실데이터, Clinical Language·CPX/OSCE는 빈 방.
- **기준 원칙:** 방 = **뷰/라우팅 계층**이다(저장소 아님). 데이터는 기존 7 테이블 그대로.

---

## 2. 기존 기능 → 새 구조트리 매핑표

> "실제 이동 필요"는 **전부 '아니오 — 참조·연결'** 이 기준(원칙 4). v2.34 라우터가 이미 대부분 연결함.

| 기존 기능 | 현재 위치 | 관련 함수 | 관련 DOM id | 저장소 key/출처 | 새 구조트리 위치 | 실제 이동 필요 | 위험도 | 비고 |
|---|---|---|---|---|---|---|---|---|
| 통합 검색(홈) | 헤더 검색행 | `goSearchHome`, `clearSearch` | `searchInput`,`acList`,`sourceSearchInput` | 전 도메인(메모리) | Unified Search | 아니오(연결됨) | 낮음 | v2.34 `_dispatch('goSearchHome')` |
| 일반용어 | 라이브러리 | `setLibraryMode('terms')`,`applyFilters` | `termList`,`libraryModeTermsBtn` | `kma_medical_terms_v2_terms` | Medical Core>의학용어 | 아니오 | 낮음 | |
| 미생물 | 라이브러리 | `setLibraryMode('microbes')` | `microbeFrame` | `_microbes` | Medical Core>미생물 | 아니오 | 낮음 | |
| 약물 | 라이브러리 | `setLibraryMode('drugs')` | `drugFrame` | `_drugs` | Medical Core>약물 | 아니오 | 낮음 | |
| 공식 | 라이브러리 | `setLibraryMode('formulas')` | `formulaFrame` | `_formulas` | Medical Core>공식/계산 | 아니오 | 낮음 | |
| 질환(목록/목차/트리) | 라이브러리 | `setLibraryMode('diseases')`,`renderDiseaseTocHtml`,`showDiseaseSubtypeTree` | `diseaseFrame`,`diseaseDrawer` | `_diseases` | Medical Core>질환 | 아니오 | 중간 | parent_id 계층 유지 |
| 개념·오답노트 | 라이브러리 | `setLibraryMode('notes')`,`openIntegratedNoteModal` | `integratedNoteModal` 등 | `dr_bugeon_integrated_notes_v1` | Medical Core>개념·오답노트 | 아니오 | 중간 | Review와 중복관리 금지 |
| 해부·생리 / 검사·수치 | (없음·뷰만) | (신규 태그 필터) | — | `medical_terms.concept_category/system_tags` | Medical Core>해부·생리 / 검사·수치 | **아니오(태그 뷰)** | 중간 | 새 테이블 금지(§7) |
| 즐겨찾기 필터 | 하단내비 | `switchTab('bookmark')`,`setFilter('즐겨찾기')` | `filterBookmarkBtn` | 학습상태 | Medical Core(필터)+Dashboard | 아니오 | 낮음 | |
| 퀴즈 | 하단내비 | `showQuizSetup` | — | 학습상태 | Review Engine | 아니오(연결됨) | 낮음 | v2.34 연결 |
| **플래시카드** | 퀴즈 인접 | `buildFlashcardPool`,`showFlashcards`,`renderFlashcard` | — | 전 도메인+학습상태 | **Review Engine**(§5) | 아니오 | 낮음 | Medical Core 중복 금지 |
| SRS 복습 | (내부) | `getLearningStateMap`(due_at) | — | `_learning` | Review Engine + Dashboard(오늘의 복습) | 아니오 | 낮음 | |
| 데이터 관리(가져오기/내보내기/백업) | 하단내비 | `showExportMenu`,`createCompleteBackupObject`,`readDataImportFile`,`applyPendingDataImport`,`mergeDomainFavoritesImport` | — | 전 도메인 | Data Management | 아니오(연결됨) | **높음** | 포맷 보호(§8) |
| 최종상태 저장/동기화 | 헤더 | `saveCurrentStateToCloud`,`sbPushAll`,`pullFromCloud`,`syncWithCloud` | — | 전 테이블+`language_sync_meta` | Data Management | 아니오 | **매우 높음** | 🔴 모드 혼용 금지(§8) |
| 저장본 버전 확인 | 헤더 | `showSavedVersionInfo` | — | canonical 메타 | Data Management | 아니오(연결됨) | 중간 | |
| Cloudinary 이미지 | (노트) | `uploadImageToCloudinary`,`deleteImageFromCloudinary`,`cloudinaryThumb` | — | `kma_cloudinary_config` | Data Management>미디어 | 아니오 | 높음 | 🔴 Edge Function 보호(§8) |
| 외부 의학검색 | 하단내비 | `showExternalMedicalSearchModal`,`openKmaTermSearch`,`searchUMLSFromInput` | — | 외부 API | Unified Search(외부) | 아니오 | 낮음 | |
| 분류별 통계 | 헤더 | `showCategoryStats` | — | 전 도메인 | Dashboard | 아니오 | 낮음 | |
| AI/Supabase 설정 | 헤더 | `showAISettings` | — | `_ai_config`,`kma_supabase_config` | Data Management(설정) | 아니오 | 중간 | 키 저장 보호 |
| 개발자 정보/이력 | 헤더 | `showDeveloperInfo` | `developerInfoModal` | `APP_INFO`,`UPDATE_HISTORY` | Evidence(개발자) | 아니오 | 낮음 | |
| 연구노트 | 개발자패널 | `rnOpenNotebook`,`rn*`,`rnAnalyzeNotebook` | `researchNoteModal` | `drbugeon_research_notes`,`research_notes_med` | Evidence/Research Note | 아니오(연결됨) | **매우 높음** | 🔴 append-only(§8) |
| 가이드/사이트 | 하단내비 | `showGuide`,`showUsefulSitesModal` | — | 정적 | (유틸리티 · Dashboard 보조) | 아니오 | 낮음 | 8룸 외 유틸 |

---

## 3. 단일 HTML 내부 구획 설계안 (주석 구획 ↔ 현재 위치)

> **즉시 대규모 이동 금지.** 아래는 "구획 정의 + 현재 코드가 어디 속하는지" 매핑. 실제 배너 주석 삽입은 산출물 9(최소 범위)로 승인 후.

| 구획 | 현재 위치(대략) | 성격 | 이동 |
|---|---|---|---|
| 0. KBG Metadata | `APP_INFO`/`UPDATE_HISTORY`(index.html:~18718) | 기존 | 배너만(추후) |
| 1. CSS Design System | `<head>` CSS 3블록 + `#kbgPlatformStyles` | 기존+신규 | 유지 |
| 2. HTML App Shell | `<header>`~`.bottom-nav` + `#kbgPlatformOverlay` | 기존+신규 | 유지 |
| 3. HTML Templates | 각 모달/드로어/폼 markup | 기존 | 유지 |
| 4. AppConfig | 모델 프리셋 등 상수 + `KBG_MedicalNote.AppConfig.rooms` | 기존+신규 | 신규만 namespaced |
| 5. AppSchema | `DISEASE_SECTIONS`, 정규화 스키마 (+신규 canonical 태그사전 후보) | 기존+신규 | 유지 |
| 6. AppStore | `TERMS/DRUGS/...` 전역 배열, IDB 래퍼 + `KBG_MedicalNote.AppStore` | 기존+신규 | 미이동 |
| 7. AppServices | `sb*`,`rn*`,Cloudinary,해시 | 기존 | 🔴 미이동 |
| 8. AppUI | `render*Frame`,`setFilter` + `KBG_MedicalNote.AppUI.room*` | 기존+신규 | 유지 |
| 9. AppModules | (빈) Clinical Language / CPX·OSCE | 신규 | placeholder |
| 10. AppRouter | `switchTab`/`setLibraryMode` + `KBG_MedicalNote.AppRouter` | 기존+신규 | 신규가 기존 호출 |
| 11. AppMigration | (신규) 단계 가드 | 신규 | 신규 |
| 12. AppEvidence | `rn*` 연결 + `rnAnalyzeNotebook`/`rnQualityCheck` | 기존+신규 | 🔴 미이동 |
| 13. AppResearchLog | `rnRenderList`/`_rnMd` 어댑터 | 기존 | 어댑터만 |
| 14. Backup/Sync/Cloudinary Protection | 백업·동기화·이미지삭제·해시·TSA | 기존 | 🔴 보호(§8) |
| 15. App Init | 앱 부트스트랩 + `KBG_MedicalNote.init()` | 기존+신규 | 유지 |

---

## 4. "KBG_MedicalNote" namespace 적용 후보 (신규 코드 전용)

**적용(신규):** 플랫폼 셸(구현됨: `AppConfig/AppStore/AppRouter/AppUI`) · 향후 `AppModules.clinicalLanguage`·`AppModules.cpxOsce` · `AppSchema` canonical 태그사전 · Dashboard 위젯 · `AppMigration` 단계 가드 · `AppEvidence` 분석 어댑터.

**🔴 적용 금지(기존·CI 정확명 보호 — `check-index-scripts`/`golden-tests`가 이름으로 추출):**
`sbPushAll`,`pullFromCloud`,`syncWithCloud`,`pickSyncWinner`,`filterLocalRowsAfterCanonicalFence`,`normalizeIntegratedNote`,`sanitizeNoteHtml`,`noteToRow`,`_rnComputeHash`,`stableForHash`,`rnVerifyChain`,`_rnIsOwnProject`,`RN_PROJECT_NAME`,`RESEARCH_NOTES_TABLE`,`canonicalDiseaseHashPayload`,`computeSchemaDrift`,`checkLiveSchema`,`applyPendingDataImport`,`createCompleteBackupObject`,`readDataImportFile`,`mergeDomainFavoritesImport`,`setLibraryMode`,`applyFilters`,`renderFilterControls`,`showAddTermModal`,`openIntegratedNoteModal`,`renderDiseaseFrame`,`buildFlashcardPool`,`showFlashcards`,`renderFlashcard` → **이동/rename 시 CI 즉시 실패.**

---

## 5. 빈 shell / placeholder 생성 후보

| 영역 | 상태 | 조치 |
|---|---|---|
| Clinical Language | v2.34 빈 방(칩 6종) | 유지 — 어학 소스 후 채움 |
| CPX / OSCE | v2.34 빈 방(칩 5종) | 유지 — 어학 소스 후 채움 |
| Unified Search 확장 | 부분(전체검색만 연결) | 언어 검색·CPX/OSCE 검색·연결 시각화 = placeholder |
| Review Engine 확장 | 부분(플래시/퀴즈 연결) | 언어 카드·CPX/OSCE 카드·Anki/TSV = placeholder |
| Dashboard 확장 | 실데이터 일부 | 오늘의 추천 복습·학습 목표·연속일 = placeholder(어학 후) |

**원칙:** 빈 shell을 만든다고 기존 기능을 삭제/대체하지 않는다. placeholder는 "이식 예정" 안내만.

---

## 6. Review Engine으로 이동(귀속)해야 할 기능

문서상 **Review Engine 소속으로 확정**(코드 이동 아님, 귀속·중복관리 금지):
- **플래시카드**: `buildFlashcardPool`/`showFlashcards`/`renderFlashcard` — 전 도메인 랜덤 능동 회상.
- **퀴즈**: `showQuizSetup`.
- **SRS 복습 스케줄**: `getLearningStateMap`(due_at) — Dashboard "오늘의 복습"과 데이터 공유(단일 출처).
- **오답 카드**: 노트 `noteType='wrong'` + 학습상태 `wrong_count`.

**금지:** Medical Core 안에서 플래시카드를 **중복 관리하지 않는다.** Medical Core는 자료 열람/편집, Review Engine은 능동 회상 — 같은 데이터의 다른 뷰.

---

## 7. canonical entity 적용 기준

**원칙:** 하나의 의학 개념 = 하나의 canonical entity(한 행)로만 저장. 여러 메뉴 노출은 `primaryCategory`/`subCategory`/`tags`/`linkedConcepts`로 처리. **동일 도메인 내 중복 행·중복 카드·중복 카드 생성 금지.**

**기존 스키마 매핑(신규 필드 병렬 생성 금지):**
| 개념 필드 | 기존 컬럼 | 
|---|---|
| `primaryCategory` | `medical_terms.concept_category` |
| `subCategory` | `medical_terms.category` |
| `tags` | `medical_terms.system_tags (jsonb)` |
| `linkedConcepts` | 노트 `linked*` / `system_tags` 관례 |

**예시 (기준):**
- **심방(atrium)**: primaryCategory=`anatomy_physiology`, tags=`[general_medical_term, anatomy, cardiovascular]` → "의학용어"+"해부·생리" 메뉴에 태그로 노출(중복 저장 X).
- **폐렴(pneumonia)**: primaryCategory=`disease`, tags=`[respiratory, infection, cpx_common_case]` → "질환"+(향후)"CPX 흔한 증례"에 노출.
- **아목시실린(amoxicillin)**: primaryCategory=`drug`, tags=`[antibiotic, beta_lactam]`.

**주의(v1.50 교훈):** 태그 표준화 같은 업로드 전용 변환은 `normalize*ForStorage`에 넣지 말 것(기존 데이터 일괄 변경됨). 기존 데이터 소급 재분류는 하지 않는다.

---

## 8. Data Management / Evidence 보호 대상 (이번 단계 코드 변경 금지 🔴)

| 보호 대상 | 관련 함수/자원 | 규칙 |
|---|---|---|
| 백업 | `createCompleteBackupObject` | 포맷 불변 |
| 복원 | `readDataImportFile`,`applyPendingDataImport`(append/merge/replace),`mergeDomainFavoritesImport` | 미리보기=적용, 격리 필터 유지 |
| export/import 포맷 | JSON/xlsx/csv/TSV | 스키마 불변(`check-restore-drift`) |
| Supabase 동기화 | `sbPushAll`/`pullFromCloud`/`syncWithCloud`,`saveCurrentStateToCloud`,`pickSyncWinner`,fence | 3모드 혼용 금지 |
| canonical 메타 | `language_sync_meta`,`sbSetCanonicalSnapshotMeta`,해시 페이로드 | 불변조건 9/11 |
| Cloudinary/이미지 | `uploadImageToCloudinary`,`deleteImageFromCloudinary`,`cloudinaryThumb`,Edge Function | URL만 저장, 보호집합(불변조건 12) |
| 연구노트 | `rn*`,`rnAddEntry`,`_rnLoad`,`RN_PROJECT_NAME`,`research_notes_med` | append-only, 격리, 정정만 |
| 해시체인 | `_rnComputeHash`,`stableForHash`,제외목록 | 🔴 CRITICAL ZONE — 변경 금지(불변조건 19) |
| TSA/RFC3161 | `_rnRequestTsa`,`_rnAttachTsa`,Edge Function 릴레이 | 사후부착 해시 제외 유지 |

---

## 9. 실제 코드 수정이 필요한 최소 범위 (다음 단계 · 승인 후)

이번 문서 단계는 **코드 0**. 다음 단계에서 아래만 additive로:
1. **주석 구획 배너 14개 삽입** — §3 구획명을 `/* ===== N. ... ===== */`로. (이동 없음, 주석만. `check-index-scripts` 통과)
2. **canonical 태그사전** — `KBG_MedicalNote.AppSchema`에 `primaryCategory` 허용값·표준 태그 상수(신규, 기존 데이터 미변경).
3. **(선택) Dashboard 위젯 보강** — 오늘의 추천 복습/연속일을 기존 학습상태로 읽기 전용 표시.
- **하지 않음:** 7 도메인/동기화/해시/백업/Cloudinary 로직, 기존 함수 rename, 기존 DOM id 변경, Language 이식.
- **검증:** 매 변경 `check-index-scripts`+`golden-tests`+`version-bump` + 실기기 UI(양테마·3화면폭).

---

## 10. 다음 단계 — Language-main/index.html 분석 시 볼 기능 목록

> 소스 확보 후 `KBG_MedicalNote_Language이식후보_분석틀.md`의 빈칸을 채울 때 **찾을 대상**.

**볼 것(사용자 학습기능만):** 일반회화·의학문장·단어장·회화프레임의 데이터 구조/렌더 함수/DOM id/저장키 · IPA/발음(TTS 사용법) · 녹음/재생(`MediaRecorder` 패턴·업로드) · CPX 문진·증례 · OSCE 술기 · 환자 설명 문장 · 진료실 대화 시뮬레이션. 각 기능의 (함수, DOM id, 데이터 스키마, 저장 방식).

**보지 않을 것(시스템 계층 — Medical Note 코어 유지):** Language-main의 별도 Supabase/백업·복원/연구노트/TSA/`.claude·skills`/`AGENTS.md`/테마·AI·device_id. → 이식 후보 기능만 뽑고, 시스템은 전부 Medical Note 것 재사용.

---

### 성공 기준 자체점검
- [x] 구조트리를 기준 정보구조로 고정(§1)
- [x] 기존 기능 매핑(실제 이동=아니오·연결)(§2)
- [x] 단일 HTML 구획 설계(이동 없이)(§3)
- [x] namespace 후보 + CI 보호 목록(§4)
- [x] 빈 shell/placeholder(§5) · 플래시카드=Review Engine(§6)
- [x] canonical entity 기준 3예시(§7) · 보호모듈(§8)
- [x] 최소 수정 범위(§9) · 다음 관찰목록(§10)
- [x] index.html 코드 무변경 · 기존 기능·데이터·연구노트·해시·TSA 보존
