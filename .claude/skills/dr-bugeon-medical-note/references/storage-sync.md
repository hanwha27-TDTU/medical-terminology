# 저장 계층 & Supabase 동기화

> `dr-bugeon-medical-note` 스킬 참고 문서. 진입점은 상위 폴더의 SKILL.md다.
> **2026-06-29 갱신:** 로직 전수감사 결과를 §4.3·§5.3·§6에 ⚠️AUDIT 주의문구로 반영. 상세 불변조건은 `reconstruction-spec.md` §10 참조.

## 4. 저장 계층 설계

### 4.1 로컬 저장소

권장 로컬 키:

```text
terms
learning_state
tombstones
sync_meta
device_id
```

필수 규칙:

- 저장 전 normalize를 거친다.
- id 중복을 정리한다.
- 삭제 항목은 일반 목록에 넣지 않고 tombstone에 둔다.
- 저장 실패를 조용히 넘기지 않는다.
- 데이터가 커질 가능성이 있으면 IndexedDB로 전환한다. Supabase 기준 앱에서 `localStorage`는 설정, device id, 작은 메타만 담당한다.
- 새 병렬 데이터 도메인을 추가하면 해당 도메인의 active 목록, tombstone 목록, sync meta, 백업/복원 키를 함께 설계한다.
- 앱 시작 시 IndexedDB/localStorage 캐시는 빠른 임시 표시용이며, Supabase 기준본 확인 중임을 토스트나 상태 UI로 구분한다.
- Supabase 직접 저장이 성공하는 구조라면 로컬 캐시 저장 실패는 데이터 유실이 아니라 오프라인/재실행 캐시 실패로 안내한다.
- ⚠️AUDIT(로더 일관성): 각 도메인 로더(`load*FromLocalStorage`)는 동일하게 정규화·dedupe·`deletedAt` 필터를 적용한다. 한 도메인 로더만 dedupe/필터를 빠뜨리면(예: terms 로더만 누락) 구버전·중복 캐시가 그대로 활성 목록에 올라와 개수/ID 발급이 어긋난다.

레코드 id 렌더링 규칙:

- id는 숫자만 가정하지 않는다. Supabase record_id, 백업 복원, UUID 문자열이 들어올 수 있다.
- HTML 문자열 또는 `onclick`에 `${record.id}`를 직접 삽입하지 않는다.
- 인라인 호출이 불가피하면 `JSON.stringify(id)`로 JS 인자를 만들고 HTML attribute escape를 거친다.
- DOM id를 만들 때는 별도 safe id helper를 쓰고, 비교는 `String(id)` 기준 helper로 통일한다.

IndexedDB 패턴:

```javascript
async function initDB(){
  await _migrateFromLocalStorage();
  const data = await _idbGet("sentenceDB");
  _dbCache = Array.isArray(data) ? data : [];
}

function getDB(){
  return _dbCache !== null ? _dbCache : [];
}

function setDB(db){
  _dbCache = db;
  _idbSet("sentenceDB", db).catch(e => showSaveErrorModal(e));
  return true;
}

window.onload = async () => {
  await initDB();
  await initCloudBaselineIfNeeded();
  renderAllViews();
};
```

Dr Bugeon 의학용어 앱에서 대용량 로컬 캐시를 전환할 때의 권장 패턴:

```text
IndexedDB object store: kv
TERMS_STORAGE_KEY                 -> IndexedDB value
DRUGS_STORAGE_KEY                 -> IndexedDB value
TOMBSTONE_STORAGE_KEY             -> IndexedDB value + memory cache
DRUG_TOMBSTONE_STORAGE_KEY        -> IndexedDB value + memory cache
LEARNING_STORAGE_KEY              -> IndexedDB value + memory cache
*_META_KEY / Supabase config / device id -> localStorage 유지
```

구현 원칙:

- 기존 호출부가 많은 `saveTermsToLocalStorage()` 같은 함수명은 유지하되 내부 저장소를 IndexedDB 우선으로 바꾼다.
- `getLearningStateMap()`, `loadLocalTombstones()`처럼 동기 호출이 많은 함수는 앱 시작 시 IndexedDB에서 메모리 캐시로 로드한 뒤 메모리 값을 반환하게 한다.
  - ⚠️AUDIT: 이때 **동기 함수의 lazy fallback이 localStorage를 직접 읽으면 안 된다.** 대용량 캐시 래퍼가 IndexedDB에 쓰고 localStorage 동일 key를 지우므로, lazy localStorage 읽기는 빈/구버전 값을 반환한다(학습상태 유실 위험). 시작 시 메모리 캐시 로드를 보장하고 그 값을 반환한다.
- `loadTermsFromLocalStorage()`와 `loadDrugsFromLocalStorage()`는 async로 바꾸고 `initApp()`에서 `await`한다.
- 기존 localStorage 대용량 값은 첫 로딩 때 IndexedDB로 이관하고, 이관 성공 후 해당 localStorage key를 제거한다.
- IndexedDB를 지원하지 않거나 실패하면 localStorage fallback을 쓰되 저장공간 부족 토스트를 표시한다.
- IndexedDB 실패 fallback을 추가할 때는 온전한 마지막 backup을 빈 세션이나 축소 데이터로 덮어쓰지 않는다. 실패 정보는 `*.backupStatus` 같은 별도 메타에 남긴다.
- 데이터 관리 화면에는 현재 로컬 캐시 백엔드가 `IndexedDB`인지 `localStorage`인지 표시한다.
- SQL 스키마는 로컬 캐시 저장소 전환만으로는 바꾸지 않는다.

### 4.2 Supabase 필수 테이블

`medical_terms` 필수 컬럼:

```text
id bigint primary key
ko text
en text
uz text
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz
```

필요 시 추가 컬럼:

```text
concept_category
category
system_tags
def_ko
def_en
def_uz
usmle
ipa
refs
icd11
fda_drug
rxclass_atc
trials
audio_url
audio_path
```

`language_sync_meta` 필수 컬럼:

```text
key text primary key
value text
updated_at timestamptz
```

필수 메타 키:

```text
medical_terms_canonical_version
```

학습상태 동기화 테이블 예시:

```text
medical_term_learning_state
  term_id bigint primary key
  level integer
  need_check boolean
  favorite boolean
  updated_at timestamptz
```

### 4.3 병렬 데이터 도메인 추가 체크리스트

용어와 별도로 약물, 문장, 퀴즈처럼 새 저장 단위를 추가하면 아래 생명주기 전체를 한 번에 갱신한다.

1. 상수: localStorage key, Supabase table name, tombstone key, hash/meta key, schemaVersion을 정의한다.
2. 정규화: `normalize`, `rowToRecord`, `recordToRow`, 중복 판정, id 발급 규칙을 만든다.
3. 로컬 저장: active 목록 저장/로드와 tombstone 저장/로드/기록을 분리한다.
4. Supabase 저장: load, batch upsert, soft delete를 구현하고 모든 fetch는 `res.ok`를 확인한다.
5. 화면: 목록 카드, 세부 보기, 편집 모달, 삭제 버튼, 빈 상태 메시지를 모두 연결한다.
6. 입력: 추가 폼에서 도메인 선택을 명확히 하고 중복이면 조용히 실패하지 말고 안내한다.
7. 일반 동기화: active 레코드와 tombstone을 모두 병합하고 필요한 경우 클라우드에 upsert한다.
8. 최종본 저장: 현재 기기의 active 레코드를 기준본으로 올리고 클라우드에만 남은 항목은 `deleted_at` 처리한다.
9. 백업/복원: 전체 JSON에 active 목록, tombstone, schemaVersion을 포함하고 replace/merge/append 모두 갱신한다.
10. 진단: 저장본 버전 확인, 항목 수, 삭제 수, hash/manifest 검증, 마지막 저장 기기 표시를 추가한다.
11. SQL: 새 테이블/컬럼/RLS/policy가 필요하면 통합 SQL을 갱신하고 완료 보고에 SQL 변경 필요 여부를 명시한다. SQL 통합본을 만들거나 갱신하면 저장 파일 경로와 함께 최종 답변에 전체 SQL을 `sql` 코드블록으로 제공해 사용자가 바로 Supabase SQL Editor에 복사해 붙여넣을 수 있게 한다.
12. 검증: JS 구문 검사와 `rg`로 새 도메인 이름, table name, localStorage key, tombstone key 참조 누락을 찾는다.
13. ⚠️AUDIT(tombstone 운영 등록): 새 도메인의 tombstone 키를 **오래된 tombstone 정리·보호기록 개수·보호기록 전체삭제·해시 snapshot 페이로드·기기 일치 비교**에도 반드시 등록한다. 이 중 한 곳이라도 빠지면(실제로 질병 도메인이 prune/count/clear 3곳에서 누락됨) 그 도메인만 조용히 잘못 동작한다. 추가 후 `rg`로 6개 tombstone 키가 모든 운영 경로에 나타나는지 대조한다.

Dr Bugeon 의학용어 앱의 약물 도메인 표시명은 `약물명 및 정보`로 통일한다. UI, 토스트, 빈 상태, 업데이트 이력에서 `약물 프레임` 같은 이전 표현을 남기지 않는다.

약물명 및 정보는 기본 카드와 접힌 고급 정보로 나눈다.

- 기본 카드는 성분명/한국어 약물명/상품명, USMLE 계열, 같은 계열 약물명, target, system, 핵심 공식, MOA, 임상 사용, 대표 부작용, USMLE 함정, 3개 언어 정의, 한 줄 암기를 우선 표시한다.
- 고급 정보는 접힌 상태를 기본으로 두고 약물형태, ATC 분류, 투여, USMLE yield, IPA, 병태생리 설명, 금기/주의, API/문헌 출처를 넣는다.
- 약물 추가 화면은 직접 입력과 AI 보강을 모두 지원한다. 직접 입력값은 절대 AI 결과로 덮어쓰지 않고, AI는 사용자가 켠 경우 비어있는 칸만 채운다.
- 같은 계열 약물명은 `same_class_drugs`로 저장하고 추가, 편집, 카드 표시, 검색, Supabase row 변환, SQL 스키마에 모두 연결한다.
- 약물 기본 정보 입력 순서는 USMLE 계열, 약물명(영어), 약물명(한국어), 같은 계열 약물명, 약물형태, Target, 투여방법을 우선한다. 상품명은 기본 입력 화면에서 빼되 기존 `brand_name` 저장 구조와 백업/복원 호환성은 유지한다. ⚠️AUDIT: 상품명 입력칸을 뺀 도메인은 추가 제출 로직이 존재하지 않는 입력(`add_drug_brand`)을 읽으면 안 된다 — 빈 값 강제 + API fallback 무력화. 추가 시 brand는 비워둔다.
- ⚠️AUDIT(API 보강 텍스트 분해 주의): RxClass/ATC 분류명 같은 외부 API 텍스트를 기존 칸에 합칠 때 `,`로 분해하면 "HMG CoA reductase inhibitors, plain"처럼 콤마 포함 분류명이 쪼개진다. 항목 구분자는 ` · `/`;` 위주로 두고, 콤마는 항목 내부 문자로 보존한다.

`medical_drugs`를 쓰는 경우 권장 필드는 다음과 같다.

```text
id
generic_name
ko_name
brand_name
drug_class
same_class_drugs
drug_form
atc_class
target
route
category
system_tags
usmle_yield
ipa
definition_ko
definition_en
definition_uz
causal_chain
why
moa
clinical_uses
adverse_effects
precautions
usmle_strategy
memory_line
refs
created_at
updated_at
deleted_at
```

---


## 5. 동기화 모드 구분

### 5.1 일반 자동/수동 동기화

목적은 평소 추가·수정·삭제를 기기 간 전파하는 것이다.

필수 절차:

1. 클라우드와 로컬을 모두 읽는다.
2. `canonical_version`을 반드시 읽는다.
3. `canonical_version` 읽기 실패 시 일반 병합을 중단한다.
4. 같은 id는 `updated_at` 기준으로 비교한다.
5. 삭제 tombstone은 활성 레코드보다 별도 우선순위로 판정한다.
6. 병합 결과를 로컬에 저장한다.
7. 클라우드에는 전체 병합본을 무조건 덮어쓰지 말고, 실제 변경 후보만 upsert/PATCH 한다.

절대 금지:

- `canonical_version` 없이 병합 진행
- 앱 시작 직후 클라우드 전체 덮어쓰기
- 신규 기기 첫 접속에서 클라우드 쓰기
- 클라우드 삭제 표시보다 오래된 로컬 활성 항목을 우선
- 최종본 기준 시각보다 오래된 로컬 전용 항목을 새 항목처럼 업로드

### 5.2 앱 시작 시 동기화

앱 시작 시는 가장 보수적으로 처리한다.

- 신규 기기 또는 `canonical_version` 불일치 기기는 클라우드를 받기만 한다.
- 클라우드 기준을 로컬에 반영한다.
- 이 단계에서는 `sbBatchUpsert(merged)` 같은 전체 업로드를 하지 않는다.
- 로컬 전용 항목이 있어도 최종본 기준 시각보다 오래된 항목은 업로드 후보가 아니다.

> ⚠️AUDIT(부분 로드 시 `canonicalVersion` 전진 금지 — v1.06): `canonicalChanged` 분기에서 일부 도메인(약물·공식·미생물·질환) 클라우드 로드가 실패(`canSync*=false`)하면 그 도메인 적용은 건너뛰는데, **그래도 `canonicalVersion`을 저장하면 안 된다.** 저장하면 실패한 도메인은 새 기준본을 영영 적용받지 못하고(다음부터 `canonicalChanged=false`), 다음 일반 병합에서 오래된 로컬 데이터가 fence를 통과해 **재업로드(부활)** 된다. → **모든 동기 대상 도메인이 정상 로드됐을 때만(`allDomainsLoaded`) `canonicalVersion`을 전진**시키고, 아니면 보류해 다음 동기화에서 재적용(멱등)되게 한다. 부분 적용 시 토스트도 "일부 도메인 보류"로 구분한다.
> ⚠️AUDIT(같은 가드를 "클라우드 최종본→로컬 적용(pull/overwrite)" 경로에도 — v1.37): 위 가드는 일반 동기화(`syncWithCloud`)뿐 아니라 **클라우드 기준본을 로컬에 덮어쓰는 pull 경로**에도 똑같이 필요하다. 이 경로는 도메인별 `cloudX===null`이면 해당 배열을 그대로 두고 넘어가는데, 그 뒤에서 무조건 `canonicalVersion`을 저장하면 위와 동일한 부활이 생긴다(v1.37 전수점검에서 발견). 두 경로 모두 `allDomainsLoaded`로 게이트한다.

> ⚠️AUDIT(snapshot 해시는 "편집 가능한 모든 필드"를 포함 — v1.37): §13은 tombstone 키 누락을 다루지만, **새로 추가한 일반 필드도 `canonical*HashPayload`에 반드시 넣어야 한다.** 빠지면 그 필드만 다른 두 항목이 같은 해시 → "저장본 버전 확인"·기기 일치(`localMatchesCloud`)가 **거짓 "일치"** 를 보고(실제로 v1.36 `finding_type`(용어), `refs`(미생물·질환), 오답노트 필드+`images`(노트)가 누락됐다 v1.37에 보강). 규칙: 도메인/노트에 편집 필드를 더하면 normalize·row 매핑·**해시 payload**·충돌판정(`noteContentDiffers`)을 **한 세트로** 갱신하고, 해시 payload는 그 도메인의 충돌판정과 **동일 필드셋**을 유지한다. 해시 payload가 바뀌면 저장본 해시가 1회 재베이스라인된다(손상 아님 — 완료 보고에 명시).

```javascript
const isNewDevice = !localVersion;

if (isNewDevice || versionMismatch) {
  const merged = mergeByLatest(localRecs, cloudRecs, {
    preserveLocalOnly: false,
    mode: "cloudBaselineApply"
  });
  setDB(merged);
  setLocalCanonicalVersion(cloudVersion);
  return; // 클라우드 쓰기 금지
}
```

### 5.3 일반 동기화에서 로컬 전용 항목 처리

일반 동기화에서 로컬 전용 항목은 다음 조건을 모두 만족할 때만 업로드 후보가 된다.

- 현재 `canonical_version` 이후 **생성**됨 (구현은 `createdTime > canonicalTime && updatedTime > canonicalTime`)
- id 형식이 정상임
- 삭제 tombstone과 충돌하지 않음
- 클라우드에 더 최신 삭제 표시가 없음

> ⚠️AUDIT(의도된 보수 fence — "수정만 이후"로 넓히지 말 것): 이 조건은 사실상 **"기준본 이후 생성된 진짜 신규"** 만 통과시킨다(`createdAt`은 불변, 신규면 `updatedAt`도 자동으로 이후). 외부 리뷰가 "기준본 이후 생성 *또는 수정*(OR=`updatedTime > canonicalTime`)으로 넓혀야 한다"고 지적할 수 있으나, **의도적으로 거부한다**: `updatedAt`은 정규화·마이그레이션·해시 재계산으로 흔들릴 수 있어, OR로 넓히면 *다른 기기 기준본에 없던 오래된 로컬 항목*이 사소한 touch만으로 부활(재업로드)된다. 이 앱의 1순위 적은 부활이므로 `createdAt` 기반 AND를 유지한다. 트레이드오프(다른 기기 기준본에 없던 옛 로컬 항목을 이후 실제 수정해도 제외됨)는 UI 경고 "이 기기에 없는 항목은 제외될 수 있습니다"와 일치하는 의도된 동작이다.

> ⚠️AUDIT(fence는 활성 항목에만 적용 — 삭제기록은 통과): 위 "기준본 이후 생성/수정" 필터(fence, `filterLocalRowsAfterCanonicalFence`)는 **활성 행에만** 적용한다. 로컬 tombstone(삭제기록)을 "기준본 이후" 조건으로 같이 걸러내면, 기준본 이후의 삭제가 병합에 도달하지 못해 클라우드 활성본이 승자가 되고 **삭제 항목이 부활**한다. 구현에서 `if (row.deletedAt) return false;`를 타임스탬프 비교보다 먼저 두면 정확히 이 버그가 난다 → tombstone은 fence를 무조건 통과시키고 병합 우선순위(§6)로 처리한다.

outbox 처리 원칙:

- `flushOutbox()`는 실행 중 재호출되면 `true`를 즉시 반환하지 말고 현재 `flushPromise`를 반환해 실제 완료/실패를 기다린다.
- `sessionUpsertGuarded()`에서 원격 `updated_at` 또는 `deleted_at`이 더 최신이면 성공 처리로 outbox를 제거하지 않는다. `lastSyncConflict` 같은 메타를 남기고 사용자에게 보류 상태를 알린다.
- `enqueueAll()`은 삭제된 세션을 다시 session upsert 후보에 넣지 않는다.
- `applyRemoteSettings()`나 원격 profiles 교체 후에는 `ensureActiveProfile()`를 호출해 `activeId`가 실제 프로필을 가리키도록 보정한다.
- 사용자가 최종본 교체 모드가 아닌 일반 동기화를 실행 중임

```javascript
const uploadCandidates = localOnlyRecs.filter(r =>
  isValidId(r.id) &&
  isAfterCanonicalBaseline(r.updated_at) &&
  !isKilledByCloudTombstone(r)
);

if (uploadCandidates.length > 0) {
  await sbBatchUpsert(uploadCandidates);
}
```

### 5.4 클라우드 최종본 덮어쓰기

목적은 현재 기기 데이터가 정답이라고 선언하는 것이다. 이것은 일반 동기화가 아니다.

절차:

1. 전체 JSON 백업을 자동 생성하거나 강하게 권장한다.
2. `pendingCanonicalVersion`을 생성한다.
3. `pendingCanonicalStatus`, `pendingCanonicalAt`, `pendingCanonicalCount`를 로컬에 저장한다.
4. 현재 기기 활성 데이터를 클라우드에 upsert한다.
5. 클라우드에는 있는데 현재 기기에 없는 항목은 `deleted_at`으로 soft delete한다.
6. 모든 데이터 저장이 성공한 뒤에만 `language_sync_meta.medical_terms_canonical_version`을 갱신한다.
7. pending 상태를 제거한다.
8. 다른 기기는 이 `canonical_version` 변화를 감지하면 로컬 전용 항목을 보존하지 않고 클라우드 기준으로 맞춘다.

주의 문구:

```text
현재 기기 데이터로 클라우드 최종본을 덮어씁니다.
현재 기기에 없는 항목은 다른 기기에 남아 있어도 최종본에서 제외될 수 있습니다.
계속하기 전 전체 JSON 백업을 권장합니다.
```

덮어쓰기 버튼 근처에는 반드시 `저장본 버전 확인` read-only 기능을 둔다.

확인 항목:

- Supabase URL과 활성 저장 테이블
- `language_sync_meta`의 `state.revision`, `state.canonical_version`, `updated_at`
- `language_snapshot_manifest`의 `record_count`, `created_at`, `created_by_device`
- 활성 기준본을 다시 읽은 실제 항목 수
- manifest의 `payload_hash`, `record_ids_hash`와 실제 기준본 재계산 결과 일치 여부
- 현재 기기 ID와 현재 화면 로컬 캐시 항목 수

버전 확인 기능은 Supabase에 쓰기 작업을 하면 안 된다.

기기 표시는 UUID만 노출하지 않는다.

저장 시 manifest에는 사람이 읽을 수 있는 기기 라벨을 함께 남긴다. 예:

```text
PC · Windows · Chrome · id ab12cd34
Tablet · iPadOS · Safari · id ab12cd34
Phone · Android · Chrome · id ab12cd34
```

구현 원칙:

- `navigator.userAgent`, `navigator.userAgentData`, 화면 크기/터치 여부를 조합해 PC/Tablet/Phone을 추정한다.
- OS는 Windows/macOS/iPadOS/iOS/Android/Linux 정도로 표시한다.
- 브라우저는 Chrome/Edge/Safari/Firefox 정도로 표시한다.
- 기기 종류와 OS 추정은 100% 정확하지 않으므로 짧은 stable device id를 항상 붙인다.
- 기존 manifest가 UUID만 가진 경우에는 “구버전 저장본 · 기기 라벨 없음 · id ...”처럼 표시한다.
- “기준본을 저장한 기기”와 “지금 접속한 기기”를 명확히 구분해서 표시한다.

### 5.5 클라우드 최종본으로 이 기기 교체

목적은 이 기기의 로컬 전용 변경을 버리고 클라우드 기준으로 맞추는 것이다.

동작:

- 클라우드 활성 항목만 로컬 목록에 반영한다.
- 클라우드 삭제 항목은 tombstone에 반영한다.
- 학습상태는 클라우드 기준으로 교체한다.
- 로컬 `canonicalVersion`을 갱신한다.
- 로컬 전용 항목을 보존하지 않는다.

---

### 5.6 append-only 도메인(연구노트) 동기화 — 사후 부착 필드 fill-if-empty (v1.82~1.83)

연구노트(`research_notes`)는 일반 도메인과 **동기화 규칙이 다르다**. 원본 불변·append-only라 "덮어쓰기/교체" 개념이 없고, id 기준 **union 병합**(기존 삭제 없음)만 한다. 상세 구현은 ui-features.md §10.6.9(클라우드 백업 항목) 참조. 동기화 관점 핵심만:

- **union 병합의 함정:** "로컬에 없는 id만 추가"만 하면, 한 기기에서 나중에 붙인 **공인 타임스탬프(TSA)·전자서명·server_time**이 그 기록을 이미 가진 다른 기기로 **전파되지 않는다**(v1.82에서 실제 버그). 사용자 증상: "윈도우에서 타임스탬프 받아도 태블릿에서 또 받아야 함."
- **해결 원칙 — fill-if-empty:** 이미 있는 로컬 기록에 대해 **원문·`entry_hash`는 절대 병합 대상이 아니고**, `_rnComputeHash`에서 **제외되는 "사후 부착" 필드만**(tsa 그룹·server_time·서명 그룹) **로컬이 비었을 때만** 클라우드 값으로 채운다. 이 필드들은 해시에 안 들어가므로 채워도 검증 영향 0. 기존 값은 **덮지 않는다**(기기별로 따로 받은 토큰=같은 해시의 복수 유효 도장, 무해).
- **자동 전파(v1.83):** 연구노트 열 때 `_rnAutoSync()`(fire-and-forget, 20초 throttle)로 자동 pull → 사용자가 "합치기" 버튼을 안 눌러도 토큰이 내려온다. added/enriched 있을 때만 toast.
- **일반화 교훈:** append-only 도메인에서 "생성 후 다른 기기가 붙이는 부가 증거(타임스탬프·서명 등)"가 있으면, 병합은 **신규 id 추가 + 기존 id의 해시-제외 필드 fill-if-empty** 두 갈래로 설계한다. 해시/원문에 들어가는 필드는 절대 병합하지 않는다(불변성 보장).

#### 5.6.1 ⚠️AUDIT 멀티-앱 테이블 공유 오염 → 프로젝트 격리 + 전용 테이블 (v2.03)

이 앱과 자매 앱(어학 마스터)이 **같은 Supabase 테이블 `research_notes`를 공유**해, 각자의 연구노트에 상대 앱 기록이 섞여 들어왔다. 각 엔트리에 `project_name`이 박혀 있었지만 **아무도 그걸로 거르지 않은 것**이 급소. 증상: 목록·총 건수·내보내기(CSV/JSON/MD)·공개 해시 매니페스트가 오염되고, 특히 **해시 체인 `previous_entry_hash`가 남의 엔트리를 물어** 새 기록의 체인이 꼬였다(진행형 오염).

- **근본 원인 2겹:** ① 테이블 이름이 두 앱 모두 `research_notes`(물리적 1저장소 공유) ② `rnPull`/`_rnLoad`가 `project_name`을 안 걸러 전 행을 취급.
- **조치(옵션 A = 전용 테이블 분리):**
  - `RN_PROJECT_NAME`(불변·고유, `Dr. Bugeon의 Medical Note`)을 **스탬프·필터 공용** 상수로. `rnAddEntry`가 이 상수로 `project_name`을 박고, `_rnIsOwnProject(e)= e.project_name===RN_PROJECT_NAME || !e.project_name`(옛 무명 기록은 관대하게 자기 것).
  - **`_rnLoad`를 단일 관문으로 필터** → 렌더·집계·검증·체인 prev·내보내기·`_rnManifest`·`_rnEnsureGenesis`·중복검사 전 경로가 자동 격리. `rnPull` incoming도 같은 필터로 **남의 행을 애초에 로컬에 안 씀**. 섞여 저장됐던 남의 행은 다음 `_rnSave` 때 자동 정리(내 기록 유실 0).
  - **전용 테이블 `research_notes_med`로 이사**(`RESEARCH_NOTES_TABLE` 변경) + `RESEARCH_NOTES_TABLE_LEGACY='research_notes'`. `rnMigrateToOwnTable()`이 첫 실행 때 옛 공유 테이블에서 **자기 프로젝트 행만** 회수→union 병합→전용 테이블 push(옛 테이블 **안 지움**·무손실). 완료 플래그 `RN_MIGRATED_KEY`(기기별). 전용 테이블 미생성(SQL 미실행)이면 push 실패→플래그 미설정→다음 열람 재시도.
  - **부트스트랩 순서가 중요**: `_rnBootstrapNotebook`은 로컬 즉시 렌더 → (클라우드 있으면) 마이그레이션 → **제네시스는 이관 완료(플래그 set) 뒤에만** → 재렌더 → autoSync. 신선한 기기에서 옛 기록을 못 받은 채 새 genesis를 찍는 **중복 제네시스 사고**를 막는다.
  - **연결 지점 전부 동반 수정(도메인 parity처럼):** `computeSchemaDrift`·`checkLiveSchema` 테이블명, 백업 실패 토스트 문구, 임베디드 `SUPABASE_SCHEMA_SQL`(새 테이블 DDL), **CI `scripts/build-research-manifest.mjs`**(테이블+project 필터). 한 곳만 놓치면 "컬럼 없음" 오탐·매니페스트 오염이 재발.
  - **정리 SQL은 복사 전용:** `rnCopyLegacyCleanupSql()`은 **전용 테이블로 이관된 내 행만**(`exists`) + **내 `project_name`만** 지우는 가드형 DELETE를 클립보드로 준다(자동 실행 금지·미리보기 count 후 직접 실행). 이관 전이면 0건, 자매 앱 행 불건드림.
- **불변성 존중(소급 수정 금지):** 오염 시기 과거 엔트리의 `previous_entry_hash`가 숨겨진 남의 엔트리를 가리켜 검증 시 `chain_break`가 뜰 수 있으나, 엔트리는 불변(해시에 prev 포함)이라 **고치지 않고 오염의 흔적으로 둔다** — 격리 이후 새 기록부터 정상.
- **일반 교훈:** 여러 앱이 한 백엔드를 공유할 때 `project_name` 같은 소유 태그는 **박기만 하면 무의미** — **읽기 관문(_rnLoad)·pull·매니페스트·마이그레이션 모두에서 필터**해야 격리다. "우연히 안 섞임"(상대가 먼저 이사)과 "설계상 격리"는 다르다. 소유키는 스탬프와 필터가 **같은 불변 상수**를 공유해야 한다(APP_INFO.name 같은 가변값에 묶으면 향후 리네임에 과거 기록이 숨겨짐).

---


## 6. 삭제 동기화 원칙

삭제는 hard delete로 끝내지 않는다.

필수:

- 삭제 시 `deleted_at` 기록
- 삭제 시 `updated_at = deleted_at`
- 로컬 tombstone 저장
- 클라우드 soft delete PATCH
- 가능하면 `deleted_by_device`, `canonical_version`도 기록

병합 우선순위:

1. 클라우드 삭제 표시가 있으면 다른 기기의 오래된 로컬 활성 항목보다 우선한다.
2. 로컬 tombstone이 클라우드 활성 항목보다 최신이면 삭제를 우선한다.
3. 클라우드에서 명시적으로 복원된 항목이 로컬의 오래된 tombstone보다 최신이면 복원을 우선한다.

> ⚠️AUDIT(삭제 부활 HIGH): 위 우선순위가 성립하려면 로컬 tombstone이 **병합 함수까지 도달**해야 한다. 동기화 전처리(fence)가 tombstone을 미리 버리면 우선순위 로직이 무력화되어 삭제가 부활한다(§5.3 참조). 회귀 테스트 §15.1 필수.

휴지통 규칙:

- 휴지통 목록 비우기는 화면에서 숨기는 작업으로 설명한다.
- tombstone 자체 삭제는 고급 정리 기능으로 분리한다.
- tombstone을 너무 빨리 지우면 다른 기기의 옛 데이터가 살아날 수 있다.
- ⚠️AUDIT(도메인 parity): tombstone 정리(`pruneOldLocalTombstones`)·보호기록 개수(`getProtectedRecordCounts`)·전체삭제(`confirmClearAllProtectedRecords`)는 **용어·약물·공식·미생물·질병·노트 전 도메인**을 처리해야 한다. 현재 질병 tombstone이 이 3곳에서 누락되어 영구 잔존·미집계된다. 도메인 추가/수정 시 이 3함수를 함께 점검한다.

---


## 7. pending 상태와 실패 복구

최종본 덮어쓰기 중 실패하면 일반 동기화를 막아야 한다.

필수 로컬 pending 키:

```text
pendingCanonicalVersion
pendingCanonicalStatus
pendingCanonicalAt
pendingCanonicalCount
```

복구 규칙:

- pending 상태가 남아 있으면 일반 동기화를 막는다.
- 클라우드 `canonical_version`이 로컬 `pendingCanonicalVersion`과 같으면 실제 저장은 완료된 것으로 보고 pending을 자동 해제할 수 있다.
- pending 버전과 클라우드 버전이 다르면 자동 해제하지 않는다.
- 사용자에게 `상태 재확인` 또는 `로컬 잠금만 해제`를 명시적으로 선택하게 한다.

---


## 14. Supabase SQL 점검표

Supabase SQL Editor에서 마지막 진단 SELECT는 아래 조건을 확인해야 한다.

```text
medical_terms_has_primary_key = true
deleted_at_ready = true
canonical_meta_ready = true
```

추가 확인:

```sql
select count(*) from public.medical_terms where deleted_at is null;
select count(*) from public.medical_terms where deleted_at is not null;
select * from public.language_sync_meta where key = 'medical_terms_canonical_version';
```

새 데이터 도메인이나 병렬 테이블을 추가했다면 해당 테이블의 primary key, `created_at`, `updated_at`, `deleted_at`, RLS/policy, meta key 진단 SELECT도 같은 방식으로 추가한다.

> v4.55부터 도메인이 7종이다. 위 점검을 `medical_drugs / medical_formulas / medical_microbes / medical_diseases / medical_notes`에도 동일 적용한다. 특히 **`medical_diseases`(주요 질환)**: 플랫 핵심 컬럼 + `body jsonb` 하이브리드, canonical 키 접두사 `medical_diseases_…`, tombstone 키 `kma_medical_terms_v2_disease_tombstones`, schema-init seed에 `medical_diseases_canonical_version` 포함, 진단 SELECT에 `medical_diseases_has_primary_key / disease_deleted_at_ready / disease_body_ready / disease_canonical_meta_ready`.

SQL 변경 판단:

- 새 Supabase 테이블, 컬럼, 인덱스, RLS/policy, Storage policy가 필요하면 `SQL 변경 필요: 있음`.
- localStorage key, UI, 백업 JSON 구조, 저장본 버전 표시만 바뀌고 Supabase 스키마가 그대로면 `SQL 변경 필요: 없음`.
- 코드가 참조하는 컬럼/테이블이 실제 Supabase에 있는지 확인하지 못했으면 `SQL 변경 필요: 불확실`.

해석:

- `medical_terms_has_primary_key = false`: upsert가 안정적으로 작동하지 않는다.
- `deleted_at_ready = false`: 삭제 동기화가 불가능하다.
- `canonical_meta_ready = false`: 최종본 기준 동기화가 불가능하다.
- canonical row 없음: 최종본 덮어쓰기가 아직 완료되지 않았거나 메타 저장이 실패했다.

---


## 15. 테스트 시나리오

저장·동기화 변경 후 최소 아래를 확인한다.

### 15.1 삭제 부활 방지

1. PC에서 A 항목 삭제
2. 클라우드에 `deleted_at` 저장 확인
3. 태블릿에 A 항목이 오래된 로컬 활성 상태로 남아 있다고 가정
4. 태블릿 일반 동기화 실행
5. A가 살아나지 않아야 한다.

> ⚠️AUDIT 보강: **기준본 이후에 삭제한 항목**(로컬 tombstone이 canonical fence 시각보다 최신)도 위 시나리오로 확인한다. fence가 tombstone을 버리지 않는지(§5.3) 회귀 검증의 핵심 케이스다.

### 15.2 최종본 교체

1. PC 600개를 클라우드 최종본으로 덮어쓰기
2. 태블릿 로컬 1000개 상태에서 동기화
3. 태블릿은 600개가 되어야 한다.
4. 태블릿의 오래된 400개가 클라우드에 다시 올라가면 실패다.

### 15.3 기준본 이후 신규 추가

1. 최종본 생성 후 태블릿에서 새 항목 B 추가
2. 일반 동기화 실행
3. B는 클라우드에 올라가야 한다.
4. 기준본 이전부터 태블릿에 있던 항목 C는 올라가면 안 된다.

### 15.4 pending 복구

1. pending 상태가 남아 있는 상황을 재현한다.
2. 클라우드 `canonical_version`과 pending version이 같으면 자동 해제한다.
3. 다르면 자동 해제하지 않고 사용자 확인을 요구한다.

### 15.5 녹음 연결 무결성

1. 문장 저장 성공 후 녹음 업로드를 연결한다.
2. 녹음 업로드 성공 후 문장 연결 저장 실패를 재현한다.
3. 고아 파일이 정리되는지 확인한다.
4. 문장에는 있는데 Storage 파일이 없는 상태가 진단되는지 확인한다.

### 15.6 가져오기 안전성

1. 오래된 TSV 백업을 가져온다.
2. 기존 최신 항목이 오래된 표현으로 덮이지 않아야 한다.
3. 깨진 ID가 들어오면 새 ID로 교체되어야 한다.
4. 빈 보강 필드가 기존 보강 필드를 지우면 안 된다.

### 15.7 단독 필드 수정 전파 (⚠️AUDIT 신규)

1. 한 기기에서 미생물의 `ipa`만, 또는 공식의 `tags`만 수정한다.
2. 최종본 저장 또는 일반 동기화 실행.
3. 다른 기기에서 그 변경이 반영되는지 확인한다(snapshot 해시 페이로드 누락 시 전파 안 됨 — §5.3).

### 15.8 노트 링크 편집 보존 + 충돌 사본 과양산 방지 (⚠️AUDIT · v1.04 갱신)

배경: 링크 4종(`linkedTerms/Drugs/Microbes/Formulas`)은 **본문에서 자동 파생되는(+선택적 수동)** 배열이다. 과거엔 `noteContentDiffers`(충돌 사본 트리거)가 이 4종을 비교했는데, 용어 수정·앱 버전 변경(자동링크 로직 수정)·**여러 탭 동시 사용**으로 텍스트가 같아도 링크가 달라지면 **불필요한 "(충돌 사본)"이 양산**됐다(실사용 발생).

**현재 설계(v1.04):** 충돌 판단은 **사용자 작성 내용만**(제목·본문·요약·keyPoint·comparison·태그·MCQ·이미지 등)으로 한다. 링크 4종은 충돌 트리거에서 제외하고, 대신 `mergeIntegratedNotesForSync`에서 클라우드+로컬 활성본의 링크를 **합집합(`mergeNoteLists`)으로 보존**한다 → 수동 링크 편집 포함 어느 쪽도 잃지 않는다.

검증:
1. 기기 A에서 노트의 링크만 수정(또는 용어를 고쳐 자동링크가 달라지게).
2. 기기 B가 같은 노트를 더 최신 `updatedAt`으로 들고 동기화.
3. 텍스트가 같으면 **충돌 사본이 생기지 않고**, 합쳐진 노트의 링크에 A·B 양쪽 링크가 **모두 들어있는지**(합집합) 확인한다.
4. 텍스트(본문 등)가 실제로 다르면 그때는 "(충돌 사본)"으로 보존되는지 확인한다.

주의: `canonicalNoteHashPayload`에는 링크가 그대로 들어가므로, 합집합 병합으로 링크가 바뀌면 "저장본 버전 확인"이 1회 어긋날 수 있다(해시 변경 = 1회 재베이스라인, 손상 아님).

### 15.9 부분 도메인 로드 실패 시 기준본 전진 차단 (⚠️AUDIT · v1.06)

1. 약물(또는 공식/미생물/질환) 테이블 로드가 실패하는 상황을 만든다(예: 통합 SQL 미실행 또는 일시적 네트워크 실패) + 클라우드 `canonical_version`이 로컬과 다른 상태.
2. 동기화를 실행한다. 실패 도메인은 적용을 건너뛰고, 토스트가 "일부 도메인 보류"로 뜨는지 확인.
3. **로컬 `canonicalVersion`이 전진하지 않았는지** 확인한다(저장본 버전 확인).
4. 실패 도메인을 정상화(SQL 실행/연결 복구) 후 다시 동기화하면, `canonicalChanged`가 다시 잡혀 그 도메인까지 기준본이 적용되고 그제서야 `canonicalVersion`이 전진하는지 확인.
5. 회귀 신호: 부분 실패인데도 `canonicalVersion`이 올라가면 → 실패 도메인의 오래된 로컬 데이터가 다음 일반 병합에서 재업로드(부활)된다.

### 15.10 연구노트 사후 부착 필드 기기간 전파 (⚠️AUDIT · v1.82~1.83)

1. 기기 A·B가 같은 연구노트 기록(같은 id·`entry_hash`)을 갖고 있게 한다(A에서 만들고 B가 pull).
2. **기기 A에서만** "⏱️ 공인 타임스탬프 받기"(또는 저장 시 자동) → A의 기록에 `tsa_token`이 붙고 클라우드에 push된다.
3. 기기 B에서 연구노트를 연다(또는 "☁️ 클라우드에서 합치기"). B의 그 기록에 **`tsa_token`이 내려오는지**(enriched) 확인 — 회귀 신호: B가 "이미 있는 id"라며 건너뛰어 토큰이 안 옴.
4. **원문·`entry_hash` 불변 확인**: 전파 후에도 B의 기록 내용·해시가 그대로여서 "🔒 해시 검증"이 통과하는지.
5. **덮어쓰기 금지 확인**: B가 이미 자기 토큰을 갖고 있었다면(수정 전 따로 받음), A의 토큰으로 **덮이지 않고** B 것이 유지되는지(fill-if-empty).
6. 자동 전파(v1.83): B에서 노트를 열기만 해도 `_rnAutoSync`가 돌아 토큰이 오는지, 20초 내 재열기 시 중복 호출이 throttle되는지.

---
