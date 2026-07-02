# KBG_MedicalNote — 상호 데이터 연결 지도 & 보존 불변조건

> **왜 이 문서:** 이 앱의 핵심 가치는 **데이터 간 상호 연결**(개념↔용어↔약물↔미생물↔공식↔질환↔노트, 자동링크, canonical entity의 다중 메뉴 노출, 연결 노트/시각화)이다. 플랫폼 구조 재배치·어학 이식 과정에서 이 연결이 **끊기거나 파편화되면 안 된다.** 이 문서는 (1) 현재 연결 지도 (2) 연결을 만드는·유지하는 코드 (3) 절대 깨면 안 되는 연결 보존 불변조건 (4) 재배치 시 위험·방어 (5) canonical entity와 연결의 관계 (6) 현재 연결 공백(향후 additive 후보)을 고정한다.
> **기준 버전:** v2.35 · index.html 코드 무변경(문서).

---

## 1. 현재 연결 지도 (실제 코드 기준)

| 출발 | 도착 | 저장 필드 | 방식 | 상태 |
|---|---|---|---|---|
| 노트 | 용어 | `linkedTerms[]` | 자동링크 + 수동칩 | ✅ (11~12곳) |
| 노트 | 약물 | `linkedDrugs[]` | 자동링크 + 수동칩 | ✅ |
| 노트 | 미생물 | `linkedMicrobes[]` | 자동링크 + 수동칩 | ✅ |
| 노트 | 공식 | `linkedFormulas[]` | 자동링크 + 수동칩 | ✅ |
| 노트 본문/요약 | 4개 도메인 | (없음·탐지) | `detectNoteResourceLinksFromText` | ✅ 탐지 |
| 질환 | 유사질환 | `body.ddx.similar_diseases` | `diseaseLinkifySimilar`→`openDiseaseDrawer` | ✅ |
| 질환 | 상위/하위질환 | `parent_id` | 역조회 + 트리 모달 | ✅ |
| entity | 다중 메뉴 노출 | `concept_category`·`system_tags` | `setConceptFilter`·`setFilter` | ✅ |
| 노트 | 질환 | `linkedDiseases[]` | 자동링크 + 수동칩 | ✅ (v2.37 · 5번째 링크) |
| entity | 임의 개념 | `linkedConcepts[]` | — | ❌ 미구현(§6) |
| 전 도메인 | 연결 그래프 | — | (시각화) | ❌ 미구현(§6) |

**연결 해소 키:** 링크는 대상의 **id(문자/숫자)** 또는 **이름 매칭**으로 해소된다. → 링크 무결성은 "① entity가 하나만 존재(중복 저장 금지) ② id 비교 일관 ③ 이름 매칭이 모호하면 링크 안 함"에 달려 있다.

---

## 2. 연결을 만드는·유지하는 코드 (건드릴 때 함께 봐야 할 것)

- **자동링크:** `detectNoteResourceLinksFromText` — 본문/요약에서 도메인 이름 탐지 → 연결칩. 경계 판정으로 ASCII 부분단어 오매칭 방지(예: "Urea"가 "Ureaplasma"에 매칭 금지). 한국어는 경계 없이 매칭(의도).
- **이름 매칭 해소:** `findDiseaseByName`/`findDrugByName`/`findMicrobeByName` — **정확히 1건일 때만** 링크(모호하면 링크 안 함). 1글자 토큰 과매칭은 양쪽 2글자 이상 제한.
- **열기:** `openNoteLinkedResource` / `openDiseaseDrawer` / `_openDiseaseFromTree` — 링크 클릭 시 대상 상세로.
- **다중 노출:** `applyFilters` + `setConceptFilter`(concept_category) + `setFilter`(system_tags/장기계) — 같은 entity가 여러 메뉴/필터에 등장.
- **동기화 시 연결 보존:** 노트 push/pull/merge(`syncNotesWithCloud`), 충돌 판정(`noteContentDiffers`), 해시 페이로드(`canonicalNoteHashPayload`).

---

## 3. 연결 보존 불변조건 (🔴 절대 깨지 말 것)

| # | 불변조건 | 근거 | 깨지면 |
|---|---|---|---|
| L1 | **노트 링크(5종)는 `noteContentDiffers`(충돌 판정)에서 제외 + 동기화 병합에서 union(합집합) 보존.** 해시 payload에는 포함(스냅샷 비교용). | 실제 코드(26728·26720) — 스펙 불변조건 10에서 진화 | ⚠️ 정정: 옛 스펙은 "충돌판정에 4종 비교"였으나, 링크는 자동파생이라 충돌 트리거로 쓰면 **스퓨리어스 충돌 사본 양산**(실제 발생) → 제외하고 union으로 보존이 현재 진실. 병합 union이 어느 편집도 잃지 않음 |
| L2 | **snapshot 해시 페이로드에 링크 4종 전부 포함**(편집 가능 필드 전부) | 불변조건 11 | 링크만 바꾼 변경이 다른 기기로 전파 안 됨 |
| L3 | **이름 매칭은 정확히 1건일 때만 링크**(모호하면 링크 안 함) | 불변조건 20c | 엉뚱한 대상에 오연결 |
| L4 | **자동링크 경계 판정 유지**(ASCII 부분단어 오매칭 금지, 한국어는 경계 없이) | §6.4 | "Urea"→"Ureaplasma" 같은 오매칭 |
| L5 | **하나의 개념 = 하나의 canonical entity**(중복 저장 금지) | canonical §7 | 링크 대상이 갈라져 파편화·중복 카드 |
| L6 | **id 비교 일관**(`String(id)` 통일) | 불변조건 8 | 링크 해소 실패(문자/숫자 혼용) |
| L7 | **질환 계층은 아형의 `parent_id` 단방향만**(부모에 양방향 배열 저장 금지) | 불변조건 18 | 동기화 드리프트로 관계 깨짐 |

> **핵심:** 링크·동기화·해시·노트 관련 코드를 건드리기 전 `reconstruction-spec.md` §10 불변조건 9~20을 먼저 읽는다. L1·L2는 특히 "링크 편집 소실"의 급소.

---

## 4. 플랫폼 재배치 시 연결 위험 & 방어

| 위험 | 방어 |
|---|---|
| 방(뷰) 분리로 같은 entity를 방마다 복제 저장 | **금지.** 방은 뷰/라우팅만 — 저장은 단일 entity(§5). 링크는 entity id를 가리키므로 뷰가 늘어도 링크 불변. |
| 새 메뉴("해부·생리"/"검사·수치")를 새 테이블로 | **금지.** `medical_terms` 태그 필터 뷰 → 같은 행을 여러 메뉴가 공유, 링크 유지. |
| DOM id/함수 rename으로 자동링크·열기 끊김 | 기존 `detectNoteResourceLinksFromText`/`openNoteLinkedResource`/`find*ByName` **호출만**, rename 금지(CI 정확명 보호). |
| 노트 sync 경로 리팩터링으로 linked* 누락 | L1·L2 준수 — 링크 5종은 충돌판정 제외 + union 병합 + 해시 payload 포함. 변경 후 `rg`로 5종 대조. |
| 어학/CPX 데이터 추가 시 링크 대상에서 누락 | 새 도메인도 자동링크·검색·연결 대상에 편입(도메인 parity — 불변조건 17). |

---

## 5. canonical entity ↔ 연결의 관계 (왜 단일 entity가 연결의 전제인가)

- 링크(`linked*`)와 유사질환·자동링크는 **대상 entity 1개(id/이름)**를 가리킨다.
- 같은 개념을 여러 카테고리에 **중복 저장하면** 링크가 어느 사본을 가리킬지 갈라지고(파편화), 자동링크·검색·시각화가 사본마다 따로 걸린다.
- 따라서 **canonical entity(단일 저장) + `primaryCategory`/`tags`/`linkedConcepts`(다중 노출)** 는 연결 무결성의 **전제**다. (deliverable 7과 이 문서는 한 쌍.)
- 예: `pneumonia`(단일 질환 entity) ← 노트 `linkedDiseases`(v2.37 완료), 약물 `amoxicillin` 치료 링크, 미생물 `S. pneumoniae` 원인 링크, CPX 흔한증례 태그 — 전부 **하나의 pneumonia id**를 가리켜야 그래프가 성립.

---

## 6.5 백업/복원 호환 검증 (2026-07-02 · v2.37/v2.38 변경 대상)

이번 연결 강화(노트 `linkedDiseases`, 연구노트 v2.0 필드)가 백업/복원 호환을 지키는지 **코드+브라우저로 검증함**. 결과: 세 방향 모두 호환.

- **경로:** 백업은 `patchedCreateCompleteBackupObject`가 `backup.notes = NOTEBOOK.map(normalizeIntegratedNote)`(+`researchNotes:_rnLoad()`)로 주입, 복원은 `importData.notes.map(normalizeIntegratedNote)`(index.html 24505·26522)로 **양쪽 다 같은 화이트리스트**를 거친다.
- **① 옛 백업 → 새 앱:** `linkedDiseases` 키 없는 노트 → normalize가 `[]` 기본, 크래시 0, 타 필드 보존(브라우저 `oldNoteNormalizedSafe:true`). `notes` 키 없는 백업도 `hasNotePayload` 가드로 안전.
- **② 새 앱 왕복:** `linkedDiseases` 백업에 실려 왕복 보존(`exportKeepsLinkedDiseases:true`). 연구노트 v2.0 필드는 whole-object 저장이라 entry_hash와 함께 보존(해시 검증 유효).
- **③ 새 백업 → 옛 앱:** 옛 화이트리스트가 `linkedDiseases`를 조용히 드롭(무해·forward-incompat, 개인 단일앱이라 실질 무영향).
- **주의(항구):** CI `check-restore-drift`는 **컬럼형 5도메인만** 왕복 검사하고 **노트·연구노트(jsonb blob)는 대상 아님** → 노트/연구노트에 새 필드 추가 시 백업/복원은 **수동 검증**이 규칙(normalize 화이트리스트 등록 필수). (스킬 import-backup-media §8.1.2)

---

## 6. 현재 연결 공백 (향후 additive 후보 — 지금 구현 아님)

> "상호 연결이 핵심"이라는 기준에서 **강화 여지**. 전부 additive·SQL 변경 없음(노트 JSONB). 구조 고정 단계라 지금은 후보로만 기록.

1. ~~노트 → 질환 영구 링크(`linkedDiseases`)~~ **✅ 완료(v2.37).** 노트 객체 `linkedDiseases[]` + `normalizeIntegratedNote` 화이트리스트 + 해시 payload(L2) + 동기화 union 병합 + 자동링크 + 편집폼/뷰/필터/검색/CSV. (링크는 L1대로 충돌판정 제외 + union 보존)
2. **일반 `linkedConcepts[]`** — canonical 예시엔 있으나 미구현. 도메인 무관 개념 연결(SA node↔심방 등)용.
3. **연결 시각화(마인드맵 그래프)** — 개념도의 Unified Search "연결 시각화" 미구현. 기존 링크 데이터를 읽어 **읽기 전용 그래프**로 렌더(신규 저장 없음). Review/Unified Search 확장 영역.

**공통 원칙:** 이 3개를 나중에 구현할 때도 **새 저장소·중복 entity 만들지 말고**, 기존 linked* 패턴 + canonical id를 재사용한다. 추가 시 L1~L7 전부 재점검.

---

## 7. 다음 단계 최소 범위 (연결 인식 · 승인 후)

1. **canonical 태그사전(`KBG_MedicalNote.AppSchema`)** — `primaryCategory` 허용값 + 표준 `tags` + `linkedConcepts` 스키마를 **연결 인식**으로 정의(§5). 신규 상수, 기존 데이터 미변경.
2. **구획 주석 배너 14개** — §3(2차 문서) 그대로.
3. **(별건·후속) 연결 공백 3종**(§6)은 각각 독립 additive 기능으로, L1~L7 점검과 함께.
- **불변:** 링크·동기화·해시·노트 코어 로직, 기존 함수/DOM id, 저장소 key, Supabase 스키마.

---

### 자체점검
- [x] 현재 연결 지도 코드 기준 고정(§1)
- [x] 연결 유지 코드·보존 불변조건 L1~L7(§2·§3)
- [x] 재배치 연결 위험·방어(§4) · canonical=연결 전제(§5)
- [x] 연결 공백 3종 향후 additive 후보(§6)
- [x] index.html 무변경 · 기존 연결·데이터 보존
