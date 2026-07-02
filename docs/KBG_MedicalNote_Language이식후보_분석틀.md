# KBG_MedicalNote — Language-main 이식 후보 분석 틀 (빈 뼈대)

> **성격:** 소스(Language-main `index.html`)가 도착하면 **빈칸만 채우면 되는** 분석 틀. 이 문서 자체는 코드가 아니며, `index.html`을 변경하지 않는다.
> **범위:** Language-main에서 **실제 사용자 기능으로 구현된 학습 기능만** 식별(§상위 계획서 §7). 시스템 계층(Supabase/백업/연구노트/TSA/.claude/skills/AGENTS.md/테마·AI·device_id)은 **분석 대상 아님** — Medical Note 코어 기준 유지, Language-main은 참고자료로만.
> **소스 상태:** **확보 완료(2026-07-02)** — Language `index.html` + 백업 JSON(2,013 레코드/100 연구노트) + 녹음 ZIP(55개). 데이터 왕복검증 통과.
> **연계 문서:** `docs/KBG_MedicalNote_통합_1차_구조안정화.md`, **`docs/KBG_MedicalNote_Language이식_L1_임포터_왕복검증.md`(데이터 무손실 증명·도메인 모델·단계계획)**

---

## ✅ 소스 도착 후 확정 사실 (L1, 2026-07-02)
- 백업 레코드 **2,013건 전부 동일 16필드 스키마**(변형 0), `learning{level,needCheck,starred,updatedAt}` 100% 커버리지.
- `type`: General 2,006 / Vocabulary 4 / CPX 3 · `subtype`: FRAME 1 / CPX_CASE 3 / 빈값 2,009.
- **왕복검증 2,013/2,013 무손실** (원본→언어도메인모델→원본 byte-identical).
- 녹음 ZIP **55개 전부 recordId로 매칭**, http audio_url 55개와 완전 정합(고아 0). 오디오는 **어학앱 Supabase 폐기 → ZIP을 Cloudinary 재업로드**.
- 연구노트 100건은 **레거시 증거로 격리 보존**(법적효력 유지), 신규 어학기능 증거는 Medical Note 체계로 축적.
- 백업 JSON **UTF-8 BOM** → 임포터 BOM 제거 필수.
- **SQL은 L4에서 단일 마이그레이션 한 방.**

---

## A. 소스 도착 시 작업 순서 (체크리스트)

- [ ] 1. Language-main `index.html`을 접근 가능 위치에 배치(저장소 임시 추가 / 채팅 붙여넣기 / 스코프 확대 중 택1).
- [ ] 2. 아래 §B 표의 각 기능에 대해 **함수명·DOM id·데이터 구조·저장 키**를 원본에서 grep으로 추출해 채운다.
- [ ] 3. §C에서 Medical Note **기존 코어 재사용 여부**를 확정(신규 코드 최소화).
- [ ] 4. §D 이식 난이도/의존성 평가.
- [ ] 5. §E 데이터 스키마 결정(기존 테이블 태그 뷰 vs 신규 테이블 — 신규는 `check-schema-drift` 갱신 필요).
- [ ] 6. 확정 결과를 상위 계획서 §7.1에 역반영 + 연구노트에 착상/방향결정 로그.

**추출 팁(소스 확보 후):** `grep -oE "function [a-zA-Z_]+" language.index.html`, `grep -oE 'id="[a-zA-Z-]+"'`, `grep -oE "localStorage\.(get|set)Item\('[^']+'"`, `grep -niE "회화|문진|OSCE|녹음|IPA"`.

---

## B. 이식 후보 기능 식별표 (빈칸 = 소스 확보 후 채움)

| # | 기능(사용자 지정) | 새 모듈 | Lang 원본 함수(들) | Lang 원본 DOM id | Lang 데이터 구조/저장 키 | Medical Note 흡수 위치 | 재사용 코어(§C) | 이식 난이도 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 일반 회화 | Clinical Language | TBD | TBD | TBD | `AppModules` 회화 뷰 | TTS/카드 | TBD | |
| 2 | 의학 문장 | Clinical Language | TBD | TBD | TBD | 문장 뷰 | 자동링크/TTS | TBD | |
| 3 | 단어장 | Clinical Language | TBD | TBD | TBD | 단어 뷰 | terms 태그 뷰? | TBD | 기존 `medical_terms` 재사용 가능성 검토 |
| 4 | 회화 프레임 | Clinical Language | TBD | TBD | TBD | 프레임 뷰 | 카드/드로어 골격 | TBD | |
| 5 | IPA/발음 | Clinical Language | TBD | TBD | TBD | (문장/단어에 부착) | `speakText`/`ttsSpeed` | TBD | 신규 TTS 만들지 말 것 |
| 6 | 녹음/재생 | Clinical Language | TBD | TBD | TBD | 녹음 뷰 | `MediaRecorder`+Cloudinary | TBD | 녹음 무결성(§storage-sync 15.5) |
| 7 | CPX 문진 문장 | CPX/OSCE | TBD | TBD | TBD | 문진 뷰 | 문장 카드/TTS | TBD | |
| 8 | CPX 증례 | CPX/OSCE | TBD | TBD | TBD | 증례 뷰 | 드로어 골격 | TBD | |
| 9 | OSCE 술기 | CPX/OSCE | TBD | TBD | TBD | 술기 뷰 | 체크리스트 카드 | TBD | |
| 10 | 환자 설명 문장 | CPX/OSCE | TBD | TBD | TBD | 설명 뷰 | 문장 카드/TTS | TBD | |
| 11 | (진료실 대화 시뮬레이션) | CPX/OSCE | TBD | TBD | TBD | TBD | TBD | TBD | 후보 여부 소스 확인 후 판단 |

---

## C. Medical Note 기존 코어 재사용 매핑 (소스 없이 확정 가능)

이식 시 **신규 시스템을 만들지 말고** 아래 기존 코어를 재사용한다.

| 필요 기능 | Medical Note 기존 코어 | 재사용 방식 |
|---|---|---|
| 발음/TTS | `speakText`, `ttsSpeed`, `.speak-btn`, `speakingBtn` | 새 TTS 금지, id는 `speak-<module>-<id>` 규칙 |
| 녹음/재생 | `MediaRecorder.start(200)` + `requestData()` | 끝부분 잘림 방지 패턴 유지 |
| 미디어 저장 | Cloudinary(`uploadImageToCloudinary`/`cloudinaryThumb`) + Edge Function | 녹음/이미지 동일 파이프 |
| 저장 계층 | `scheduleLargeCacheWrite`/`readLargeCacheValue` (IndexedDB+메타) | 신규 도메인도 동일 래퍼 |
| 동기화 | `sbPushAll`/`pullFromCloud`/`syncWithCloud` | 🔴 모드 혼용 금지, 신규 도메인은 canonical 메타 세트 추가 |
| 삭제 | tombstone(소프트삭제) + `pruneOldLocalTombstones`/`getProtectedRecordCounts`/`confirmClearAllProtectedRecords` | 신규 도메인 tombstone 키를 3함수 전부에 등록(불변조건 13) |
| 백업/복원 | `applyPendingDataImport`(append/merge/replace) | 신규 도메인 편입, 미리보기=적용 유지 |
| 무결성 해시 | `computeSnapshotHash`/`canonical*HashPayload` | 신규 도메인 편집필드 전부 포함(불변조건 11) |
| 노트 연결 | `medical_notes` `linked*` + 자동링크 | 언어/CPX 항목도 링크 대상 후보 |
| 라우팅 | 기존 `switchTab`/`setLibraryMode` | 신규 `KBG_MedicalNote.AppRouter`가 호출만 |

---

## D. 빈 메뉴 shell 설계 (소스 없이 확정 가능 — "집의 뼈대")

> 실제 코드 삽입은 다음 단계에서 승인 후. 아래는 additive shell 명세.

### D.1 신규 최상위 메뉴 (기존 라이브러리 모드와 병렬, 초기 비어있음)
```
Clinical Language   → KBG_MedicalNote.AppModules.clinicalLanguage  (하위: 일반회화/의학문장/단어장/회화프레임/IPA·발음/녹음·재생)
CPX / OSCE          → KBG_MedicalNote.AppModules.cpxOsce           (하위: CPX문진/CPX증례/OSCE술기/환자설명)
```

### D.2 shell DOM 규칙
- 신규 컨테이너 id는 `kbg-` prefix(기존 id 충돌·rename 방지): 예 `kbg-clinical-frame`, `kbg-cpxosce-frame`.
- 기본 `display:none`, `AppRouter`가 선택 시 표시.
- 빈 상태 안내 문구("소스 이식 예정" 플레이스홀더)만, 실제 데이터 렌더는 소스 확보 후.

### D.3 라우터 계약 (스켈레톤)
```js
KBG_MedicalNote.AppRouter = {
  routes: {
    dashboard:'', medicalCore:'', clinicalLanguage:'', cpxOsce:'',
    reviewEngine:'', unifiedSearch:'', dataManagement:'', evidence:''
  },
  go(routeKey){ /* 기존 switchTab/setLibraryMode 호출로 위임, 신규 shell은 표시 토글 */ }
};
```
- **원칙:** 라우터는 기존 함수를 **호출만** 한다. 기존 이벤트 핸들러 재바인딩·rename 금지.

### D.4 검증 (shell 삽입 시)
- `node scripts/check-index-scripts.mjs` (블록수·`</html>`·필수 심볼) + `node scripts/golden-tests.mjs`.
- 수동 UI: 다크/라이트 × 모바일(≤600)/태블릿(≤1100)/데스크톱 — 신규 메뉴 가로스크롤 없음.

---

## E. 데이터 스키마 결정 대기 항목 (소스 확보 후)

| 후보 데이터 | 옵션 A(기존 재사용) | 옵션 B(신규 테이블) | 결정 기준 |
|---|---|---|---|
| 단어장 | `medical_terms` + 언어 태그 | 신규 `language_words` | 의학용어와 성격 다르면 B, 겹치면 A |
| 회화/문장/CPX/OSCE | 신규 JSONB 도메인(노트형) | 정규 컬럼 테이블 | 필드 가변성 크면 JSONB(노트형) |
| 녹음 메타 | 기존 이미지 메타 패턴 확장 | — | Cloudinary URL만 저장(바이트 DB 금지) |

> 신규 테이블 채택 시 반드시: SQL 스키마 + `check-schema-drift.mjs` + `*ToRow/rowTo*` + canonical 메타 세트 + tombstone 3함수 + 백업/복원 + 해시 페이로드 + `check-index-scripts` parity 목록까지 **동시 갱신**(도메인 추가 6곳 누락이 최빈 결함).

---

## F. 연구노트 로그 초안 (소스 확보 시 append)
- **[착상]** Language-main 사용자 학습기능(회화/문장/단어장/CPX/OSCE/녹음)만 Medical Note로 이식. 시스템 코어는 Medical Note 단일 유지.
- **[방향결정]** 소스 확보 전엔 뼈대(분석 틀 + shell 설계)만. 시스템 계층은 분석 제외.
- **[코드 기여]** 본 분석 틀 문서 신설, index.html 무변경.
