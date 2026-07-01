# 회귀 테스트 — "실제로 안 깨졌는지" 확인

리뷰(code-review.md)가 "보는 것"이라면 회귀는 "**안 깨졌는지 확인**"이다. 그런데 **이 개발 환경엔 브라우저·
playwright가 없어** AI가 직접 탭을 클릭해 확인할 수 없다. 그래서 회귀는 **두 층**으로 나뉜다 — 각각 누가
언제 도는지 분명히 한다.

## (A) 자동 회귀 — **AI가 매 변경/머지 전 반드시 실행** (헤드리스에서 실제 검증)

```
node scripts/check-index-scripts.mjs   # 문법 · 블록 절단 · </html> · 필수 심볼(핵심 흐름 함수 포함) · 도메인 parity
node scripts/golden-tests.mjs          # 순수함수 16종 행위보존 + stableForHash/_rnComputeHash 해시 잠금
node scripts/check-schema-drift.mjs    # 스키마 드리프트: normalize 필드 ↔ canonical 해시 payload(전파 누락 = parent_id/favorite 급소)
node scripts/sync-instruction-doc.mjs --check   # 내장 지시문 드리프트
```

- **셋 다 CI(push마다)** 실행. **하나라도 실패하면 머지 금지**(AGENTS.md §2 머지 게이트).
- `check-index`의 **필수 심볼**에 탭전환·필터·렌더·추가·노트추가·백업/복원 **핵심 흐름 함수**가 들어 있다
  (`setLibraryMode`·`applyFilters`·`renderFilterControls`·`renderDiseaseFrame`·`showAddTermModal`·
  `openIntegratedNoteModal`·`createCompleteBackupObject`·`applyPendingDataImport`·`readDataImportFile` 등).
  → 리팩토링·삭제로 **탭/저장/가져오기 함수가 사라지거나 리네임되면 CI가 잡는다**(실제 클릭의 정적 대체).
- **JS 로직·데이터·동기화·순수함수를 바꿨으면**: 그 순수함수를 `golden-tests.mjs`에 케이스로 추가(행위보존/특성화)한 뒤 위 명령으로 확인.

## (B) 수동 UI 회귀 — **사용자가 실기기에서** (자동이 못 잡는 시각·상호작용)

헤드리스라 AI는 못 돈다 → **시각/상호작용 변경은 "라이브 렌더 미실행"을 보고하고 사용자에게 실기기 확인을 권한다.**
체크리스트는 **code-review.md §6이 단일 소스**(여기서 중복하지 않는다):

> 일반용어·미생물·약물·공식·질환·노트 탭 열림 · 새 항목 저장/수정 · 검색/필터 · JSON export→import 왕복 ·
> **새로고침 후 데이터 유지** · 라이트/다크 정상 · 모바일 버튼·모달 z-index.

`.github/pull_request_template.md`의 "테스트" 섹션이 이 항목을 담는다.

## 정직한 경계
- AI가 "테스트 통과"라고 할 수 있는 건 **(A) 자동층뿐**이다. **(B)는 사용자 몫** — AI가 "UI 확인함"이라고
  말하지 않는다(거짓 보증 금지, AGENTS.md §5).
- 자동층은 "함수/문법/순수로직/해시가 안 깨졌다"까지만 보증한다. **런타임 상호작용·픽셀은 (B)가 본다.**

## 한 줄
**머지 전 (A) 3명령 통과는 AI의 의무, (B) 실기기 확인은 사용자 몫 — 둘을 섞어 "테스트했다"고 뭉뚱그리지 말 것.**
