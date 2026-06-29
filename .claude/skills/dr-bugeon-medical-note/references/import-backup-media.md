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
- ⚠️AUDIT(미리보기=적용 일치): 가져오기 **미리보기의 "갱신/교체" 카운트**는 실제 적용 단계와 같은 규칙으로 계산한다. append 모드는 기존 항목을 갱신하지 않고(신규만), merge 모드는 `updatedAt`이 더 최신일 때만 갱신한다 — 미리보기가 모든 id/name 일치를 무조건 "갱신"으로 세면 표시 수치가 실제 기록과 어긋난다.
- ⚠️AUDIT(tombstone 섞인 페이로드): merge 가져오기 입력에 `deletedAt`이 설정된 행(tombstone)이 섞여 있으면, 활성 배열에 그 행을 그대로 넣지 않는다. 정규화/저장 경로에서 `deletedAt` 행은 활성 목록에서 걸러 tombstone으로만 반영한다(저장 직전까지 활성 배열에 삭제 레코드가 남지 않게).
- **중복 해결은 "필드(칸)/섹션 단위 선택"까지 본다(v1.15→v1.17).** 전부 건너뛰기/전부 덮어쓰기(all-or-nothing)는 "어떤 칸은 기존 유지, 어떤 칸은 새것"이라는 흔한 요구를 못 채운다. 사용자가 "중복 검토/선택"을 말하면 **처음부터 granularity(항목 단위 vs 필드 단위)를 확정**한다 — 항목 단위로 먼저 만들었다가 필드 단위로 다시 만든 적이 있다(요구의 본질을 먼저 못 짚음). 구현 패턴: ① raw parsed에서 도메인별 식별키로 incoming↔existing 짝짓기 → ② 정규화본끼리 칸별 diff(플랫 키는 칸별, `body jsonb`는 **섹션별**로 비교) → ③ 바뀌는 칸/섹션마다 체크박스(체크=새것, 해제=기존) → ④ 선택대로 `merged = 기존(normalized)` 위에 **선택 칸/섹션만 incoming으로 덮어** 구성(전부 해제면 원본 보존·생략), `id=기존·updatedAt=now` 후 **기존 merge 코어**(`readDataImportFile`+`applyPendingDataImport('merge')`)로 적용 — 검증된 코어를 안 건드린다. 모달 상태(groups)는 적용 시 재사용해 인덱스 매칭이 어긋나지 않게 한다.

### 8.1.1 도메인에 선택 필드(컬럼) 추가 시 parity 체크리스트 (v1.36 finding_type 사례)

용어 같은 "명시적 컬럼" 도메인에 새 선택 필드 하나를 더하면 **아래를 한 번에 모두** 맞춘다(한 곳만 빠지면 그 경로에서 값이 증발):
1. normalize(`normalizeTermForStorage`) — 기본값 + 입력 정규화 헬퍼.
2. cloud row 양방향(`termToRow`/`rowToTerm`) — snake_case 컬럼명.
3. **SQL 2곳**: `create table` 컬럼 + `alter ... add column if not exists`(idempotent). SQL 헤더 버전이 자동 갱신돼도 **"SQL 변경 있음"을 완료 보고에 명시**하고 재실행 안내.
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

