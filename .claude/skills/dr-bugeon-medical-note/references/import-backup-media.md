# 가져오기 / 내보내기 / 백업 / 녹음 파일

> `dr-bugeon-medical-note` 스킬 참고 문서. 진입점은 상위 폴더의 SKILL.md다.

## 8. 가져오기·내보내기·백업

### 8.1 가져오기

- Excel/CSV/TSV 가져오기는 헤더 있는 파일을 우선한다.
- 헤더 없는 입력은 표준 컬럼 수와 순서가 맞을 때만 허용한다.
- replace 또는 대량 삭제 전에는 전체 JSON 백업을 자동 생성한다.
- 신규만 추가와 갱신+추가를 명확히 분리한다.
- 기존 항목의 보강 필드를 빈 값으로 덮어쓰지 않는다.
- 같은 id 또는 같은 문장 기준으로 덮을 때는 `updated_at`을 비교한다.
- 파일 쪽 `updated_at`이 더 오래되면 기본값은 건너뛰기다.
- 오래된 Excel/CSV/TSV 백업을 현재 시각 `updated_at`으로 승격하지 않는다.
- ⚠️AUDIT(미리보기=적용 일치): 가져오기 **미리보기의 "갱신/교체" 카운트**는 실제 적용 단계와 같은 규칙으로 계산한다. append 모드는 기존 항목을 갱신하지 않고(신규만), merge 모드는 `updatedAt`이 더 최신일 때만 갱신한다 — 미리보기가 모든 id/name 일치를 무조건 "갱신"으로 세면 표시 수치가 실제 기록과 어긋난다. **해결 패턴(v1.38):** 미리보기 계산을 모드 인자화(`calculateImportPreview(data, mode)`)하고 공용 `_previewCounts(incoming, existing, keyOf, mode)`로 5도메인+노트를 같은 규칙으로 센다(append→갱신0, merge→incoming이 최신일 때만, replace→덮어쓰기+미포함 제거). 모드 select `onchange`로 즉시 재계산. 식별키는 **실제 적용과 동일**(용어: replace/json=id·파일=이름키). 카운트 렌더를 한 함수(`importPreviewCountsHtml`)로 일원화하면 노트 패치의 중복 append도 없앨 수 있다(단, 패치가 `calculateImportPreview`를 감싸면 mode 인자를 forward하도록 시그니처를 맞춘다).
- **표(CSV/Excel) 내보내기는 "위치 보존" 인코딩이라야 왕복(가져오기)이 된다(v1.40).** 반복 행(rows 섹션)을 `값:값:값 | 값:값:값`처럼 한 칸에 직렬화할 때, 빈 필드를 `filter(Boolean)`으로 빼면 위치가 어긋나 역파싱이 불가능해진다. **빈 칸도 자리(`''`)를 유지**하고, 값 안의 구분자(`:`·`|`)는 공백으로 치환해 round-trip을 깨지지 않게 한다(완전 빈 행만 제외). 역파싱은 ` | `로 행, `:`로 rowFields를 **위치 기준** 매핑.
- **이미 검증된 적용 경로를 새 가져오기에 재사용하려면 페이로드 `kind`로 분기를 태운다(v1.40 질환 CSV).** 질환 CSV를 표로 읽되 페이로드 `kind:'json'`으로 돌려주면, 검증된 질환 merge/append/replace·미리보기 코드를 그대로 탄다(질환 단일 페이로드라 `isCompleteJsonBackupImport=false` → 위험한 전체교체+canonical 자동 흐름은 발동 안 함, learning/tombstone 블록도 `hasTermPayload` 등으로 게이트돼 무해). 새 도메인 표 import 시 apply 로직을 복제하지 말고 이 방식으로 기존 코어에 합류시킨다. 표 감지는 헤더로(용어=`ko`, 질환=`ko_name`·`정의.ko`·`섹션.필드`).
- ⚠️AUDIT(tombstone 섞인 페이로드): merge 가져오기 입력에 `deletedAt`이 설정된 행(tombstone)이 섞여 있으면, 활성 배열에 그 행을 그대로 넣지 않는다. 정규화/저장 경로에서 `deletedAt` 행은 활성 목록에서 걸러 tombstone으로만 반영한다(저장 직전까지 활성 배열에 삭제 레코드가 남지 않게).
- **중복 해결은 "필드(칸)/섹션 단위 선택"까지 본다(v1.15→v1.17).** 전부 건너뛰기/전부 덮어쓰기(all-or-nothing)는 "어떤 칸은 기존 유지, 어떤 칸은 새것"이라는 흔한 요구를 못 채운다. 사용자가 "중복 검토/선택"을 말하면 **처음부터 granularity(항목 단위 vs 필드 단위)를 확정**한다 — 항목 단위로 먼저 만들었다가 필드 단위로 다시 만든 적이 있다(요구의 본질을 먼저 못 짚음). 구현 패턴: ① raw parsed에서 도메인별 식별키로 incoming↔existing 짝짓기 → ② 정규화본끼리 칸별 diff(플랫 키는 칸별, `body jsonb`는 **섹션별**로 비교) → ③ 바뀌는 칸/섹션마다 체크박스(체크=새것, 해제=기존) → ④ 선택대로 `merged = 기존(normalized)` 위에 **선택 칸/섹션만 incoming으로 덮어** 구성(전부 해제면 원본 보존·생략), `id=기존·updatedAt=now` 후 **기존 merge 코어**(`readDataImportFile`+`applyPendingDataImport('merge')`)로 적용 — 검증된 코어를 안 건드린다. 모달 상태(groups)는 적용 시 재사용해 인덱스 매칭이 어긋나지 않게 한다.

### 8.1.1 도메인에 선택 필드(컬럼) 추가 시 parity 체크리스트 (v1.36 finding_type 사례)

> **자동 안전장치 — "데이터 보관" 2겹 점검(v1.63 저장 + v1.65 전파):** 목적은 데이터가 손실 없이 저장·전파되는 것이므로 두 축을 함께 본다. ① **저장 드리프트** `computeSchemaDrift`: 각 `xToRow({id:1})` 출력 키(코드가 쓰는 DB 컬럼)를 SQL `create table`/`add column` 컬럼과 대조(`_sqlColumnsForTable`). ② **전파 누락** `computePropagationGaps`: `normalize*ForStorage({id:1})`의 내용 필드가 `canonical*HashPayload`에 모두 있는지 대조 — 빠지면 그 필드만 수정 시 스냅샷 해시가 그대로라 "변경 없음" 오판→ 다른 기기로 **전파 안 되는 조용한 유실**(v1.37의 미생물 ipa·공식 tags 누락이 이 유형). 페이로드 키는 `stableForHash`가 정렬된 **객체**를 반환하므로 `canonical*HashPayload([base])[0]`의 `Object.keys`로 런타임 추출. 제외 키: `id`·타임스탬프·`conceptCategory`(camel 별칭). ③ **복원 누락** `computeRestoreGaps`(v1.66): `xToRow({id:1})`가 쓰는 컬럼을 `rowToX`가 `r.<col>`로 다시 읽는지 대조 — 안 읽으면 저장돼도 새 기기/복원 시 안 올라와 유실. `rowToX` 소스를 `String(rowToX)`(Function.toString·비미니파이 앱)로 읽어 `/\br\.(\w+)/`로 read 컬럼 추출(SQL 점검과 대칭). 셋 중 하나라도 걸리면 **개발자 정보 모달 SQL 섹션 ⚠️ 배너** + 로드 시 **"개발자" 버튼 ⚠️**·콘솔 경고(모두 통과면 ✅). 대상은 최상위 함수가 있는 5개 도메인(notes 제외). **백업(4번째 축)은 별도 점검 불필요** — `createCompleteBackupObject`가 `dedupeXById(ARR)` 원본 레코드를 통째로 내보내 필드 선택이 없음(백업을 필드 선택형으로 바꾸면 그때 점검 추가). ⚠️ 자동 점검이 여전히 못 보는 것: **배지·날짜·Schema version 주석(아래 3번)** — 사람이 챙긴다. (설계 교훈: 왕복 검증은 값 넣고 "그대로 나오나" 비교하면 **재정규화 필드(질환 `body` 등)에서 오탐** → "컬럼을 읽는가"를 소스 정적분석으로 보는 게 견고. 셀프체크는 오탐 0이 생명이니 신설 시 실제 코드로 clean부터 확인.)

> **정적 점검의 한계 = 실제 DB 점검(v1.67).** 위 3겹은 앱 안의 **SQL 텍스트**와 대조할 뿐, "그 SQL을 실제 Supabase에서 아직 안 돌린" 경우(=실제 클라우드엔 컬럼 없음 → 저장 실패)는 못 잡는다. `checkLiveSchema`(개발자 정보 "🔄 실제 DB 점검" 버튼 `runLiveSchemaCheck`)가 **진짜 Supabase에 PostgREST로 질의**: 테이블마다 `select=모든컬럼&limit=1` → 200이면 전부 존재, 42703이면 에러 메시지(`column <t>.<c> does not exist`)에서 없는 컬럼명을 뽑아 remaining에서 제거 후 재시도(누락 0이면 테이블당 1요청, 있으면 누락 수만큼 반복). 42P01/404=테이블 없음, 401/403=인증오류. `getSupabaseConfig` 없으면 스킵. 원격/헤드리스 환경엔 실 DB 연결이 없어 못 도니 라이브 검증은 실기기 몫으로 남긴다.



용어 같은 "명시적 컬럼" 도메인에 새 선택 필드 하나를 더하면 **아래를 한 번에 모두** 맞춘다(한 곳만 빠지면 그 경로에서 값이 증발):
1. normalize(`normalizeTermForStorage`) — 기본값 + 입력 정규화 헬퍼.
2. cloud row 양방향(`termToRow`/`rowToTerm`) — snake_case 컬럼명.
3. **SQL은 사실 4곳**: `create table` 컬럼 + `alter ... add column if not exists`(idempotent) + **`SUPABASE_SCHEMA_VERSION` 배지 + `SUPABASE_SCHEMA_UPDATED_AT` 날짜 + `-- Schema version:` 주석**. 앞 둘만 고치고 뒤 셋(이력 라벨)을 빠뜨리기 쉽다(v1.36에서 finding_type 컬럼은 넣고 배지/날짜/주석은 안 올려 v1.41에 정정). 컬럼/테이블 '구조'가 바뀌면 **배지(+0.01)·날짜·Schema version 주석을 반드시 함께 bump**하고 완료 보고에 "SQL 변경 있음 + 재실행 안내"를 남긴다. (App version 줄은 `v${APP_INFO.version}`로 자동 표기되니 그건 건드릴 필요 없음.)
4. 입력 UI 2곳: 추가 폼 + 편집 모달, 각자 저장 읽기(`submitAddTerm`/`saveEdit`). ⚠️ 편집 저장은 `saveEdit`이지 `regenField`이 아니다(둘 다 `edit_*` id를 읽어 헷갈림 — 함수 경계 확인).
5. 표시 2곳: 카드 meta + 드로어 배지(테마 토큰 색).
6. 가져오기/내보내기: TSV 파서(COLS+ALIAS), AI 양식(TSV_COLS·hint·열 안내), `termExportRows`, 파일 업로드 row 매핑(친화 헤더명까지).
7. 검색 인덱스 포함(원하면).
8. completeness 점수(`termCompletenessScore`/`termCompletionPercent`)에는 **선택 태그를 넣지 않는다**(대부분 비어 penalty).
- **TSV/CSV에 열을 "추가"할 때 헤더 없는 입력 하위호환을 깨지 마라.** 헤더없음 검증·매핑이 `COLS.length`를 기준으로 하면, 열을 늘리는 순간 **기존 N열 파일이 전부 거부/오매핑**된다. 직전 표준 열 수를 상수로 고정(`STD_LEN=11`)해 검증은 `count >= STD_LEN || count === LEGACY`, 매핑 schema는 새 COLS(말미에 새 열)로 — 11열은 새 열이 빈칸, 12열은 인식. **새 열은 반드시 말미에 append**(중간 삽입 금지).

### 8.2 ID 처리

- 가져온 ID는 UUID 또는 앱이 정한 정상 id 형식만 보존한다.
- 형식이 맞지 않으면 새 ID를 발급한다.
- 렌더링 시 id를 JS/HTML 속성에 직접 넣지 않는다.
- `onclick` 문자열 안에 외부 입력 id를 넣지 않는다.
- data 속성에 넣을 때도 escape 처리한다.

#### 8.2.1 🔴 가져오기 id는 제공자(AI/외부)를 신뢰하지 않는다 — 이름 매칭 + 신규는 앱 발급 (v2.18·2.20·2.21)

- **매칭은 "이름(identityKey)" 기준, id 기준이 아니다.** AI 붙여넣기(`_aiRemapIdsByName`)는 들어온 id를 **버리고** 이름으로 기존 항목을 찾는다: 이름 일치→그 항목 id로(정확한 갱신), 불일치=신규→**앱이 `next*Id()` 발급**. 이렇게 안 하면 AI가 매 응답마다 같은 예시 id(`8000000000001`)를 재사용해 **서로 다른 항목이 같은 id로 들어와 "하나 추가 후 또 추가 시 앞엣것이 덮어써져 사라짐"**(급소, v2.20).
- **6도메인 모두 충돌 불가 생성기 `next*Id()`(단조증가·기기shard) 사용 — `Date.now()`·고정 placeholder 금지.** 용어·약물·공식·미생물·질환은 `_aiRemapIdsByName`(v2.20), 노트는 대량 import 폴백(`normalizeIntegratedNote`, v2.18)+생성 경로(v2.21). `Date.now()`는 같은 ms 대량 유입 시 충돌해 유실(노트 v2.18 사례).
- 배치 내 동일 이름은 같은 새 id로 묶어(`byKey`에 신규도 등록) 배치내 중복도 방지.
- `next*Id()`는 `maxId+1` 이상을 반환하므로 신규 id가 **기존과 우연히 겹칠 수 없다**(제공자 id를 아예 안 쓰는 게 안전장치).

#### 8.2.2 🔴 AI 콘텐츠 양식 ↔ 앱 가져오기 동작 = 한 계약 (항상 함께 바꾼다) — v2.22

- **앱의 가져오기 규칙이 바뀌면 AI에게 주는 "양식(프롬프트·예시)"도 반드시 맞춘다.** 어긋나면 양식이 그대로 버그를 유발한다: 앱은 "id 무시·이름 매칭"으로 바뀌었는데 양식은 "id는 8000000000001부터 매겨라"라고 계속 안내해, AI가 그 id를 반복 생성 → 덮어쓰기의 **원인**이 됐다(v2.22에서 정정).
- **id-less 양식 원칙:** AI 양식엔 id를 넣지 않는다 — `skeleton()`의 `out`에서 id 제외(`EXCLUDE`에 `id`가 있어 루프도 재추가 안 함) + 프롬프트에 "id는 넣지 마라 · 앱이 자동 고유번호 · 이름 같으면 갱신, 다르면 신규" + `addJsonArea` placeholder도 id 없는 예시.
- 양식 생성 위치 3곳(같이 손봄): `skeleton()`(JSON 예시) · 프롬프트 지시줄 · `addJsonArea` placeholder. **TSV(용어)는 원래 이름 기준이라 무관.**
- 일반 원칙: **가져오기 동작을 바꾼 PR은 "이 데이터를 만드는 AI 양식/프롬프트도 바꿔야 하나?"를 반드시 자문**한다(양식·앱은 별개 파일이 아니라 한 시스템).

### 8.3 내보내기

- 전체 JSON 백업은 용어, 학습상태, tombstone, 동기화 메타를 포함한다.
- 병렬 데이터 도메인이 있으면 각 도메인의 active 목록과 tombstone을 모두 포함한다. 예: `terms`, `tombstones`, `drugs`, `drugTombstones`, `learning`, `syncMeta`.
- 새 도메인을 추가한 뒤에는 백업 `schemaVersion` 또는 동등한 버전 값을 올리고, 이전 백업을 읽을 때의 기본값을 정의한다.
- replace/merge/append 복원 모드는 새 도메인에도 같은 의미로 동작해야 한다.
- 구형 JSON처럼 병렬 도메인 배열 자체가 없는 백업과, 배열은 있으나 비어 있는 백업을 구분한다. 배열이 없으면 현재 도메인을 보존하고, 빈 배열이 명시된 경우에만 해당 도메인을 비우거나 교체한다.
- Excel/CSV가 일부 보강 필드를 잃는다면 UI에 명확히 안내한다.
- 영역별 CSV/Excel 내보내기를 고치면 `sessions`, `profiles`, `descriptions`, `references`, `tombstones` 각 선택값에서 실제 export 함수가 끝까지 실행되는지 확인한다. 없는 helper 함수명 호출은 JS 문법 검사로 잡히지 않을 수 있으므로, 변경한 domain row 함수명을 직접 검색하고 실행 경로를 대조한다.
- `descriptions` 내보내기는 화면 표시 정책과 같은 기준을 따른다. Supabase 전용 표시 정책이면 기본은 `testDescriptions` 저장값을 내보내되, 아직 저장 설명이 하나도 없을 때는 헤더만 있는 빈 CSV 대신 앱 내장 설명을 `앱 내장 seed · Supabase 업로드용` source label로 담은 seed CSV를 내보낸다.
- 검사항목 설명/참고치 일괄업로드 양식은 별도 `양식 다운로드` 버튼으로 제공한다. 설명 양식은 `test_id`, `name`, `ko`를 미리 채운다. 참고치 양식은 검사실별 추가 기준을 만드는 입구이므로 다운로드 전에 검사실 이름, `standard`, 성별 row 범위를 선택하게 하고, `standard`, `standard_label`, `sex`, `test_id`, `test_name`을 미리 채워 사용자가 안정 식별자를 직접 맞추지 않게 한다.
- 검사결과 분석노트의 전체 JSON, 영역별 CSV, 로컬 캐시 초기화 전 자동 안전백업 파일명은 `백업날짜_Dr. Bugeon의 검사결과 분석노트_필드명` 형식으로 통일한다. `프로필/설정`처럼 파일명 금지 문자가 있는 라벨은 저장 직전에 안전한 문자열로 정리한다.
- Anki TSV는 학습용 출력이지 전체 복구용 백업이 아니다.

---


## 9. 녹음 파일 처리

녹음 데이터와 문장 데이터는 항상 연결 무결성을 우선한다.

- 문장 기준본 저장 성공을 먼저 확인한다.
- 그 다음 Storage 파일 정리를 한다.
- 새 녹음 업로드가 문장 연결 저장에 실패하면 업로드 파일을 즉시 정리한다.
- Storage 파일을 먼저 삭제하지 않는다.
- 문장은 있는데 파일이 없거나, 파일은 있는데 문장에 연결되지 않는 상태를 진단 화면에 표시한다.

MediaRecorder 규칙:

```javascript
// 나쁨: 마지막 청크 유실 가능
_rec.start(200);

// 좋음
_rec.start();
function stopRec(){
  if (_rec && _rec.state !== "inactive") {
    try { _rec.requestData(); } catch(e) {}
    _rec.stop();
  }
}
```

---

