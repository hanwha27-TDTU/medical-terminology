# 기능·필드 추가 절차 — "보이기만 하고 저장 안 됨" 방지

새 기능/필드를 추가할 때 **반드시 이 순서**로 진행한다. 이 앱의 대표 결함군은 "UI엔 보이는데
저장·동기화·복원에서 누락"이다(이번 세션 실제 사례: `parent_id`·`favorite` 해시 누락 등). 이 절차는
그걸 **구현 전에** 막는다. code-review.md가 사후 관문이라면 이건 **사전 설계 순서**다.

> 상세 배선 지점은 반복하지 않는다 — code-review.md §2(데이터 무결성)·§3(도메인 parity) + reconstruction-spec.md
> 불변조건 11·17을 참조. 여기선 **순서와 우리 앱 필수 배선**만.

## 절차 (순서 고정)

1. **목적 정의** — 무엇을·왜. 한 문장.
2. **영향 도메인 확인** — TERMS/DRUGS/FORMULAS/MICROBES/DISEASES/NOTES 중 어디에? 한 도메인 전용인가,
   공통인가(공통이면 **6도메인 전부** 반영 — 한 도메인만 빠짐이 반복 결함, 불변조건 17).
3. **데이터 필드 정의** — 필드명·타입·기본값. 기존 필드명과 충돌 없는지.
4. **UI 입력 위치 정의** — 추가/편집 폼의 어느 칸. (표시만 하고 폼에 입력 칸이 없으면 사용자가 못 넣는다.)
5. **저장 경로 연결 (⚠️ 여기가 핵심 — 하나라도 빠지면 조용히 소실):**
   - [ ] `normalize<Domain>ForStorage` **화이트리스트에 필드 등록** — 안 하면 저장·동기화 때 사라진다(불변조건 2).
   - [ ] localStorage/IndexedDB 저장 경로(`save<Domain>ToLocalStorage`)에 포함.
   - [ ] Supabase **`<domain>ToRow` / `rowTo<Domain>` 왕복**에 포함(+ 컬럼형 도메인이면 SQL `add column` 필요 → 사용자에게 SQL 실행 안내).
   - [ ] **`canonical<Domain>HashPayload`에 편집 필드 포함**(불변조건 11) — 누락하면 그 필드 단독 변경이
         동기화에서 "일치"로 오판돼 **다른 기기로 전파 안 됨**(parent_id·favorite가 여기서 샜다). (추가 시 그 도메인 스냅샷 해시 1회 재베이스라인은 정상.)
6. **export/import 연결 (양쪽 parity):**
   - [ ] `createCompleteBackupObject`(export)에 포함 **+** `applyPendingDataImport`(restore)에서 복원 — 한쪽만 하면 왕복에서 유실.
   - [ ] 가져오기는 **모드 존중**(merge/append는 비파괴, replace만 교체 — 불변조건 20a).
   - [ ] 표(xlsx/CSV) 왕복도 필요하면 `*ExportRows`/`*FromTableRow`에 포함(예: 질환 parent_id/parent_name).
7. **검색/필터 반영 여부 판단** — 이 필드로 검색·필터·정렬이 되어야 하나? 되면 통합검색·필터 경로에 반영.
   (저장은 되는데 검색·필터·복구에서 누락되는 필드 없게.)
8. **회귀 테스트:**
   - [ ] `node scripts/check-index-scripts.mjs` · `node scripts/golden-tests.mjs` · `node scripts/sync-instruction-doc.mjs --check`
   - [ ] 새 **순수함수**를 만들었으면 golden-tests.mjs에 케이스 추가(행위보존/특성화).
   - [ ] 각 탭 열림 · 새 항목 저장·수정 · **새로고침 후 유지** · JSON export→import 왕복 유지 · 라이트/다크.
   - [ ] 🔴 CRITICAL ZONE(연구노트 해시) 영향 없음(있으면 명시적 요청 + 골든/매니페스트).
9. **PR 설명 작성** — `.github/pull_request_template.md` 채우기(변경 영역·데이터흐름·자동 게이트·CRITICAL ZONE).

## 노트 도메인 특이사항
- 노트는 JSONB(`data` 통째) → SQL 컬럼 변경 불필요. 단 **`normalizeIntegratedNote` 화이트리스트 등록 필수**(안 하면 소실),
  충돌판정(`noteContentDiffers`)·해시 payload도 함께(불변조건 10).

## 한 줄 요약
**필드 하나 추가 = normalize + 저장(로컬/클라우드 왕복) + 해시 payload + export/import(parity·모드존중) + 검색/필터 + 회귀.**
이 중 하나만 빠져도 "보이기만 하고 저장/전파 안 됨"이 된다.
