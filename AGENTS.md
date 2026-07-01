# AGENTS.md — 이 저장소에서 일하는 모든 AI 에이전트용 규약

이 파일은 Codex 등 `AGENTS.md`를 읽는 코딩 에이전트를 위한 운영 규약입니다.
Claude Code는 같은 규약을 `.claude/skills/dr-bugeon-medical-note/`(스킬)에서 읽습니다.
두 에이전트가 **같은 규칙**으로 움직여 커밋·푸시·머지 충돌을 막는 것이 목적입니다.

저장소: `hanwha27-tdtu/medical-note` · 앱: Dr. Bugeon의 Medical Note (단일 HTML 학습 앱)

---

## 0. 가장 먼저 알아야 할 것 — 단일 거대 파일

이 앱의 코드는 거의 전부 **`index.html` 한 파일(약 23,700줄)** 에 있습니다
(CSS `<style>` + JS `<script>` 4블록 + JS 템플릿 리터럴로 만든 UI HTML).

→ **충돌의 99%는 여기서 납니다.** 두 에이전트가 동시에 `index.html`을 고치면
논리적으로 무관한 수정이라도 텍스트상 충돌이 거의 확실합니다.
아래 규칙은 이걸 막기 위한 것입니다.

도메인·동기화·복원 등 깊은 구조 지식은 `.claude/skills/dr-bugeon-medical-note/`의
`reconstruction-spec.md`, `storage-sync.md`, `ui-features.md` 등에 정리돼 있으니
큰 수정 전에 먼저 읽으세요(단일 진실원).

---

## 1. 브랜치 네임스페이스 (절대 규칙)

- **Codex → `codex/*` 브랜치만 사용.** (예: `codex/fix-quiz-interval`)
- **Claude → `claude/*` 브랜치만 사용.**
- **누구도 `main`에 직접 푸시하지 않는다. 모든 변경은 PR을 거친다.**
- 이렇게 하면 푸시 단계 충돌은 0이 되고, 충돌은 오직 *머지 시점*에만 생겨 한 곳에서 통제됩니다.

작업 시작 시 **첫 명령**은 항상:
```
git checkout main && git pull origin main
git checkout -b codex/<작업명>
```
(main을 pull한 직후 바로 편집을 시작하지 말 것 — 반드시 새 브랜치를 먼저 만든다.)

---

## 2. 자동 커밋 · 푸시 · 머지 (사용자 지정 운영 방식)

사용자가 두 에이전트 모두 **자동 운영**을 원합니다. 일상 변경은 따로 확인받지 말고 진행:

- **자동 커밋·푸시:** 변경을 끝내면 바로 커밋·푸시. 커밋은 작업/결함 단위로 명확한 메시지.
  푸시 실패(네트워크) 시 지수 백오프(2/4/8/16초)로 최대 4회 재시도.
  푸시는 `git push -u origin codex/<작업명>`.
- **자동 머지:** PR을 만들면 바로 머지. **머지 방식은 squash**, 커밋 제목에 `(#번호)`.
- **머지 전 게이트(반드시 통과) — 자동 회귀:**
  1. `node scripts/check-index-scripts.mjs` (실행 `<script>` 문법·블록수·`</html>` 절단·핵심 흐름 함수 존재·도메인 parity),
  2. `node scripts/golden-tests.mjs` (순수함수 행위보존 + 해시 직렬화 잠금),
  3. `node scripts/check-schema-drift.mjs` (스키마 드리프트 — normalize 내용 필드 ↔ canonical 해시 payload, 전파 누락 급소),
  4. `node scripts/check-restore-drift.mjs` (복원 드리프트 — `<domain>ToRow`가 쓴 컬럼을 `rowTo<Domain>`이 다시 읽는지, 복원/새 기기 유실 급소),
  5. `node scripts/sync-instruction-doc.mjs --check` (지시문 드리프트),
  6. `node scripts/check-skill-docs.mjs` (스킬 문서 정합성 — 참고문서 목록·게이트 목록이 현실과 어긋나면 실패),
  7. `node scripts/check-version-bump.mjs` (index.html 변경 시 버전 +0.01·새 이력 항목·"최신 ·" 접두사 1개 강제 — base=origin/main),
  8. JS 로직·데이터·동기화·순수함수를 바꿨으면 그 순수함수를 `golden-tests.mjs`에 케이스로 추가.
  하나라도 못 지키면 머지하지 말고 보고한다. (상세: 스킬 `references/regression.md` — (A)자동은 AI 의무, (B)수동 UI는 사용자 실기기 몫.)
- **PR 분리:** 성격이 다른 작업은 PR을 나눈다(앱 코드 ↔ 스킬/문서).
- **결과 보고:** 머지했으면 PR 번호·머지 SHA·머지 방식을 보고에 남긴다.

**자동화 제외(먼저 확인받기):** `main` 직접 푸시로 PR 우회, force-push to main,
히스토리 재작성, 외부로 비밀값 전송 등 되돌리기 어렵거나 데이터 영향이 큰 동작.

---

## 3. 충돌 방지 — 다중 에이전트 핵심

1. **`index.html`을 건드리는 PR은 한 번에 하나만.** 다른 에이전트가 index.html 작업 중이면
   기다리거나, 명확히 다른 파일(스킬 문서 등)만 건드린다. 동시 작업이 충돌의 주원인.
2. **머지 직전 rebase:** 내 PR이 stale하면 머지 전에
   `git fetch origin main && git rebase origin/main` → index.html 충돌 해결 →
   `node --check` → **피처 브랜치에 force-push**(피처 브랜치 force-push는 안전, **main은 절대 금지**) → 머지.
3. **머지는 직렬화:** 한쪽 PR을 머지하면, 다른 쪽은 머지 전 반드시 최신 main을 rebase로 흡수.
4. 충돌 마커(`<<<<<<<`)는 양쪽 의도를 모두 보존하도록 신중히 해결하고, 해결 후 `node --check` 재실행.

---

## 4. 버전·이력 (변경마다)

- `APP_INFO.version`을 **+0.01** 올린다(`1.01 → 1.02 → … → 1.99 → 2.00`). 표시 전용이라 동기화엔 영향 없음.
- `UPDATE_HISTORY` **최상단**에 `{ title: '최신 · vX.XX 한 줄 요약', items: [...] }` 추가하고,
  **직전 항목 title의 '최신 · ' 접두사는 제거**한다(`[0]`만 '최신 ·'를 가진다).
- **지침(스킬/문서) 업데이트는 작업 완료의 일부 — 사용자 지시 없어도 매 변경 100%·누락 없이 점검한다.**
  새 교훈·규약·실수·패턴·설계결정이 하나라도 생기면 해당 스킬 문서(또는 이 `AGENTS.md`)에 반영하고,
  **결과 보고에 `지침 업데이트: <파일>/없음(새 교훈 없음)`을 항상 명시**한다.
  빈칸으로 두지 말고 "점검했으나 없음"과 "빠뜨림"을 구분한다.
  (Claude 스킬 측 동일 규칙: `SKILL.md` 핵심 원칙 #9 · `agents-rules.md` 완료 보고.)
- **개발 로그는 "특허용 연구노트"로 흘러간다 — 어떤 AI로 작업하든 동일.** 이 앱은 개발자 모드에
  **연구노트**(특허 증거용 append-only 해시체인 로그)를 갖고 있고, `UPDATE_HISTORY`를
  "📜 지난 개발 이력 가져오기"(증분)로 연구노트에 소급 기록한다. 그래서 **네가 남기는 UPDATE_HISTORY
  항목은 나중에 특허 증거가 된다** → 모호하게 쓰지 말고 "무엇을·왜" 명확히 적는다.
  - **연구노트는 외부 AI 대화·코드편집·git을 자동 캡처하지 못한다**(브라우저 앱). 즉 어떤 AI(Claude·Codex·기타)든
    실시간 자동 로깅은 없다 — **git 커밋 이력이 유일한 자동·권위 타임라인**이고(실제 날짜+SHA),
    UPDATE_HISTORY→연구노트는 그 위의 사람이 큐레이션하는 층이다.
  - 서술은 **사람(발명자)의 착상·판단**과 **AI(도구) 보조**를 구분한다(연구노트의 human/AI 분리 원칙).
    특정 AI 도구로 큰 작업을 했으면 항목에 도구명을 남겨도 좋다. 발명자 귀속은 김부건(Kim Bugeon)으로 고정.
  - 즉 "Claude에서 하든 다른 AI에서 하든 로그가 동일하게 남게" 하는 방법 = **매 변경 git 커밋 + 명확한
    UPDATE_HISTORY 항목**(이 규약을 지키면 자동으로 성립). 상세는 `.claude/skills/…/ui-features.md`
    §10.6.9(연구노트) 참고.

---

## 5. 검증 범위 (과검증 금지)

- `node --check`는 **JS 문법만** 검사한다.
- **CSS/HTML만 바뀐 변경**은 `node --check`(템플릿 리터럴 안 HTML을 건드렸을 수 있으니)만 통과하면
  코드 안전성 게이트 충족이고, "보기 좋냐"는 취향·실기기 몫이다. 이 환경엔 playwright가 없어
  라이브 렌더는 못 돌리니, 시각 변경은 "라이브 렌더 미실행"을 보고하고 실기기 확인을 권한다.
- **JS 로직·데이터·동기화** 변경은 순수 함수 격리 단위테스트(Node)로 확증한 뒤 머지한다.

---

## 6. 코드 수정 시 주의 (단일 파일 특성)

- UI HTML은 대부분 `el.innerHTML = \`…\`` **백틱 템플릿 리터럴**로 만든다.
  그 안 HTML에 **리터럴 백틱이나 코드블록 표시를 그대로 넣으면 템플릿이 끊겨 깨진다**
  → 큰 UI 템플릿을 편집한 뒤엔 반드시 `node --check`.
- 새 도메인/필드를 넣을 땐 추가·편집·삭제·tombstone·동기화·백업·노트 자동링크·통합검색까지
  전 생명주기를 함께 점검한다 — **순서·필수 배선은 스킬 `references/feature-addition.md`(9단계) 따를 것.**
  특히 `normalize*` 화이트리스트 + `canonical*HashPayload` 누락이 "보이기만 하고 저장/전파 안 됨"의 주범이다.

---

## 7. 코드 리뷰 (단일 HTML · PR 기반)

PR을 리뷰할 때는 **`.claude/skills/dr-bugeon-medical-note/references/code-review.md` 절차**를 따른다(상세 체크리스트·출력 형식·판정 기준은 그 문서에). 핵심만:

- **전제:** 단일 `index.html` 유지 — **파일 분리를 기본 답으로 제안하지 않는다.**
- **0단계(자동 게이트 먼저):** `node scripts/check-index-scripts.mjs` · `node scripts/golden-tests.mjs` · `node scripts/check-schema-drift.mjs` · `node scripts/sync-instruction-doc.mjs --check` 통과 확인. 하나라도 실패면 Request changes.
- **사람이 볼 것:** 데이터 흐름(저장→복구→동기화→export/import→UI) parity · 6도메인 전파 누락 · UI 회귀(다른 탭/테마) · CRITICAL ZONE.
- **🔴 CRITICAL ZONE(연구노트/해시체인/canonical 직렬화/TSA):** 명시적 요청 없으면 **수정하지 않고 코멘트만**(불변조건 19, 골든이 잠금).
- **보안은 이 리뷰 범위 밖**(별도 `/security-review`) — 단 명백한 시크릿 노출은 그냥 지나치지 말 것.
- **판정:** Approve 가능 / 수정 후 Approve 가능 / Request changes 필요 중 하나로 끝낸다.
- PR 본문은 `.github/pull_request_template.md` 형식을 채운다.
