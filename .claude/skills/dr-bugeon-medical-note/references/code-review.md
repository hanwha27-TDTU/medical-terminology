# 코드 리뷰 절차 — 단일 HTML · GitHub PR 기반

이 앱은 개인용 의학 학습 앱이며 **당분간 단일 `index.html` 구조를 유지**한다. 이 문서는 그 전제 위에서
PR을 안정적으로 리뷰하는 절차다. 목표는 **기능 안정성·데이터 무결성·저장/복구/동기화 안정성·UI 회귀
방지·연구노트 증거성 유지**다.

- **파일 분리(모듈화)를 기본 답으로 제안하지 않는다.** 단일 HTML 유지가 전제(§AGENTS.md §0).
- **이 체크리스트는 보안 리뷰를 다루지 않는다** — 보안은 별도 `/security-review` 스킬 담당.
  단, **명백한 시크릿 노출·자격증명 하드코딩 같은 건 그냥 지나치지 말고 지적**한다(안전 최소선).
- **CRITICAL ZONE(연구노트/특허 로그/해시체인/canonical 직렬화/TSA)** 은 명시적 요청 없으면 **수정하지
  않고 코멘트만** 한다(불변조건 19).
- 목표는 코드 변경이 아니라 **리뷰 품질**이다.

---

## 0단계 — 자동 게이트 먼저 (사람 눈보다 기계 먼저)

리뷰 시작 전, PR 브랜치에서 **아래 자동검사부터 통과하는지 확인**한다(대부분의 저수준 문제를 여기서 잡는다):

```
node scripts/check-index-scripts.mjs   # 실행 <script> 문법·블록수·</html> 절단·필수 심볼·도메인 parity
node scripts/golden-tests.mjs          # 순수함수 16종(정규화·식별키·매칭·해시 직렬화) 행위보존
node scripts/check-schema-drift.mjs    # normalize 내용 필드 ↔ canonical 해시 payload(전파 누락 급소)
node scripts/sync-instruction-doc.mjs --check   # 내장 지시문 ↔ 원본 드리프트
```

위 검사 전부 CI(`index-scripts-check.yml`·`instruction-doc-sync.yml`)에서 push마다 자동 실행된다. **하나라도 실패하면
그 자체가 Request changes 사유.** 자동검사가 커버하지 못하는 것(데이터흐름·UI 회귀·도메인 parity의 의미적
누락)만 사람이 본다.

---

## 리뷰 흐름 (항상 이 순서)

1. **PR/diff의 목적을 한 문장으로** 정의한다.
2. **변경된 파일·섹션을 식별**한다. (`git diff` 또는 PR files)
3. 변경을 아래 **논리적 영역**으로 분류한다 — ⚠️ 이건 *분류 축*일 뿐, `index.html`이 이 순서로 물리적으로
   정렬돼 있다는 뜻이 **아니다**(재배치는 하지 않기로 결정). 함수는 파일 전역에 섞여 있다.
   `CONFIG/CONSTANTS` · `STORAGE/IDB` · `SUPABASE SYNC` · `DOMAIN(TERMS/DRUGS/FORMULAS/MICROBES/DISEASES/NOTES)`
   · `RESEARCH NOTE/PATENT LOG` · `EXPORT/IMPORT` · `UI RENDER` · `EVENT BINDINGS` · `INIT`
4. 변경이 **어느 데이터 흐름**(저장→복구→동기화→export→import→UI)에 닿는지 추적한다.
5. **실제 버그 / 구조 리스크 / 유지보수 리스크 / UI 회귀 가능성**을 분리해 지적한다(섞지 말 것).
6. 수정이 필요하면 **위치·이유·수정 방향·테스트 방법**을 구체적으로 제시한다.
7. **판정**(아래 3단계 중 하나)으로 끝낸다.

## 단일 HTML 전용 원칙

- "파일 나눠라"를 기본 답으로 제시하지 않는다. 대신 **내부 논리 질서·중복·parity**를 본다.
- **같은 목적의 함수가 여러 위치에 중복 정의**되지 않았는지(단, `type="text/markdown"` 임베드 지시문 블록의
  예제 함수·호이스팅 스텁·패치 래퍼는 정상 — 실행 스코프 중복만 문제).
- **한 변경이 다른 탭을 깨뜨릴 가능성**을 반드시 검토(공용 CSS 광역 선택자·전역 상태·모달 z-index 등).
- 변경량이 큰 PR은 기능별 분리를 권고하되 **단일 HTML 자체를 부정하지 않는다**.

---

## 핵심 체크리스트

### 1. 문법·실행
- [ ] 실행 `<script>` 블록 문법 유효(0단계 `check-index`가 커버).
- [ ] 새 함수/변수/상수명이 기존과 충돌하지 않는가(실행 스코프 기준).
- [ ] 초기화 순서상 아직 정의 안 된 함수/DOM을 먼저 부르지 않는가.
- [ ] async에서 `await` 누락으로 저장·동기화 순서가 깨지지 않는가.

### 2. 데이터 무결성 (상세: storage-sync.md · 불변조건 11)
- [ ] 새 필드가 `normalize*ForStorage`(화이트리스트)에 반영됐는가 — 안 하면 저장·동기화 시 소실.
- [ ] 새 편집 필드가 해당 `canonical*HashPayload`에 포함됐는가(불변조건 11 — 누락 시 동기화가 "일치" 오판. 예: parent_id·favorite).
- [ ] export JSON(`createCompleteBackupObject`)에 포함 + import/restore(`applyPendingDataImport`)에서 복원 — **양쪽 parity**.
- [ ] Supabase push(`*ToRow`)·pull(`rowTo*`) 왕복에 새 필드 포함.
- [ ] 삭제/tombstone/snapshot hash/canonical meta 흐름을 깨지 않는가(불변조건 9·13).
- [ ] 가져오기는 **모드 존중**(비파괴) — merge/append가 기존을 통째 덮어쓰지 않는가(불변조건 20a).
- [ ] **모든 클라우드 WRITE 실패를 표면화하는가**(조용한 유실 금지). `!res.ok`/catch가 사용자 신호 없이 삼키면 안 됨 — 스키마 오류는 `_isCloudSchemaError`→`_warnCloudSchemaError`로 "SQL 실행" 안내. 5도메인뿐 아니라 **연구노트 자동백업(`rnPushOne`)·노트 즉시저장**도 예외 없이(v2.19: 연구노트 자동백업이 조용히 실패하던 급소 정정). "로컬 저장은 됐는데 클라우드는 실패"를 사용자가 알아야 함.
- [ ] **가져오기 id는 제공자(AI/외부)를 신뢰하지 않는가** — 이름 매칭 + 신규는 `next*Id()`(급소: AI가 placeholder id 반복 → 덮어쓰기, v2.20). 6도메인 모두 `next*Id()`(Date.now·고정값 금지). **AI 양식과 앱 동작 일치**(§8.2.2). (상세: import-backup-media.md §8.2.1·8.2.2)

### 3. 도메인 전파(parity) — 반복 결함 1순위 (불변조건 17)
6도메인(TERMS/DRUGS/FORMULAS/MICROBES/DISEASES/NOTES) 중:
- [ ] 한 도메인 전용 기능인가, 공통 기능인가 판별.
- [ ] 공통인데 **일부 도메인에만 반영**된 건 아닌가(해시·tombstone·기기비교·로더·정규화에서 "한 도메인만 빠짐"이 반복 버그).
- [ ] UI엔 보이는데 **저장 안 되는 필드** 없는가 / 저장은 되는데 **검색·필터·복구에서 누락**되는 필드 없는가.

### 4. 노트(핵심 도메인)
- [ ] 개념·오답 노트 필드 구조 유지 · note id 안정 · 저장 후 새로고침 유지.
- [ ] 전체 JSON 백업 포함 + 복원 후 UI 재표시(`applyIntegratedNotesImport`).
- [ ] `normalizeIntegratedNote` 화이트리스트에 새 필드 등록(불변조건 2).
- [ ] 로컬 우선 흐름과 충돌 없는가 · 링크(terms/drugs/microbes/formulas) 4종 충돌판정 유지(불변조건 10).

### 5. 🔴 CRITICAL ZONE — 연구노트/특허 로그 (불변조건 19 · 골든이 잠금)
- [ ] hash chain 순서·`stableForHash` canonical 직렬화·`_rnComputeHash` 제외 목록이 **바뀌지 않았는가**
      → `golden-tests.mjs`가 이걸 잠근다. 골든이 "의도된" 변경으로 실패하면 **전 엔트리 재베이스라인 경보**.
- [ ] append-only 원칙(원본 불변)·ECDSA 서명·TSA 흐름을 깨지 않는가.
- [ ] **실패한 TSA/cloud push가 조용히 지나가지 않고 사용자에게 표시**되는가(v2.15: 스키마 오류 경고).
- **명시적 요청 없으면 이 영역은 수정하지 않고 코멘트만.**

### 6. UI 회귀 (한 수정이 다른 탭을 깰 수 있음)
- [ ] 일반용어·미생물·약물·공식·질환·노트 탭 열림
- [ ] 새 항목 추가 / 기존 항목 수정 / 검색 / 필터
- [ ] JSON export / import / 새로고침 후 데이터 유지
- [ ] 라이트·다크 테마 모두 정상(광역 CSS 선택자 누수·하드코딩 색 주의)
- [ ] 모바일에서 주요 버튼 접근 · 모달/확인창 z-index(트리거 모달보다 위, v2.05)
- (이 환경엔 playwright 없음 → 시각은 "라이브 렌더 미실행" 보고 + 실기기 확인 권고.)

---

## 판정 기준

**Approve 가능** — 목적 명확 · 0단계 자동검사 통과 · 저장/복구/동기화 parity 연결 · UI 회귀 낮음 · CRITICAL ZONE 미변경(또는 변경 근거·검증 명확).

**수정 후 Approve 가능** — 방향은 맞으나 필드 누락·import/export parity 누락·UI 표시 누락 등 **작은 수정으로 안정화 가능**.

**Request changes 필요** — 초기화 붕괴 가능 · 데이터 유실 가능 · 저장은 되나 복원 안 됨 · **CRITICAL ZONE을 근거 없이 변경** · 목적과 무관한 대규모 변경 혼입 · 0단계 자동검사 실패.

---

## 출력 형식 (리뷰 결과)

```
① 변경 목적 (1~3줄)
② 변경 영역 — 파일 / 섹션(논리 영역) / 영향 도메인
③ 주요 문제 (각: 심각도 Critical/High/Medium/Low · 위치 file:line · 문제 · 이유 · 권장 수정 · 테스트 방법)
④ 데이터 흐름 검토 — 저장 / 복구 / 동기화 / export / import / UI 표시
⑤ 회귀 체크리스트 (해당 항목 [ ])
⑥ 최종 판정 — Approve 가능 / 수정 후 Approve 가능 / Request changes 필요 (+ 이유 3줄 이내)
```

> 내장 `/code-review`(작업 diff)·`/review`(GitHub PR) 스킬을 먼저 돌리고, **이 저장소 고유 검토**(도메인 parity·
> CRITICAL ZONE·단일 HTML 회귀)를 위 절차로 덧댄다. 이 문서는 그것들을 대체하지 않고 **관문**으로 보강한다.
