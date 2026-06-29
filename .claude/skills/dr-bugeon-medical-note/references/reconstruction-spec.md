# Dr. Bugeon Medical Note — 복원용 설계 명세서 (Reconstruction Spec)

> 목적: **이 앱의 HTML이 전부 사라져도, 이 문서 + 동봉 SQL만으로 동일한 앱을 다시 만들 수 있게** 핵심 개념·데이터모델·저장/복원·동기화 규칙·함정을 기록한다.
> 기준 버전: v4.52 (2026-06-26) · 동봉 파일: `medical_note_supabase_schema.sql` (Supabase 전체 스키마 원문)
> 앱 본체: 단일 HTML 파일 (`Dr_Bugeon_Medical_Note_v2.html`)
> **2026-06-29 갱신:** 로직 전수감사 결과를 §3.5·§3.7·§5.3·§5.5·§5.7·§6.1·§6.3·§7·§10에 불변조건/주의문구로 반영(아래 ⚠️AUDIT 표식). 재구축 시 이 항목들을 그대로 지켜야 동일 결함이 재발하지 않는다.

---

## 0. 한 줄 요약

순수 프런트엔드(단일 HTML, 빌드/서버 없음) 의학 학습 노트. **로컬 우선(offline-first)**: 모든 데이터는 브라우저(IndexedDB+localStorage)에 살고, **Supabase(Postgres REST)** 를 "기준본(canonical) 클라우드"로 써서 PC·모바일·태블릿을 동기화한다. 이미지는 **Cloudinary** 가 저장한다.

---

## 1. 아키텍처 큰 그림

```
┌───────────────────────── 단일 HTML 파일 ─────────────────────────┐
│  UI (Vanilla JS, 프레임워크 없음)                                  │
│   ├ 7개 도메인 라이브러리 뷰 + 검색/퀴즈/북마크                      │
│   ├ 단권화 노트(개념/오답) 편집·열람                                │
│   └ 설정·동기화·개발자 정보 모달                                    │
│  데이터 레이어                                                     │
│   ├ IndexedDB  ← 대용량 배열(용어/약물/공식/미생물/노트)            │
│   └ localStorage ← 설정·메타·tombstone·기기ID·동기화메타           │
│  동기화 레이어 (fetch → Supabase REST /rest/v1/…)                  │
└────────────────────────────────────────────────────────────────┘
            │ REST(upsert/patch)                  │ unsigned upload
            ▼                                     ▼
   ┌─────────────────┐                   ┌──────────────────┐
   │ Supabase Postgres│                   │   Cloudinary     │
   │ 7개 테이블        │                   │ 이미지 원본+CDN   │
   │ + canonical meta │                   │ (URL만 DB에 저장) │
   └─────────────────┘                   └──────────────────┘
                                          ▲ destroy(서명)
                                   Supabase Edge Function
                                   (delete-cloudinary-image)
```

핵심 원칙 4가지
1. **로컬이 1차 저장소.** 네트워크 실패해도 앱은 동작한다(모든 동기화 호출은 try/catch + 무해 실패).
2. **클라우드는 "기준본(canonical)".** "최종상태 저장"으로 한 기기가 기준본을 만들고, 다른 기기는 그 기준본으로 맞춘다.
3. **삭제는 소프트삭제(tombstone).** 절대 hard delete 안 함 → 기기 간 "부활" 방지.
4. **이미지 바이트는 DB에 넣지 않는다.** Cloudinary URL 문자열만 노트에 저장 → 동기화 가볍게 유지.

---

## 2. 기술 스택 / 구조

- **런타임:** 브라우저 1개 파일. `<head>`에 CSS 3블록, `<body>` 끝에 `<script>` 4블록.
- **외부 의존:** Google Fonts, cdnjs의 `xlsx`(엑셀 import/export)만. 그 외 전부 인라인 Vanilla JS.
- **저장:** IndexedDB(대용량) + localStorage(소형). 서버 없음.
- **클라우드:** Supabase REST(사용자가 URL+anon키 입력) / Cloudinary(unsigned upload preset).
- **언어 데이터:** 한국어·영어·우즈베크어 3개국어 필드.
- **빌드/번들 없음.** 파일을 브라우저로 열면 그대로 실행. 배포는 파일 공유.

> 왜 단일 파일인가: 의대생이 USB/메신저로 주고받고, 오프라인에서도 쓰기 위함. 단점은 파일 하나 분실 = 코드 전체 분실(→ 이 문서의 존재 이유).

---

## 3. 도메인 모델 (7 도메인)

데이터는 7종. 모두 **숫자 `id`(bigint) PK + `created_at`/`updated_at`/`deleted_at`** 공통.
1~4번(용어·약물·공식·미생물)은 **정규 컬럼형** 테이블, 5번(주요 질환)은 **하이브리드형**(핵심 플랫 컬럼 + `body jsonb`), 6번(노트)은 **JSONB형**(`data` 컬럼에 객체 통째 저장), 7번 학습상태는 별도.

각 테이블의 정확한 컬럼은 동봉 `medical_note_supabase_schema.sql` 참조. 요약:

### 3.1 medical_terms (의학용어)
`id, ko, en, uz, category, concept_category, system_tags(jsonb[]), def_ko, def_en, def_uz, usmle, ipa, refs(jsonb[]), icd11(jsonb), fda_drug(jsonb), rxclass_atc(jsonb), trials(jsonb), created_at, updated_at, deleted_at`
- 3개국어 명칭+정의, USMLE 포인트, 발음(ipa), 외부코드(ICD-11/FDA/RxClass/trials) 캐시.

### 3.2 medical_drugs (약물)
`id, generic_name, ko_name, brand_name, drug_class, same_class_drugs, drug_form, atc_class, target, route, concept_category, category, system_tags, usmle_yield, ipa, definition_ko/en/uz, causal_chain, why, moa, clinical_uses, adverse_effects, precautions, usmle_strategy, memory_line, refs, ts…`
- 작용기전(moa)·인과사슬(causal_chain)·임상사용·부작용·USMLE 전략·암기라인.
- ⚠️AUDIT: 상품명(`brand_name`)은 **신규 추가 폼에서 입력칸을 뺀** 상태다(편집 폼에는 있음). 따라서 추가 제출 로직(`submitAddDrug`)이 존재하지 않는 `add_drug_brand` 입력을 읽으면 안 된다 — 읽으면 항상 빈 값이 되고 API 보강 fallback도 무력화된다. 추가 시 brand는 비워두고 저장/백업 호환 구조만 유지한다.

### 3.3 medical_formulas (의학계산공식)
`id, name, short_name, formula, category, system, use_case, variables, normal_range, interpretation, example, memory_tip, usmle_trap, tags(jsonb[]), ts…`

### 3.4 medical_microbes (미생물)
`id, organism, ko_name, latin_name, ipa, microbe_type, gram_stain, shape, oxygen, genome, virulence, diseases, diagnosis, treatment, prevention, usmle_clues, memory_line, category, system_tags, refs, ts…`

### 3.5 medical_diseases (주요 질환, v4.55+) — **하이브리드형(플랫 + body jsonb)**
플랫 컬럼: `id, ko_name, en_name, uz_name, ipa, concept_category('Disease / Syndrome'), category(System), one_line_summary, acuity, emergency, progression, contagious, system_tags(jsonb), refs(jsonb), body(jsonb), ts…`
- `body jsonb` 하나에 12개 임상 섹션 전체(정의·원인·병태생리·증상/징후·검사/진단·치료·경과·합병증·감별진단·USMLE/KMLE + profile)를 구조화 저장.
- 섹션/필드는 코드의 **`DISEASE_SECTIONS` 스키마 1곳**으로 정의되고, normalize·추가/편집 폼·드로어 아코디언·CSV 내보내기·통합검색·노트 자동링크가 **모두 이 스키마를 공유**한다 → 섹션 추가 시 SQL/컬럼 변경 없이 스키마만 수정. 미생물 도메인을 1:1 템플릿으로 복제해 추가됨.
- 섹션은 두 종류: 기본은 `type:'fields'`(평면 필드맵 `body[sec]={k:val}`). **`type:'rows'`**(v4.57+)는 반복 행 배열 `body[sec]=[{...}]`로, 행마다 `rowFields`(select/text) 입력. 현재 rows 타입 3개: **`cause`**(분류·역할·중요도·세부), **`red_flags`**, **`diagnosis(검사/진단)`**(v4.71 개편). diagnosis 행 = `item`(드롭다운 `DISEASE_DX_ITEMS`: 가장 먼저 할 검사·확진검사·영상·조직/생검·진단 기준 등) + `method`(검사방법) + `usmle`(USMLE 핵심), **`seed:['가장 먼저 할 검사','확진 검사 (gold standard)']`** 2행이 신규 추가 시 기본 골격으로 자동 렌더(폼 sectionHtml의 seed 분기). 구버전 평면 diagnosis 객체(initial_tests/imaging/criteria…)는 로드 시 `DISEASE_DX_LEGACY_LABEL`로 행 마이그레이션. **(v4.71에 정적 "유형별 검사/진단 골격 삽입" 템플릿 `applyDiseaseTypeTemplate`은 제거됨 — 행 구조로 대체.)** rows 소비처는 6곳 모두 분기 필요: `normalizeDiseaseBody`(+구버전 평면→행 마이그레이션, cause는 `migrateLegacyCauseToRows`)·`diseaseBodyText`·드로어 아코디언(표 렌더)·폼 `sectionHtml`(+`diseaseRowHtml`/`addDiseaseRow`/`readDiseaseRowSection`)·`upsertDiseaseFromForm`·`diseaseExportRows`.
  - ⚠️AUDIT(seed): **seed 행은 "신규 추가" 폼에서만 렌더해야 한다.** `!initial.length` 조건만으로 seed를 주입하면, 진단 섹션이 빈 *기존* 질환을 편집할 때도 seed 2행이 들어가고 — `item`이 `DISEASE_DX_ITEMS`의 실제 옵션 값이라 `readDiseaseRowSection`의 "전부 빈 행 제거" 필터를 통과 — 저장 시 유령 진단행 2개가 매 편집마다 누적된다. seed 분기에 add/edit 구분 가드(예: prefix가 추가 폼일 때만)를 둔다.
- **목차(TOC)·마인드맵 1단계(v4.73):** profile 섹션에 `chief_complaints`(주증상, 쉼표구분 — 2단계 마인드맵 분기 기준) 필드 추가(body 저장, SQL 변경 0). 주요 질환 모드에 **"목록↔목차" 토글**(`currentDiseaseView`/`setDiseaseView`/`renderDiseaseTocHtml`): 목차는 `category`(System)별 그룹 + **진도 점(✓≥0.6/◐/○)을 카드 채움비율로 자동 산출**(`diseaseCompleteness`, 저장 안 함). 드로어 감별진단의 `similar_diseases`는 등록 질환명과 매칭해 클릭 링크화(`diseaseLinkifySimilar`→`openDiseaseDrawer`). 설계 원칙: **목차·마인드맵 = 질환 카드 단일 데이터의 두 뷰, 병렬 저장소 금지, 마인드맵은 데이터 기반 자동생성(외부 이미지 첨부 아님).** 2단계=주증상별 자동 마인드맵(읽기전용 SVG, 가지끝=검사/진단 행).
- 노트 본문 자동링크/통합검색 대상에 포함됨(v4.56). 단, "관련 질환" 저장 칩은 아직 미구현(추가 시 노트 객체 `linkedDiseases` 필드만 추가하면 됨 — 노트가 JSONB라 SQL 변경 불필요).

### 3.6 medical_notes (개념·오답 노트 — 화면 표시명, v4.72 이전 "단권화 노트") — **JSONB형**
컬럼: `id bigint pk, data jsonb, created_at, updated_at, deleted_at`. 노트 객체 전체가 `data`에 들어간다 → **필드 추가 시 스키마 변경 불필요**(이미지 기능을 이 구조 덕에 SQL 변경 없이 추가함). 노트 객체 필드는 §6 참조.

### 3.7 medical_term_learning_state (학습상태)
`term_id pk, bookmarked, correct_count, wrong_count, study_status, due_at, last_reviewed_at, ts…`. 북마크·정오답·복습 스케줄(SRS 유사).
- ⚠️AUDIT(SRS 스케줄 의도): 복습 간격은 **직전 간격을 기반으로 성장**해야 진짜 간격반복이 된다. 현재 구현(`quizNext`)은 `interval = 2^(min(correctCount,5)-1)`처럼 **lifetime `correctCount`만으로 간격을 산출하고 5에서 캡**해서, 숙달 용어도 영원히 ≤16일 주기로 재출제되고 직전 간격이 반영되지 않는다. 또한 `wrongCount`가 누적만 되어(감소·리셋 없음) 한 번 3회 틀린 용어는 `study_status='mastered'`(조건 `correct≥5 && wrong≤2`)에 영구 도달 불가. 재구축 시: 간격은 직전 `intervalDays × ease`로 키우고, 숙달 판정은 lifetime 총합이 아니라 **연속 정답 streak/최근 정답률** 기반으로 둔다.

### 3.8 language_sync_meta (동기화 메타) — key/value 저장소
`key text pk, value text, updated_at`. 기준본 메타·기기 상태 등 모든 메타데이터의 만능 저장소(§5).

---

## 4. 저장 계층 (로컬)

### 4.1 두 백엔드
- **IndexedDB** (DB명 내부 store `LOCAL_CACHE_STORE`): 대용량 배열 = 용어/약물/공식/미생물/질환/노트. `idbGetValue/idbSetValue`로 접근. 레코드는 `{key, value, updatedAt}`.
- **localStorage**: 설정·메타·tombstone·기기ID 등 소형 데이터.

### 4.2 대용량 캐시 래퍼 (중요 개념)
- `scheduleLargeCacheWrite(key, value, metaKey, meta)`: 값을 IndexedDB에 비동기 저장, **동시에 `metaKey`(localStorage)에 개수/백엔드/저장시각 메타 기록**. IndexedDB 실패 시 자동으로 localStorage로 폴백. 성공 시 localStorage의 동일 key는 정리.
- `readLargeCacheValue(key, fallback)`: IndexedDB 우선 읽기 → 없으면 localStorage(레거시) 읽고 IndexedDB로 마이그레이션.
- 의미: **데이터 본체는 IndexedDB, "요약 메타(개수 등)"는 localStorage**에 이중화. 개발자 패널의 "저장메타 N개"가 이 메타.
- ⚠️AUDIT(읽기/쓰기 백엔드 일치): `scheduleLargeCacheWrite`가 IndexedDB에 쓰고 localStorage 동일 key를 지우므로, 같은 데이터의 **동기 lazy 읽기 경로가 localStorage를 직접 읽으면 빈 값/구버전을 반환**한다(예: 학습상태 `getLearningStateMap`의 lazy 초기화). 동기 읽기 함수는 반드시 앱 시작 시 IndexedDB→메모리 캐시로 로드된 값을 반환하게 하고, localStorage 직접 읽기 fallback을 쓰지 않는다. 또한 로더 간 처리 불일치(예: terms 로더만 dedupe/`deletedAt` 필터 누락) 없이 전 도메인 동일하게 정규화한다.

### 4.3 localStorage 키 전체 목록 (복원 시 그대로 재현)
| 키 | 용도 |
|---|---|
| `kma_medical_terms_v2_terms` / `_meta` | 용어 본체(IDB)/메타 |
| `kma_medical_terms_v2_drugs` / `_drugs_meta` | 약물 |
| `kma_medical_terms_v2_formulas` / `_formulas_meta` | 공식 |
| `kma_medical_terms_v2_microbes` / `_microbes_meta` | 미생물 |
| `kma_medical_terms_v2_diseases` / `_diseases_meta` | 주요 질환 |
| `dr_bugeon_integrated_notes_v1` / `_meta` | 단권화 노트 본체/메타 |
| `kma_medical_terms_v2_tombstones` | 용어 삭제기록 |
| `kma_medical_terms_v2_drug_tombstones` / `_formula_tombstones` / `_microbe_tombstones` / `_disease_tombstones` | 도메인별 삭제기록 |
| `dr_bugeon_integrated_note_tombstones_v1` | 노트 삭제기록 |
| `kma_medical_terms_v2_learning` | 학습상태 |
| `kma_medical_terms_v2_sync_meta` | 로컬 동기화 메타(기준본 버전/리비전/pending 상태) |
| `kma_medical_terms_v2_device_id` | 기기 고유 UUID |
| `kma_medical_terms_v2_cache_meta` | 캐시 백엔드 상태 |
| `kma_supabase_config` | `{url, key}` (Supabase) |
| `kma_cloudinary_config` | `{cloudName, uploadPreset, folder}` |
| `kma_medical_terms_v2_ai_config` | AI/LLM 키·라우팅 |
| `kma_medical_terms_v2_theme` | 테마 |
| `dr_bugeon_domain_favorites_v1` | 도메인 즐겨찾기 |

> ⚠️AUDIT(도메인 parity): tombstone을 다루는 **모든** 운영 경로 — 오래된 tombstone 정리(`pruneOldLocalTombstones`), 보호기록 개수(`getProtectedRecordCounts`), 보호기록 전체삭제(`confirmClearAllProtectedRecords`) — 는 위 6개 tombstone 키를 **하나도 빠짐없이** 처리해야 한다. 현재 구현은 **질병(`_disease_tombstones`)이 이 3곳에서 누락**되어 질병 tombstone이 영구히 정리·집계·삭제되지 않는다. 도메인 추가 시 이 3함수 + 동기화·백업까지 동일 적용한다.

---

## 5. Supabase 동기화 설계 (가장 복잡, 가장 중요)

### 5.1 접속/헤더
- 설정: `getSupabaseConfig() = {url, key}` (localStorage). 키는 **anon public 키** 권장.
- 모든 요청 헤더: `{ apikey, Authorization: 'Bearer '+key, Content-Type, Prefer: 'resolution=merge-duplicates' }` (`sbHeaders()`).
- upsert = `POST /rest/v1/<table>` (merge-duplicates). soft delete = `PATCH …?id=eq.<id>` 로 `deleted_at` 세팅. 읽기 = `GET …?select=*&order=updated_at.desc&limit=1000&offset=…` (1000건 페이지네이션).

### 5.2 기준본(canonical) 개념 — `language_sync_meta`에 key/value로 저장
도메인마다 메타 키 세트(접두사 `medical_<domain>_canonical_…`):
- `…_version` : 기준본 버전 문자열 `"<epoch>-<deviceId>"`
- `…_revision` : 정수 리비전(저장할 때마다 +1)
- `…_device_id` / `…_device_label` : 기준본을 만든 기기
- `…_active_count` / `…_deleted_count` : 활성/삭제 개수
- `…_record_ids_hash` / `…_snapshot_hash` : 무결성 해시(아래)
- (용어 기준 키 예: `medical_terms_canonical_version` 등. 약물/공식/미생물/질환(`medical_diseases_…`)/노트도 동형.)

### 5.3 무결성 해시 3종 (※ 함정 주의 — §10 필독)
- **record ids hash**: 활성 레코드 id들을 정렬·조인해 해시 → "어떤 레코드가 있는가".
- **snapshot hash**: 활성 레코드의 **내용 페이로드**를 정렬·직렬화해 해시 → "내용이 같은가".
  - 페이로드는 각 도메인 내용 필드만. **`createdAt`/`updatedAt`는 제외**(v4.52에서 제거). 이유: Supabase timestamptz 왕복 시 문자열 형식이 바뀌어(`…Z` → `…+00:00`) 내용이 같아도 해시가 어긋나는 오탐 발생 → 타임스탬프를 빼서 "내용 기준" 판정으로 고정.
  - ⚠️AUDIT(필드 누락 금지): 타임스탬프만 빼고 **사용자가 편집 가능한 내용 필드는 전부 포함**해야 한다. 한 필드라도 빠지면 그 필드만 수정했을 때 로컬/클라우드 snapshot 해시가 똑같이 나와 "일치"로 오판 → 변경이 다른 기기로 전파되지 않는다. 현재 구현은 **미생물 페이로드에 `ipa`, 공식 페이로드에 `tags`(system_tags)가 누락**되어 그 필드 단독 수정이 전파되지 않는다(용어 페이로드는 ipa 포함, 다른 도메인은 system_tags 포함 — 대조 기준). 재구축 시 각 도메인 `canonical*HashPayload`가 그 도메인 `normalize*ForStorage`/편집 폼이 저장하는 모든 내용 필드를 빠짐없이 담는지 대조한다.
- 판정: 로컬에서 계산한 해시 == 클라우드에서 계산한 해시 → "일치". 저장메타에 적힌 해시와 비교하면 기준본 저장 이후 변조 여부 확인.

### 5.4 tombstone (소프트삭제)
- 삭제는 `deleted_at` 세팅 + 로컬 tombstone 목록 보존. 동기화 시 tombstone을 함께 병합해 **다른 기기에서 삭제한 항목이 되살아나지 않게** 한다.
- "휴지통 비우기"는 기본적으로 **목록에서 숨김(hiddenAt)** 일 뿐 기록은 보존(부활 방지). 이미지 완전삭제 같은 hard 정리는 명시 옵션(`deleteImages:true`)에서만.

### 5.5 세 가지 동기화 동작
1. **최종상태 저장 (sbPushAll)** — 이 기기를 기준본으로. 로컬 활성본을 클라우드에 upsert + 로컬에 없는 클라우드 항목은 tombstone + 검증 재로딩 후 `sbSetCanonicalSnapshotMeta`로 기준본 메타 기록(리비전+1). pending 상태 플래그로 중단 안전성 확보.
2. **클라우드 최종본으로 교체 (pullFromCloud)** — 클라우드 활성본으로 로컬을 통째 교체. `canonical_version` 없으면 중단(안전장치).
3. **일반 동기화 (syncWithCloud)** — 양방향 병합. `pickSyncWinner`가 `updatedAt` 최신 우선으로 레코드별 승자 결정. "fence"(`filterLocalRowsAfterCanonicalFence`)로 기준본 이후 오래된 로컬 전용 항목은 제외.
   - ⚠️AUDIT(fence는 로컬 tombstone을 버리면 안 됨 — 삭제 부활 HIGH): fence의 목적은 "기준본 이전부터 있던 **오래된 로컬 전용 활성 항목**을 업로드 후보에서 빼는 것"이다. 그런데 구현이 `if (row.deletedAt) return false;`를 **타임스탬프 비교보다 먼저** 실행하면, 기준본 이후 생성된 로컬 tombstone(아직 클라우드에 없는 삭제기록)도 무조건 drop된다. 그러면 그 삭제가 병합(`mergeForSync`)에 도달하지 못해 클라우드의 활성 레코드가 승자가 되고 **삭제한 항목이 동기화 후 부활**한다(전 도메인). 규칙: fence는 활성 행에만 "기준본 이후 생성·수정" 조건을 적용하고, **tombstone 행은 fence로 버리지 말고 병합으로 통과**시킨다(삭제는 fence보다 우선). §15.1 테스트로 회귀 확인.

### 5.6 노트 동기화 (jsonb 특수)
- `noteToRow(note) = {id, data: normalizeIntegratedNote(note), updated_at, deleted_at}` / `rowToNote` 역변환.
- push/pull/merge가 위와 동형. **양기기 동시편집 충돌 시 "(충돌 사본)"으로 자동 보존**(절대 유실 안 함) — `syncNotesWithCloud`.
- 노트 push는 `sbPushAll` 성공 후 래퍼(`patchedSbPushAllWithNotes`)가 이어서 실행.
- ⚠️AUDIT(충돌판정 필드셋 — 링크 편집 소실 HIGH): 클라우드가 더 최신일 때 "충돌 사본을 만들지(=로컬 보존)" 판단하는 `noteContentDiffers`는 **`linkedTerms`만 비교하면 안 되고 `linkedDrugs`/`linkedMicrobes`/`linkedFormulas`까지 4종 전부 + `tags`/`originalMcq`/`images` 등 모든 내용 필드를 비교**해야 한다(= `canonicalNoteHashPayload`와 동일 필드셋). 링크 4종 중 일부만 비교하면, 로컬이 약물/미생물/공식 링크만 바꾼 경우 "동일"로 오판 → 충돌 사본 없이 클라우드 버전 채택 → **로컬 링크 편집이 조용히 소실**된다. 해시 페이로드와 충돌판정의 필드셋을 항상 일치시킨다.
- ⚠️AUDIT(로드 전 push 금지): 노트는 `bootstrapIntegratedNotes`가 `NOTEBOOK`을 채운 뒤에만 클라우드에 push해야 한다. `_notebookLoaded` 플래그를 실제로 검사하지 않으면, 로드 전 사용자 트리거 push(`pushNotesToCloud`/`sbPushAll` 래퍼)가 빈 `NOTEBOOK` 기준으로 모든 클라우드 노트를 `removed`로 처리해 **대량 soft-delete**될 수 있다. push/merge 진입부에서 `_notebookLoaded`를 가드한다.

### 5.7 멀티기기 상태 "내 기기들" (v4.52)
- 각 기기가 동기화/패널 열기 시 `language_sync_meta`에 `device_sync_status_<deviceId>` = JSON `{id,label,at, terms, drugs, formulas}`(각 도메인 로컬 snapshot 해시) 기록 (`recordThisDeviceSyncStatus`).
- 패널이 이 키들을 읽어 현재 클라우드 해시와 비교 → 기기별 "일치/동기화 필요" 표시. **새 테이블 불필요**(key/value 재사용).
- ⚠️AUDIT(도메인 누락 한계): 현재 페이로드와 비교가 **terms/drugs/formulas 3종만** 담아서, 미생물·질병만 다른 기기는 "일치"로 잘못 표시된다(진단 표시 한정, 데이터 변형은 없음). 도메인 추가 시 `device_sync_status_*` 페이로드와 `deviceSyncListHtml` 비교 표에도 microbes/diseases/notes를 포함한다.

---

## 6. 단권화 노트 시스템

### 6.1 노트 객체 필드 (normalizeIntegratedNote가 화이트리스트로 강제)
`id, title, system, noteType('concept'|'wrong'), summary, keyPoint, comparison, bodyHtml, linkedTerms[], linkedDrugs[], linkedMicrobes[], linkedFormulas[], wrongStem, myAnswer, correctAnswer, wrongReason, trap, nextCue, originalMcq{}, usmleSource, kmleSource, tags[], images[], favorite, createdAt, updatedAt, deletedAt, hiddenAt`

> **함정:** `normalizeIntegratedNote`는 **명시된 필드만 남기고 나머지는 버린다.** 새 필드를 추가하면 반드시 여기에 등록해야 저장·동기화된다(이미지 `images` 추가 시 핵심이었음).
> ⚠️AUDIT: 위 필드 중 **내용 비교가 필요한 모든 필드**는 §5.3 snapshot 해시 페이로드와 §5.6 `noteContentDiffers` **양쪽에 동일하게** 들어가야 한다. 한쪽에만 넣으면 "해시는 다르다는데 충돌판정은 같다"는 모순으로 편집이 유실된다. MCQ 정답 인덱스는 앱 전체에서 **0-base로 일관**되게 유지한다(`parseNoteMcqQuickText`/`normalizeNoteMcq`/뷰 렌더 모두 0-base).

### 6.2 bodyHtml 새니타이저 (`sanitizeNoteHtml`) — XSS 방지
- 허용 태그: `B,STRONG,I,EM,U,BR,P,DIV,H3,H4,UL,OL,LI,TABLE,THEAD,TBODY,TR,TH,TD,SPAN,FIGURE,FIGCAPTION,IMG`.
- 허용 속성: 대부분 `class/colspan/rowspan`. **IMG는 `src,alt,width,height,loading,class,data-public-id`만**, 그리고 **`src`는 `https://res.cloudinary.com/`로 시작해야만 허용**(아니면 제거). 스크립트/기타 속성 전부 제거.
- 허용 클래스 화이트리스트: `note-callout, note-warning, note-sec-def/path/usmle/link, note-body-image-figure, note-body-image`.

### 6.3 이미지 (Cloudinary)
- 업로드: 브라우저 → Cloudinary **unsigned** (`uploadImageToCloudinary`) → `{url, publicId, width, height, addedAt}`. `images[]`에 push + 본문 커서 위치에 `<figure data-public-id><img …></figure>` 삽입(`insertNoteBodyImage`, 캐럿 추적).
- 표시: 상세화면에서 본문 인라인 + 본문에 없는 이미지는 갤러리로(중복 제거: `noteBodyImagePublicIds`로 본문 publicId 추출 후 갤러리에서 제외). 썸네일은 `cloudinaryThumb()`로 CDN 변환(`c_fill,w_,q_auto,f_auto`).
- 삭제(완전): §7. 저장 시 제거된 이미지만 파기, 편집 취소 시 그 세션 업로드분 자동 정리.
- ⚠️AUDIT(본문 임베드 이미지 보호): 저장 시 "삭제할 이미지" 집합을 만들 때 보호집합(keptIds)은 **트레이 배열(`note.images`)만이 아니라 본문(bodyHtml)에 임베드된 publicId(`noteBodyImagePublicIds(bodyHtml)`)도 합집합으로 포함**해야 한다. 본문에는 남아 있는데 트레이 배열에서만 빠진 이미지를 보호집합에서 누락하면, 노트가 그 이미지를 계속 표시하는 중에 Cloudinary 원본이 영구 삭제된다(깨진 이미지). 삭제 대상 = (이전 이미지) − (트레이 ∪ 본문 임베드).

### 6.4 기타
- 자동 링크: 본문/요약에서 용어·약물·미생물·공식 이름을 감지해 연결칩 생성(`detectNoteResourceLinksFromText`). 경계 판정은 ASCII 부분단어 오매칭을 막아야 한다(예: "Urea"가 "Ureaplasma"에 매칭 금지). 한국어는 경계 없이 매칭(의도).
- 원문 객관식(originalMcq): 빠른입력(`# 질문 / + 정답 / - 오답`) 파싱, 복수정답(`answerIndexes`) 지원.
- 출처 검색 선택창: 출처칸 Enter → 일치 1개면 열기, 2+면 선택 모달.

---

## 7. 이미지 완전삭제 (Edge Function)

- 브라우저는 Cloudinary 영구삭제 불가(API Secret 필요). → Supabase **Edge Function `delete-cloudinary-image`** 가 서명해 `…/image/destroy` 호출.
- 앱: `deleteImageFromCloudinary(publicId)` → `POST {supabaseUrl}/functions/v1/delete-cloudinary-image`. 호출 헤더에 `apikey` + `Authorization: 'Bearer '+anonKey`를 보낸다.
- Function 환경변수: `CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET`. 서명 = `sha1("invalidate=true&public_id=<id>&timestamp=<ts>"+API_SECRET)`(`invalidate=true` 포함). 응답은 `result.result === 'ok' || 'not found'`를 성공으로 본다.
- ⚠️AUDIT(config 정정): `config.toml`은 실제 레포 기준 **`verify_jwt = true`** 다(이전 명세의 `false`는 오기). 앱이 anon Bearer 토큰을 보내므로 JWT 검증을 켜둔 채로 동작한다. (코드/배포법은 별도 `supabase/functions/delete-cloudinary-image/` + `install-deploy-guide.md` §5 참조.)

---

## 8. 버전 확인 / 기기 동기화 UI

- **저장본 버전 확인** 패널(v4.52 재설계): ① 종합 일치 배지 ② 도메인별 `클라우드/이 기기/일치` 표 ③ "내 기기들" 목록 ④ 마지막 기준본 저장 정보. 해시·revision·기기ID 등은 "고급 정보(개발자용)" 접기 안.
- **개발자 정보** 패널(v4.52 재설계): 메타 그리드 + 업데이트 이력(최신 1건 펼침, 나머지 접기, 넓은 화면 2열) + Supabase SQL 복사. 모달은 좌우 넓힘 + 높이 고정(내부 스크롤).
- 버전 관리: `APP_INFO.version` + `UPDATE_HISTORY[]`(최신이 index 0). **기능 변경 시 버전 올리고 이력 항목 추가가 규칙.**

---

## 9. 백업 / 복원 (코드 외 데이터)

- 앱 내 데이터 관리에서 **전체 JSON 백업/복원** 제공(용어·약물·공식·미생물·주요 질환·노트·학습상태 포함). 엑셀(xlsx/csv) import도 지원.
- 복원 우선순위: (1) Supabase 기준본이 살아있으면 새 HTML에서 설정만 입력→`pullFromCloud`로 전 데이터 복구. (2) Supabase도 없으면 JSON 백업에서 import. (3) 둘 다 없으면 이 문서로 코드 재구축 후 위 절차.
- ⚠️AUDIT(미리보기=적용 일치): 가져오기 미리보기의 "갱신/교체" 카운트는 실제 적용 모드(append=신규만, merge=`updatedAt` 더 최신일 때만 갱신)와 같은 규칙으로 계산해, 표시 수치가 실제 기록 결과와 어긋나지 않게 한다.

---

## 10. 불변조건 & 함정 (재현 시 반드시 지킬 것)

1. **snapshot 해시에 타임스탬프 넣지 말 것.** `createdAt/updatedAt`를 해시에 포함하면 Supabase timestamptz 왕복(형식 변환)으로 내용이 같아도 "다름" 오탐. → 내용 필드만 해시.
2. **`normalizeIntegratedNote`는 화이트리스트.** 노트 새 필드는 여기에 등록 안 하면 저장·동기화 시 사라진다.
3. **본문 이미지 `src`는 Cloudinary URL만 허용.** 새니타이저가 그 외 src를 제거(XSS 방지 겸).
4. **삭제는 소프트삭제 + tombstone.** hard delete 금지(기기 간 부활). 휴지통 비우기는 숨김.
5. **모든 클라우드 호출은 실패해도 로컬 유지.** try/catch로 감싸고 토스트만.
6. **함수 재할당 래퍼 패턴:** 노트/이미지 기능은 `sbPushAll`/`pullFromCloud`를 `const original = fn; fn = async(…)=>{ await original(); …노트처리… }`로 감싼다. 검증된 코어를 안 건드리고 확장하는 방식.
7. **대용량 단일 HTML 편집 주의:** ~1MB 파일은 에디터 저장 시 끝부분이 잘릴 수 있다 → 저장 후 항상 파일이 `</html>`로 끝나는지, script 블록 수가 맞는지 검증.
8. **id는 숫자(bigint), 노트는 `Date.now()` 기반.** 비교 시 문자열/숫자 혼용 주의(`String(id)`로 통일하는 곳 많음).

> ⚠️AUDIT 추가 불변조건 (2026-06-29 로직 전수감사 — 모두 실제 코드에서 확인된 결함 기반)
>
> **수정 반영 상태:**
> - **v4.75(PR #2 머지):** 불변조건 **9**(fence tombstone)·**10**(노트 충돌판정 linked* 4종) + 노트 로드-전 push 가드(§5.6).
> - **v4.76(PR #4 머지):** 불변조건 **11**(해시 페이로드 ipa/tags)·**13**(질병 tombstone parity)·**15**(표 파이프 split 전 보호) + ATC 콤마 분해(§3.2 combineUniqueText)·질병 seed add 전용(§3.5).
> - **미수정(가드레일 유지):** **12**(이미지 보호집합 = 트레이 ∪ 본문)·**14**(SRS 간격/숙달 — *버그가 아니라 학습 동작 설계 변경*이라 사용자 협의 후 진행)·**16**(읽기/쓰기 저장 백엔드 일치)·**17**(도메인 parity 일반). 그 외 LOW 항목도 후속.

9. **fence는 로컬 tombstone을 버리지 않는다(삭제 부활 방지).** `filterLocalRowsAfterCanonicalFence`에서 `deletedAt` 행을 무조건 제거하면 기준본 이후 삭제가 병합에 도달 못 해 클라우드에서 부활한다. tombstone은 fence 통과 → 병합 우선. (§5.5, §15.1)
10. **노트 충돌판정 = 해시 페이로드와 같은 필드셋.** `noteContentDiffers`는 `linkedTerms`뿐 아니라 `linkedDrugs/linkedMicrobes/linkedFormulas` 4종 전부 비교. 누락하면 링크 편집이 동기화 중 소실. (§5.6, §6.1)
11. **snapshot 해시 페이로드에 편집 가능 내용 필드를 전부 포함.** 타임스탬프만 제외. 미생물 `ipa`·공식 `tags` 등 누락 시 그 필드 단독 수정이 다른 기기로 전파 안 됨. (§5.3)
12. **이미지 삭제 보호집합 = 트레이 ∪ 본문 임베드 publicId.** 본문(`bodyHtml`)에 남은 이미지를 보호집합에서 빠뜨리면 표시 중인 원본이 삭제됨. (§6.3)
13. **tombstone 운영(정리·집계·전체삭제)은 질병 포함 전 도메인.** `pruneOldLocalTombstones`/`getProtectedRecordCounts`/`confirmClearAllProtectedRecords` 등에서 한 도메인이라도 빠지면 그 도메인 tombstone이 영구 잔존. 도메인 추가 시 누락 점검. (§4.3)
14. **SRS 간격은 직전 간격 기반으로 성장, 숙달 판정은 streak/최근 정답률 기반.** lifetime `correctCount` 캡만으로 간격을 산출하거나 누적 `wrongCount`로 mastered를 영구 차단하지 않는다. (§3.7)
15. **Markdown 표 셀의 파이프 이스케이프는 split 전에 처리.** `tableDataToMarkdown`이 셀 내 `|`를 `\|`로 저장하므로, 파싱(`parseMarkdownTableLine`)에서 `split('|')` **후** unescape하면 셀이 쪼개진다 — 보호 토큰 치환 후 split하거나, escape된 파이프를 split에서 제외한다. (ui-features 표 편집기)
16. **읽기/쓰기 저장 백엔드 일치.** IndexedDB로 쓰고 localStorage를 지운 데이터를 동기 경로에서 localStorage로 직접 읽지 않는다(시작 시 메모리 캐시 로드 후 그 값 반환). (§4.2)
17. **도메인 변형 복붙 누락 점검.** 약물/공식/미생물/질병/노트는 용어를 복제해 만든다 — 해시 페이로드·tombstone 운영·기기 일치 비교·로더 정규화에서 "한 도메인만 빠짐"이 반복 결함. 수정 후 `rg`로 전 도메인 대조. (§3, §4.3, §5.3, §5.7)

---

## 11. 재구축 체크리스트 (제로부터)

1. **Supabase 프로젝트** 생성 → SQL Editor에 동봉 `medical_note_supabase_schema.sql` 전체 실행(7개 테이블 + 인덱스 + canonical meta seed + 진단 SELECT).
2. **단일 HTML 골격**: `<head>` CSS, `<body>` + 4개 `<script>`. Vanilla JS, 프레임워크 없음.
3. **저장 계층**: `idbGet/SetValue` + `scheduleLargeCacheWrite/readLargeCacheValue` + §4.3 키 그대로. 각 도메인 `load/save…ToLocalStorage`(실제론 IDB). (불변조건 16)
4. **도메인 CRUD + 정규화**: `normalize<Domain>ForStorage`, `<domain>ToRow/rowTo<Domain>` (§3, SQL 컬럼과 1:1). 질병 seed는 add 전용(불변조건 §3.5).
5. **Supabase 레이어**: `sbHeaders, sbLoadAll*, sbBatchUpsert*Rows, sbDelete*, sbLoadSyncMetaMap, sbSetSyncMetaRows, sbSetCanonicalSnapshotMeta`.
6. **해시/메타**: `computeRecordIdsHash/computeSnapshotHash`(도메인별) — **타임스탬프 제외, 편집 가능 내용 필드 전부 포함**(불변조건 11). canonical 메타 키 세트.
7. **세 동기화 동작**: `sbPushAll`(최종상태 저장), `pullFromCloud`(교체), `syncWithCloud`(병합) + `pickSyncWinner` + fence(불변조건 9).
8. **단권화 노트**: 객체 필드(§6.1) + `normalizeIntegratedNote`(화이트리스트) + `sanitizeNoteHtml`(§6.2) + jsonb push/pull + 충돌 사본(불변조건 10). 로드 전 push 가드(§5.6).
9. **이미지**: Cloudinary config/upload/thumb + 본문 삽입/갤러리/중복제거 + Edge Function 완전삭제(보호집합 불변조건 12).
10. **멀티기기 상태**: `recordThisDeviceSyncStatus` + `device_sync_status_*` 읽어 패널 표시(전 도메인 — 불변조건 §5.7).
11. **UI**: 6도메인 라이브러리/검색/퀴즈/북마크, 노트 편집·열람, 설정/동기화/개발자 모달, 버전 확인 패널.
12. **백업/복원**: 전체 JSON export/import, xlsx import(미리보기=적용 일치 — §9).
13. **버전/이력**: `APP_INFO` + `UPDATE_HISTORY`.
14. **tombstone 운영 전 도메인 등록**: prune/count/clear 3함수에 6개 tombstone 키 모두(불변조건 13).

---

## 12. 부록 — 함수 모듈 맵 (접두사 기준, 위치 찾기용)

- `sb*` — Supabase REST (load/upsert/delete/meta).
- `<domain>ToRow / rowTo<domain> / normalize<Domain>ForStorage` — 데이터 매핑/정규화.
- `compute*Hash / canonical*HashPayload` — 무결성 해시.
- `save*ToLocalStorage / load* / idb* / *LargeCache*` — 로컬 저장.
- `*Tombstone* / pickSyncWinner / *Fence*` — 삭제/병합.
- `*IntegratedNote* / sanitizeNoteHtml / noteToRow / *NoteImage* / insertNoteBodyImage` — 노트 시스템.
- `*Cloudinary* / uploadImageToCloudinary / deleteImageFromCloudinary / cloudinaryThumb` — 이미지.
- `recordThisDeviceSyncStatus / parseDeviceSyncStatuses / deviceSyncListHtml` — 멀티기기.
- `showSavedVersionInfo / showDeveloperInfo / showSyncDiagnostics` — 진단/정보 패널.
- `getDeviceId / getDeviceReadableLabel` — 기기 식별.

> 동봉 SQL 파일(`medical_note_supabase_schema.sql`)이 데이터 구조의 단일 진실 소스(SoT)다. 이 문서와 SQL을 함께 보관하라.
