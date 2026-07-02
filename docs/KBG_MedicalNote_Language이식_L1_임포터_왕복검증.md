# L1 — Language 복원파일 임포터 설계 + 데이터 왕복검증 리포트

> **성격:** 코드(`index.html`) 변경 전, **데이터 무손실을 먼저 증명**하는 설계·검증 문서.
> **원칙(사용자 확정):** ① 학습기능(녹음 포함) 전부 이식 ② 복원 데이터 그대로 이식(호환) ③ 어학앱 폐기, Medical Note로 통합 ④ **SQL은 마지막에 한 방에** 정리 ⑤ 먼저 임포터+왕복검증부터.
> **검증일:** 2026-07-02 · **검증 대상 브랜치:** `claude/medical-note-integration-plan-vstdz3` (최신 main 기준 재시작).
> **연계:** `KBG_MedicalNote_Language이식후보_분석틀.md`, `KBG_MedicalNote_2차_구조고정.md`, `KBG_MedicalNote_상호데이터연결_지도와보존.md`.

---

## 0. 복원파일 실측 (원본 그대로)

| 항목 | 값 |
|---|---|
| 백업 JSON | `Bugeon_LanguageMaster_full_backup_20260702_164616.json` (2.4MB) |
| `format` | `dr-bugeon-language-full-backup` · `version` 2 · `revision` 62 |
| `canonical_version` | `1782872634587-ca781d11-…-f4bfa32ad923` |
| **인코딩** | **UTF-8 BOM 있음** → 임포터는 `charCodeAt(0)===0xFEFF`면 `slice(1)` 필수 |
| `records` | **2,013건** |
| `researchNotes` | **100건** (전부 `project_name='Dr 김부건의 언어 마스터를 위한 여정'`) |
| `review_log` | **비어 있음**(`{}`) |
| 녹음 ZIP | `..._recordings_all_20260628_173436.zip` (3.99MB), 오디오 **55개**(webm 36 + mp3 19) |

### 0.1 레코드 필드 커버리지 — **2,013건 전부 동일 스키마(변형 0)**
16개 필드가 100% 커버리지:
`id, type, subtype, category, situation, uzbek, korean, english, ipa, note, example, date, updated_at, model, audio_url, learning`
`learning` 서브키(100%): `{ level:number(0~5), needCheck:boolean, starred:boolean, updatedAt:string }`

- `type`: **General 2,006 / Vocabulary 4 / CPX 3**
- `subtype`: 빈값 2,009 / `FRAME` 1 / `CPX_CASE` 3
- `id` 형태: UUID 108 / 짧은 id 1,905 (전부 non-empty 문자열 → **id는 문자열로 그대로 보존**, 재발급 금지)
- `audio_url`: http **55** (전부 어학앱 Supabase `rjhbfgbfhwdhtdzcdvtu.supabase.co`) / 빈값 1,958

---

## 1. Medical Note 언어 도메인 모델 (제안, 무손실 상위집합)

원본 16필드를 **손실 없이 흡수** + Medical Note 표준 봉투(envelope)를 기본값으로 부가.
`audio_url ↔ audioUrl`, `updated_at ↔ updatedAt` 리네이밍 외 전부 항등(identity), `learning` verbatim.

```
medLangRecord = {
  id,                                  // 원본 id 문자열 그대로(재발급 금지)
  domain: 'language',                  // ← Medical Note 신규 도메인 태그
  type, subtype, category, situation,  // 분류 → 방 필터(General/Vocabulary/Frame→임상 어학, CPX/CPX_CASE/OSCE→CPX·OSCE)
  uzbek, korean, english, ipa, note, example,   // 다국어 콘텐츠
  audioUrl,                            // = audio_url (L4에서 Medical Note Supabase Storage로 재지정)
  model, date, updatedAt,              // provenance
  learning:{ level, needCheck, starred, updatedAt },   // SRS 상태 verbatim
  deleted:false                        // Medical Note tombstone 봉투(부가·기본값)
}
```

역매핑 `fromMed()`는 `domain`/`deleted`를 떼고 `audioUrl→audio_url`, `updatedAt→updated_at` 되돌려 **원본 16필드 재구성**.

---

## 2. 왕복검증 결과 (증명)

`원본 → toMed() → fromMed() → 원본` 을 2,013건 전부 실행, 키정렬 canonical 문자열로 비교:

| 검증 | 결과 |
|---|---|
| **레코드 왕복 무손실** | **2,013 / 2,013 (mismatch 0)** ✅ |
| ZIP 오디오 파일 수 | 55 (webm 36 + mp3 19) |
| ZIP recordId ↔ 백업 레코드 매칭 | **55 / 55 (미매칭 0)** ✅ |
| http audio_url 레코드(55) 중 ZIP에 존재 | **55 / 55** ✅ |
| ZIP에 있으나 audio_url 빈값(로컬전용) | 0 |
| 고아 ZIP 파일 | 0 |

**결론:** 매핑에서 단 한 필드도 손실되지 않으며, 오디오 소스는 ZIP 55개로 **완전 정합**. → L4 재업로드 매핑은 자명(파일명 `NNN_ID-{recordId}_{slug}.ext`의 recordId → **Medical Note Supabase Storage** 업로드 → 해당 레코드 `audioUrl` 갱신).

---

## 3. 오디오 이관 전략 (L4 — Supabase 통합과 함께)

> **저장소 역할 정의(확정):** **Supabase = 텍스트 + 오디오 녹음(Storage 버킷)**, **Cloudinary = 이미지 + 영상**. 오디오는 Cloudinary가 아니라 Medical Note Supabase Storage로 간다(오디오는 이미지/영상 변환 파이프에서 얻을 게 없고, 텍스트와 같은 백엔드에 두어야 인증·수명주기·백업·삭제(tombstone)가 통일됨).

- 어학앱 Supabase(`rjhbfgbfhwdhtdzcdvtu…`)의 55개 URL은 **앱 폐기 시 깨짐** → 신뢰 불가.
- **유일한 신뢰 소스 = 녹음 ZIP.** ZIP 55개를 **Medical Note Supabase Storage**(예: `language-audio` 버킷)로 재업로드하고 `audioUrl`을 새 주소로 갈아끼운다. 어학앱 Supabase는 폐기.
- 원래 어학앱도 오디오를 자기 Supabase Storage에 뒀으므로 like-for-like 흡수. 오디오/텍스트가 한 백엔드에 모여 "SQL 한방에 통합" 목표와 정합.
- **시점:** 오디오 재업로드·신규 녹음 업로드는 Supabase 작업이므로 **L4(단일 Supabase 통합)에 포함**. L3는 녹음 캡처/재생 UI까지, 영속화는 L4.

---

## 4. 연구노트 100건 — 법적 효력 강화 관점 (사용자 지시 반영)

사용자 지시: *"핵심은 차후 어학앱 기능들에 대한 법적 효력강화."*

- 100건은 완전한 특허급 필드(`entry_hash`/`previous_entry_hash`/`entry_hash_signature`/`tsa_token`/`public_key_jwk`/`invention_dates`/`inventor_*` 등) 보유 = **해시체인 + TSA 증거**.
- **처리 방침:**
  1. **원본 100건은 원래 해시체인 그대로 보존** = 어학앱 시절의 법적 유효성 그대로 유지(읽기전용 레거시 증거).
  2. Medical Note의 `_rnIsOwnProject` 필터는 `project_name` 불일치로 이 100건을 **자기 체인에 섞지 않음**(격리 보장) — 의도된 동작.
  3. **앞으로 Medical Note에서 이식된 어학 기능에 대한 신규 작업**은 Medical Note의 강화된 연구노트 체계(ECDSA P-256 + RFC3161 TSA)로 **새 증거를 축적** → "레거시 보존 + 신규는 더 강한 체계로 커버".
- 🔴 **불변:** `RN_PROJECT_NAME`(= 'Dr. Bugeon의 Medical Note') 및 Medical Note 해시체인/`_rnComputeHash`/`stableForHash`는 **건드리지 않음**. 레거시 100건은 별도 읽기전용 아카이브로만 취급.

---

## 5. 단계 계획 (SQL은 마지막 한 방)

| 단계 | 내용 | index.html 변경 | SQL |
|---|---|---|---|
| **L1 ✅ 완료** | 임포터 설계 + 왕복 무손실 증명 + 오디오 정합 + 연구노트 방침 | 없음 | 없음 |
| **L2 ✅ 완료(v2.52)** | 언어 도메인 저장/모델 확정(`installLanguageDomain` IIFE) — `normalizeLangRecord` 내부모델, IndexedDB large-cache 재사용, tombstone 3함수 등록, 전체 백업 편입, **BOM-aware `importLanguageBackupData`** 실장. **인앱 왕복검증 2013/0** (headless 브라우저에서 실제 백업으로 확인) | 있음(스키마 무관 로직) | 없음 |
| **L3-① ✅ 완료(v2.53)** | 방(임상 어학 / CPX·OSCE) type 필터 렌더 + 검색·상세·전용 📥복원 버튼 + 표준 전체백업 복원 배선(`languageRecords` passthrough). **인앱 확인:** clinical 2010 / cpx 3 / 총 2013, 검색·상세 모달 정상 | 있음 | 없음 |
| **L3-②** | 학습기능 이식(SRS `REVIEW_STEPS`·별표·needCheck·레벨 변경·IPA·녹음 **캡처/재생** UI) | 있음 | 없음 |
| **L4** | 마무리(연결/마인드맵 편입, UI 폴리시) + **오디오 영속화**(ZIP 55개 + 신규 녹음 → **Supabase Storage** 재업로드·`audioUrl` 갱신) + **단일 SQL 마이그레이션 한 방**(신규 도메인 테이블/컬럼 + Storage 버킷 + `check-schema-drift` + `*ToRow/rowTo*` + canonical 메타 + sync) | 있음 | **여기서 1회** |

**게이트:** 각 코드 단계에서 `check-index-scripts` / `golden-tests` / `check-schema-drift` / `check-restore-drift` / `check-version-bump` / `sync-instruction-doc` / `check-skill-docs` 전부 통과.

---

## 6. 임포터 필수 규칙 (실장 시 준수)

1. **BOM 제거**: `if(raw.charCodeAt(0)===0xFEFF) raw=raw.slice(1)` 후 파싱.
2. **id 보존**: 문자열 그대로, 재발급·정규화 금지(짧은 id/UUID 혼재 정상).
3. **learning verbatim**: level/needCheck/starred/updatedAt 값 변형 금지.
4. **audio_url는 L2~L3에선 보존만**, L4에서 **Medical Note Supabase Storage**로 재지정(오디오=Supabase, 이미지/영상=Cloudinary).
5. **researchNotes 100건은 언어 도메인 임포트 경로와 분리** — Medical Note 연구노트 체인에 넣지 않음(레거시 아카이브 전용).
6. **review_log 비어있음** — 없다고 실패하지 말 것(선택 필드).
7. 신규 도메인은 tombstone 3함수/canonical 메타/백업복원/해시 페이로드/`check-index-scripts` parity **6곳 동시 갱신**(도메인 추가 최빈 결함).
