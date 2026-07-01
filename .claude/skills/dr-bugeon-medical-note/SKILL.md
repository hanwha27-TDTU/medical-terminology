---
name: dr-bugeon-medical-note
description: >-
  Dr. Bugeon의 Medical Note 및 Dr. 김부건의 언어 마스터 여정처럼 단일 HTML 파일 +
  localStorage/IndexedDB + Supabase 동기화 + Cloudinary 이미지로 만든 개인용 의학/어학
  학습 앱을 개발·수정·디버그·검증·배포할 때 사용한다. 다룰 수 있는 작업: 단일 HTML 앱 수정
  방법론, IndexedDB/localStorage 저장 계층, Supabase 저장·동기화(일반 동기화 vs 클라우드
  최종본 덮어쓰기 구분, canonical_version, tombstone 소프트삭제), 단권화 노트/오답노트,
  Cloudinary 이미지 업로드·삭제(Edge Function), 검사결과·수치 단위 파서, 백업/복원, Supabase
  SQL 점검, GitHub Pages 배포, 앱 전체 복원. "동기화가 안 맞아요", "삭제한 게 되살아나요",
  "용어/약물/노트 도메인 추가", "최종본 저장", "이미지 업로드/삭제", "Supabase SQL",
  "배포/캐시 문제" 같은 요청에서 호출한다.
---

# Dr. Bugeon Medical Note — 통합 개발 스킬

단일 HTML 파일로 동작하고 **로컬(IndexedDB/localStorage) 우선 + Supabase 기준본(canonical) 동기화 + Cloudinary 이미지**로 구성된 개인용 의학/어학 학습 앱을 개발·수정·검증할 때 사용하는 스킬이다.

## 핵심 원칙 (먼저 기억할 것)

1. **클라우드(Supabase)가 기준 원본**, 로컬은 빠른 화면 캐시다. 저장은 온라인에서 클라우드 성공이 확인될 때만 확정한다.
2. **일반 동기화 ≠ 클라우드 최종본 덮어쓰기.** 두 모드를 절대 섞지 않는다. 일반 동기화는 `canonical_version`을 반드시 읽고 진행한다.
3. **삭제는 소프트삭제 + tombstone.** hard delete 금지 → 다른 기기에서 부활 방지.
4. **이미지 바이트는 DB에 넣지 않는다.** Cloudinary URL/publicId 메타만 저장. 완전삭제는 Supabase Edge Function이 처리.
5. **새 데이터 도메인은 카드 렌더링만으로 끝이 아니다.** 저장/로드·상세·편집·삭제·tombstone·동기화·백업/복원·저장본 버전 확인·SQL까지 같은 수준으로 연결한다. **도메인 변형은 복붙으로 늘어나므로, 한 도메인만 빠지는 누락이 가장 흔한 버그다**(예: tombstone prune·해시 페이로드·기기 일치 비교에서 특정 도메인 누락). 추가/수정 후 `rg`로 전 도메인 참조를 대조한다.
6. **개인용 앱:** 치명적 위험(키 하드코딩, RLS 비활성, 임의 HTML 실행 등)만 보안 지적, 그 외 과도한 보안 리팩토링은 먼저 제안하지 않는다.
7. **항상 결과 보고 + 환경 인식.** 모든 작업은 마지막에 **결과 보고**로 마무리한다(변경·검증·산출물 경로·SQL 변경 여부·지침 업데이트·배포 결과 — `references/agents-rules.md` "완료 보고" 참조). 그리고 실행 환경(데스크톱 vs 모바일/웹)에 맞춰 동작한다(아래 "실행 환경").
8. **유사한 것은 통일·일관성 유지 + 모든 변형(테마·화면폭)을 동시에 고려한다.** 한 곳을 고치면 같은 성격의 다른 모든 곳도 같이 본다 — 이 앱은 도메인·카드·드로어·모달이 복붙으로 늘어나 **한 곳만 바뀌고 나머지가 어긋나는 불일치가 가장 흔한 결함**이다(예: 드로어 개요만 IPA 제거하고 목록 카드는 안 한 v1.22→v1.25, 한 도메인만 토큰별 복사 안 된 v1.21→v1.23, 일반 용어만 복사 하이라이트 클래스가 달랐던 v1.26, 추가 끝화면이 경로마다 달랐던 v1.42). 새 UX 패턴은 **수평 전개**(전 도메인/전 화면)가 기본이고, 공통 동작은 **bespoke 인라인 대신 공용 클래스/함수**(예: `.copyable-text`, `copyTermText`)로 묶어 자동으로 같이 움직이게 한다. 그리고 모든 시각 변경은 **① 다크·라이트 두 테마**(투명도만 다른 색은 한쪽 테마에서 안 보일 수 있음 — `rgba(255,255,255,…)` 같은 테마 종속값 주의, `var(--accent)` 등 토큰 사용), **② 모바일·태블릿·윈도우 세 화면폭**(`≤600px`·`≤1100px`·데스크톱)에서 동시에 성립해야 한다. 한 조건만 보고 끝내지 않는다.
9. **스킬 자동 갱신은 작업 완료의 일부다(사용자가 시키지 않아도 100%·누락 없이).** 모든 작업에서 **새 교훈·규약·실수·패턴·설계결정**이 하나라도 생기면, 그 작업의 PR에 (또는 직후 후속 PR로) **스킬 반영을 반드시 포함**한다 — "스킬 업데이트 해줘"라는 지시를 기다리지 않는다. 이는 definition-of-done이며, 완료 보고의 "지침 업데이트" 항목에 *무엇을 어느 파일에 반영했는지(또는 "이번엔 새 교훈 없음")* 를 명시해 누락을 가시화한다. 반영 위치: UI/UX=`references/ui-features.md`, 동기화·무결성=`storage-sync.md`(+`reconstruction-spec.md` 불변조건), 가져오기/백업·도메인 필드추가=`import-backup-media.md`, 워크플로·회고=`dev-workflow.md` §2.5, 다중에이전트·완료보고=`agents-rules.md`, 교차 원칙은 이 SKILL.md 핵심 원칙. 사소한 변경이라도 **"새 교훈이 있는가?"를 매번 점검**하는 것 자체가 규칙이다.

> **데이터 유실 불변조건(요약):** 동기화·삭제·해시·노트 관련 변경 전에는 `references/reconstruction-spec.md` §10 "불변조건 & 함정"을 반드시 먼저 읽는다. 2026-06 로직 전수감사로 보강된 항목(fence가 로컬 tombstone을 버리면 안 됨, 노트 충돌판정은 linked* 4종 전부 비교, snapshot 해시는 편집 가능 내용 필드 전부 포함, 본문 임베드 이미지 보호집합 포함, 질병 포함 전 도메인 parity)을 그대로 지킨다.

## 실행 환경 (데스크톱 vs 모바일/웹) — 동일 목표, 환경별 동작

이 스킬은 데스크톱(로컬 파일시스템·node·git·PowerShell 있음)과 모바일/웹(Claude 앱·claude.ai — 로컬 도구 없음) 양쪽에서 호출될 수 있다. **"완전히 동일"은 불가능하므로(빌드/배포는 로컬 도구 의존), 환경을 먼저 인식하고 같은 목표를 환경에 맞게 달성한다.**

- **환경 무관(어디서나 동일):** 설계 원칙·7도메인 데이터 모델·`DISEASE_SECTIONS` 등 스키마·UX 판단·콘텐츠/JSON 생성·의사소통 해석 규칙. 모바일에서도 100% 같게 적용.
- **데스크톱 전용(로컬 도구 필요):** 파일 직접 수정(Edit/Write), `node --check` 구문검사, git 클론·배포 스크립트, Windows 절대경로/`node.exe` 경로. → 이런 경로·도구는 **스킬 본문에 하드코딩하지 말고** 사용자 메모리(예: `medical-note-deploy`, JS 검사 도구 메모리)에서 참조.
- **모바일/웹 대체 동작:** 파일을 직접 못 고치므로 ① 수정본 HTML/코드 조각을 **채팅 또는 아티팩트로 출력**, 붙여넣기·import용 블록 제공, ② 구문검사는 **수동 검토**(괄호·따옴표·템플릿 짝)로 대신하고 보고에 "node 미실행" 명시, ③ **배포는 데스크톱에서** 하도록 안내(§install-deploy 8.4). 콘텐츠 축적(외부 생성→붙여넣기) 방침과 잘 맞으므로 모바일은 *설계·콘텐츠·검토* 중심으로 쓰는 게 자연스럽다.
- **첫 행동:** 로컬 파일/도구 접근이 가능한지로 환경을 판단하고, 모바일로 판단되면 위 대체 동작으로 자동 전환한다(사용자에게 "데스크톱에서만 됩니다"라고 거절하지 말고, 가능한 부분을 해주고 나머지는 데스크톱 단계로 넘긴다).

## 작업 전 필수 절차

- 수정 전 실제 코드를 grep으로 먼저 읽고, 문제가 UI / 저장 / 동기화 / 배포 캐시 중 무엇인지 구분한다.
- 단일 HTML 구조는 유지하고, `CSS → HTML → 상태 변수 → 신규 함수 → 기존 함수 호출 1줄` 순서로 점진 수정한다.
- 같은 지점에서 3회 이상 패치 실패 시 해당 섹션/파일을 재작성하고 JS 구문 검사를 한다.
- Supabase 관련 작업은 끝에 **SQL 변경 필요: 있음/없음/불확실**을 반드시 보고한다.

## 검증 원칙 (가볍게, 그러나 확실히)

이 앱은 단일 HTML이 ~1MB로 커서 무거운 검증은 타임아웃 난다. **부하를 낮추되 검증은 빠뜨리지 않는** 순서로 한다.

1. **텍스트·수치 검증을 먼저.** snapshot/DOM 조회와 `evaluate`로 `document.scrollingElement.scrollWidth <= innerWidth`(가로 스크롤 없음), 주요 패널 `getBoundingClientRect()`가 viewport 안인지, 닫기/저장 버튼 가시성, 항목 수/상태를 확인한다. 회귀 판정은 대부분 여기서 끝난다.
2. **스크린샷은 증거용으로 마지막에, 가볍게.** `fullPage` 금지(1MB DOM 전체 reflow→타임아웃). 뷰포트 한 장 또는 특정 요소/`clip` 영역만. 필요시 `timeout` 상향·`animations:'disabled'`.
3. **페이지 로드 대기는 `domcontentloaded` + 구체 DOM 신호**(카드 렌더, 공개 함수, test hook). **`networkidle` 금지** — Supabase REST·YouTube IFrame·Cloudinary·Google Fonts·cdnjs xlsx 때문에 네트워크가 idle이 안 된다. 가능하면 외부 도메인은 route 차단해 빨리 안정화.
4. **막히면 노드 수를 줄인다.** 최소 seed 데이터로 카드 수를 낮추거나 특정 뷰만 렌더 후 검증.
5. 검증 환경 문제로 못 돌렸으면 그 사실을 완료 보고에 남긴다. (상세: [references/dev-workflow.md](references/dev-workflow.md))

## 출력 파일명 규칙

업데이트 HTML 제공 시: `YYMMDD_HH.MM 앱이름_업데이트내역.html` (예: `260626_12.04 Dr. Bugeon의 Medical Note_단권화노트본문이미지삽입.html`). 앱 내 개발자 정보/업데이트 이력에도 같은 버전·변경 내역을 남긴다.

## 참고 문서 (필요할 때 읽기 — progressive disclosure)

작업 종류에 따라 **필요한 문서만** 열어 상세 절차를 확인한다. (development-guide.md는 주제별로 4개로 분할됨)

- **[references/dev-workflow.md](references/dev-workflow.md)** — 개발 워크플로: 최상위 원칙, 작업 전 절차(grep/Playwright), 파일명·배포 규칙, 수정 방법론, 작업 후 검증 체크리스트, 반복 실수 방지, 실행 순서, 최종 기준 문장. **모든 작업의 시작점.**
- **[references/storage-sync.md](references/storage-sync.md)** — 저장 계층 & Supabase 동기화: IndexedDB/localStorage 설계, Supabase 테이블, 동기화 모드 구분(일반 vs 최종본), 삭제 tombstone, pending 복구, Supabase SQL 점검표, 동기화 테스트 시나리오. **저장·동기화·삭제 작업 시 필수.**
- **[references/ui-features.md](references/ui-features.md)** — UI/기능별 지침: 표 편집기, UI/DOM/상태 관리, 테이블 수정, YouTube IFrame/외부 API, 데이터 관리 화면, 검사일별 판정 기준.
- **[references/import-backup-media.md](references/import-backup-media.md)** — 가져오기/내보내기/백업, 녹음 파일 처리.
- **[references/agents-rules.md](references/agents-rules.md)** — 모든 앱개발에 반복 적용하는 전역 필수·금지·완료 보고 규칙(디자인 회귀 방지, 데이터 규칙, 동기화 모드, 로컬 캐시, 패치/quoting/Playwright 검증 원칙 등) + 데이터 유실 회귀 방지(전수감사 일반화).
- **[references/reconstruction-spec.md](references/reconstruction-spec.md)** — 복원용 설계 명세서. 앱 HTML이 전부 사라져도 이 문서로 재구축 가능. 아키텍처, 7 도메인 데이터 모델(용어·약물·공식·미생물·주요 질환·노트 + 학습상태), 저장 계층 키 목록, 동기화 설계, 노트 시스템, 연구노트(특허 증거 로그: 해시 체인·ECDSA 서명·RFC3161 TSA·멀티-앱 격리·끊김 경위 주석 — 불변조건 19), 무결성 해시 함정, 재구축 체크리스트. **§10 불변조건 & 함정은 동기화/삭제/노트 변경 전 필독.**
- **[references/install-deploy-guide.md](references/install-deploy-guide.md)** — 설치·배포 가이드. Supabase 프로젝트/SQL, Cloudinary unsigned preset, Edge Function `delete-cloudinary-image`(코드 포함), GitHub Pages 배포, 오류 해결표, 빠른 복구 절차.

> **스킬 구성:** SKILL.md + 7개 참고문서(dev-workflow, storage-sync, ui-features, import-backup-media, agents-rules, reconstruction-spec, install-deploy-guide) 전체 포함. 모든 문서에는 2026-06-29 로직 전수감사 결과가 `⚠️AUDIT` 주의문구/불변조건으로 반영돼 있다.

## 지침 자동 구분 규칙

작업 중 새 규칙이 생기면: 모든 앱에 적용할 짧은 원칙은 `references/agents-rules.md`에, 이 앱 전용 절차는 주제에 맞는 분할 문서(`dev-workflow` / `storage-sync` / `ui-features` / `import-backup-media`)에 둔다. 완료 보고에 `지침 업데이트: <문서명> / 없음`을 명시한다.
