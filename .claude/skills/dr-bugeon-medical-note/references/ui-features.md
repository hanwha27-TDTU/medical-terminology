# UI / DOM / 기능별 지침

> `dr-bugeon-medical-note` 스킬 참고 문서. 진입점은 상위 폴더의 SKILL.md다.
> **2026-06-29 갱신:** 로직 전수감사 결과를 표 편집기·질병 폼·퀴즈/SRS 항목에 ⚠️AUDIT 주의문구로 반영. 상세 불변조건은 `reconstruction-spec.md` §10.

## 의학용어 앱 표 편집기 지침

USMLE High-Yield, 비교표, 진단-조치표처럼 표로 외워야 하는 내용은 일반 textarea에 Markdown 표를 직접 쓰게 두기보다 셀 기반 표 편집기를 우선한다.

- 저장 구조는 기존 `usmle` 문자열 필드를 우선 재사용한다. 셀 기반 편집기는 저장 시 Markdown table로 변환해 넣고, 별도 JSON/HTML 컬럼은 꼭 필요할 때만 추가한다.
- 기존 문자열 필드를 재사용하면 Supabase SQL 변경은 없다. 구조화된 표 컬럼, 별도 테이블, 검색용 파생 컬럼을 추가할 때만 SQL 통합본을 갱신한다.
- 표시 영역에서는 Markdown table을 HTML table로 렌더링한다. 상세 드로어, 카드 확장, 퀴즈 정답, 내보내기/Anki 변환 경로가 같은 렌더 규칙을 쓰는지 확인한다.
- 표 렌더러는 반드시 `escapeHtml` 또는 동등한 escaping을 적용한다. 사용자가 입력한 셀 내용이 HTML로 실행되게 만들지 않는다.
- ⚠️AUDIT(파이프 이스케이프 round-trip): 셀 내용에 `|`가 들어갈 수 있다. 직렬화(`tableDataToMarkdown`)에서 셀 내 `|`를 `\|`로 escape한다면, 파싱(`parseMarkdownTableLine`)에서 **`split('|')`보다 먼저** unescape하거나 보호 토큰으로 치환해야 한다. `split('|')` **후에** `\|`→`|`를 풀면 escape된 파이프가 이미 두 셀로 쪼개진 뒤라 복구되지 않는다(셀이 깨지고 백슬래시가 남음). writer의 escape와 reader의 unescape 순서를 항상 대칭으로 맞춘다.
- 표 편집기는 행/열 추가, 행/열 삭제, 셀 직접 편집, 기본 템플릿을 제공한다. 기본 템플릿은 `핵심 비교표`, `진단/조치표`, `공식/포인트표`처럼 의학 암기에 바로 쓰는 형태를 우선한다.
- textarea 안에 실제 표 UI를 억지로 넣지 않는다. 표 UI는 별도 모달/패널로 열고, 원본 textarea에는 Markdown 결과를 저장하거나 미리보기만 제공한다.
- 긴 입력과 표 편집이 함께 쓰이는 화면은 데스크톱에서 충분히 넓게 열리게 한다. 현재 의학용어 앱의 용어 추가 모달은 데스크톱 최대 폭 860px 기준을 유지하고, 모바일에서는 화면 폭 안에 맞게 줄바꿈한다.
- 라이트모드와 다크모드에서 표 header, border, cell background, input focus, 삭제 버튼 색상이 기존 CSS 토큰과 어울리는지 함께 확인한다.
- 표 기능을 수정하면 `add_usmle`, `edit_usmle`, `openUsmleTableEditor`, `renderRichTextWithTables`, 상세 드로어, 카드 확장, 퀴즈 정답 화면을 같이 점검한다.
- 표 저장 직후에는 방금 편집한 항목이 선택 상태로 유지되는지, 백업/복원/최종본 저장/저장본 버전 확인의 manifest/hash에 기존 `usmle` 값이 그대로 포함되는지 확인한다.

## 질환(주요 질환) 입력 폼 — 반복 행 섹션 주의

- 질환 `body`의 `type:'rows'` 섹션(cause/red_flags/diagnosis)은 행 배열로 입력한다. `diagnosis`는 신규 추가 시 seed 2행을 기본 골격으로 자동 렌더한다.
- ⚠️AUDIT(seed는 add 전용): seed 주입 분기를 `!initial.length`(빈 섹션) 조건만으로 두면, 진단이 비어 있는 **기존** 질환을 편집할 때도 seed 2행이 들어가고 — `item`이 `DISEASE_DX_ITEMS`의 실제 옵션 값이라 "전부 빈 행 제거" 필터를 통과 — 저장 시 유령 진단행이 매 편집마다 누적된다. seed 분기에 **add/edit 구분 가드**(추가 폼 prefix일 때만 seed)를 둔다.
- rows 소비처 6곳(`normalizeDiseaseBody`·`diseaseBodyText`·드로어 아코디언·폼 `sectionHtml`·`upsertDiseaseFromForm`·`diseaseExportRows`)을 함께 점검한다.

## 퀴즈 / SRS (간격반복) 주의

- 학습상태(`medical_term_learning_state`)의 복습 스케줄은 SRS 유사 구조다. ⚠️AUDIT:
  - **복습 간격은 직전 간격을 기반으로 성장**해야 한다. lifetime `correctCount`만으로 `2^(min(correctCount,5)-1)`처럼 산출하고 5에서 캡하면, 숙달 용어도 영원히 ≤16일 주기로 재출제되고 간격이 자라지 않는다 → 직전 `intervalDays × ease`로 키운다.
  - **숙달(`study_status='mastered'`) 판정은 lifetime 누적이 아니라 연속 정답 streak/최근 정답률 기반**으로 둔다. 누적 `wrongCount`(감소·리셋 없음)로 `correct≥5 && wrong≤2`를 요구하면, 초기에 3번 틀린 용어는 이후 아무리 맞혀도 영구히 mastered가 안 된다.
  - 퀴즈 풀의 `due` 스코프는 정렬 없이 `slice(0,n)`하면 과적체 시 항상 같은 앞쪽 N개만 출제된다 → 가장 지난 항목 우선 정렬 후 제한한다.
  - MCQ 정답 인덱스는 앱 전체에서 **0-base 일관** 유지(파싱·정규화·뷰).
# Dr. Bugeon Single HTML Sync App — 통합 개발 스킬

이 스킬은 4개 문서의 중복 지침을 하나로 합치고, 서로 충돌하는 부분은 데이터 유실을 막는 방향으로 정리한 최종 기준이다.

핵심 목표는 세 가지다.

1. 데이터가 사라지지 않게 한다.
2. 삭제한 데이터가 다른 기기에서 되살아나지 않게 한다.
3. 단일 HTML 개인앱의 장점은 유지하면서, Supabase 동기화와 녹음·가져오기·배포 문제를 안정적으로 처리한다.

---


## 10. UI·DOM·상태 관리

### 10.1 이벤트 바인딩

`onclick="함수명()"` 문자열 방식을 쓰지 않는다.

```javascript
document.getElementById("btnSearch").addEventListener("click", doSearch);
document.getElementById("q").addEventListener("keydown", function(e){
  if (e.key === "Enter") doSearch();
});
```

이유:

- 전역 스코프 문제를 피한다.
- GitHub Pages 캐시로 구버전 함수가 남는 문제를 줄인다.
- 외부 입력 id가 HTML/JS 문자열에 섞이는 위험을 줄인다.

### 10.2 상태 변수

탭별 상태는 객체로 묶는다.

```javascript
const _noRecFilter = { general: false, vocab: false };
const _tabQuery = { general: "", vocab: "" };
```

필터 상태가 2가지 이상이면 boolean 여러 개보다 열거형을 쓴다.

```javascript
// false → 'none' → 'has' → false
_noRecFilter.general = 'none';
```

전역 검색, 탭 검색, 필터가 공존하면 우선순위를 명시한다.

```text
우선순위: 전역검색 > 탭로컬검색 > 필터
전역 검색 입력 시 탭 로컬 검색 초기화
탭 로컬 검색 입력 시 전역 검색 초기화
```

### 10.3 렌더 함수

렌더 함수는 단방향으로 유지한다.

```javascript
function renderRecentGeneral() {
  let all = getDB().filter(r => r.type === 'General');
  all = _sortRows(all, $('sortGeneral')?.value);

  if (_noRecFilter.general === 'none') all = all.filter(r => !r.audio_url);
  else if (_noRecFilter.general === 'has') all = all.filter(r => !!r.audio_url);

  if (_needCheckFilter.general) all = all.filter(r => getLearning(r).needCheck);
  if (_tabQuery.general) all = all.filter(r => _searchMatch(r, _tabQuery.general));

  const db = _showAll.general ? all : all.slice(0, 10);
  $('generalRecentBody').innerHTML = renderRows(db);
}
```

`renderAllViews` 또는 동등한 전체 렌더 함수는 항상 `updateStatsUI`를 포함한다.

### 10.4 DOM 타이밍

`renderAllViews()` 직후 DOM을 참조할 때는 짧은 지연을 둔다.

```javascript
renderAllViews();
setTimeout(() => {
  const tr = document.querySelector(`[data-id="${cssEscape(id)}"]`);
  if (!tr) return;
  tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
}, 80);
```

애니메이션 재시작은 reflow를 강제한다.

```javascript
tr.classList.remove('row-highlight');
void tr.offsetWidth;
tr.classList.add('row-highlight');
```

### 10.5 모달

- 모달 내부 버튼은 `ev.stopPropagation()`을 적용한다.
- 재사용 모달의 상태 변수는 open, close, save 세 곳에서 리셋한다.
- 접기/펼치기 상태는 `data-*` 속성으로 유지한다.
- 용어 편집, 항목 편집, 약물명 및 정보 편집처럼 긴 입력 모달은 배경 클릭이나 오버레이 클릭으로 닫히지 않게 한다.
- 사용자가 내용을 입력하는 모달은 명시적인 `닫기`, `저장`, `삭제` 버튼으로만 종료한다.
- 세부 보기 카드가 비어 보이면 결함으로 간주한다. 데이터가 없을 때는 “세부 내용이 아직 입력되지 않았습니다.” 같은 빈 상태를 표시한다.
- 중복 용어/약물 추가는 아무 반응 없이 종료하지 말고 토스트와 폼 주변 안내를 함께 표시한다.

```javascript
function resetLevel(id, ev) {
  ev?.stopPropagation();
  openReviewModal();
}
```

### 10.6 발음 듣기와 브라우저 TTS

일반 용어와 약물명 및 정보에 영어 발음 듣기를 붙일 때는 새 TTS 시스템을 만들지 말고 기존 `speakText`, `ttsSpeed`, `speakingBtn`, `.speak-btn` 패턴을 재사용한다.

- 일반 용어는 영어 명칭 `en`과 영어 정의 `def_en`을 각각 읽을 수 있게 한다.
- 약물명 및 정보는 `generic_name`을 우선 읽고, 없으면 `brand_name`을 읽는다. 한국어 약물명만 있을 때 영어 TTS가 어색해질 수 있으므로 조용히 실패하지 말고 “읽을 영어 약물명이 없습니다”를 안내한다.
- 카드 전체가 클릭 가능한 구조라면 발음 버튼, 편집 버튼, 삭제 버튼은 반드시 `event.stopPropagation()`을 거치게 한다.
- 발음 버튼 id는 재생 상태 표시를 위해 안정적으로 만든다. 예: `speak-drug-card-${id}`, `speak-drug-drawer-${id}`.
- 같은 항목의 카드 버튼과 드로어 버튼이 모두 있을 수 있으므로 `speakText`는 `event.currentTarget`을 우선 사용하고, fallback id는 기존 규칙을 유지한다.
- `window.speechSynthesis`가 없거나 음성 목록이 늦게 로드되는 브라우저를 고려해 지원 여부 확인과 `voiceschanged` 로딩을 유지한다.
- 발음 속도 조절은 일반 용어와 약물명 및 정보에서 같은 `ttsSpeed` 값을 공유한다.
- 발음 듣기처럼 저장 구조를 바꾸지 않는 기능은 Supabase SQL을 수정하지 않는다. 완료 전 기존 SQL 블록과 새 파일 SQL 블록이 같은지 확인한다.
- 실제 브라우저 검증이 가능하면 카드 발음 버튼, 드로어 발음 버튼, 중복 클릭 시 정지, 모바일 폭 줄바꿈을 확인한다.

> ⚠️AUDIT(드로어 4종 parity): 용어/약물/미생물/질병 드로어는 복붙으로 만든 4개 경로다. nav 카운트/이전·다음 버튼 disabled 계산, `_drawerXId` 저장 시 `Number()` 정규화 등을 4개 모두 같은 규칙으로 맞춘다(한 드로어만 `idx===-1` 가드/Number 정규화 누락 주의).

---


## 11. 테이블 수정 규칙

테이블에 컬럼 하나를 추가하면 아래 5곳을 동시에 맞춘다.

```text
① row 생성 함수의 td 개수
② colgroup의 col 개수와 width 합계 100%
③ thead의 th 개수
④ 빈 상태 메시지의 colspan
⑤ nth-child 기반 CSS 규칙
```

검증 스크립트:

```python
import re
html = open('파일.html', encoding='utf-8').read()
for m in re.finditer(r'<colgroup>(.*?)</colgroup>.*?<thead><tr>(.*?)</tr>', html, re.DOTALL):
    cols = len(re.findall(r'<col', m.group(1)))
    ths = len(re.findall(r'<th', m.group(2)))
    widths = [int(x) for x in re.findall(r'width:(\d+)%', m.group(1))]
    print('OK' if cols == ths and sum(widths) == 100 else 'BUG', cols, ths, sum(widths))
```

---


## 12. YouTube IFrame + 외부 API 연동

확정 아키텍처:

```text
브라우저
  ├─ YouTube Data API v3     → 영상 ID 검색
  ├─ RapidAPI Transcript API → 자막 JSON
  └─ YouTube IFrame API      → 타임스탬프 기반 구간 재생
```

다시 시도하지 않을 방법:

| 방법 | 실패 이유 |
|---|---|
| YouTube timedtext API 직접 호출 | CORS 차단 |
| CORS 프록시 | YouTube가 프록시 IP 차단 가능 |
| Supabase Edge Function | YouTube가 서버 IP에서 403 반환 가능 |
| youtube-transcript-api Python | 서버에서 403 Forbidden 가능 |

RapidAPI 자막 endpoint:

```text
GET https://youtube-captions-transcript-subtitles-video-combiner.p.rapidapi.com/download-json/{videoId}?language={lang}&response_mode=default
Headers:
  x-rapidapi-key:  {API_KEY}
  x-rapidapi-host: youtube-captions-transcript-subtitles-video-combiner.p.rapidapi.com
```

YouTube API 키 제한 예시:

```text
나쁨: hanwha27-tdtu.github.io/repo/
좋음: https://hanwha27-tdtu.github.io/*
```

병렬 자막 fetch:

```javascript
var results = await Promise.all(vids.map(async function(vid) {
  try {
    var caps = await fetchSub(vid, lang);
    if (!caps) return [];
    return caps.filter(matchCaption).map(toClipRow);
  } catch(e) {
    return [];
  }
}));
```

> ⚠️AUDIT(외부 API 응답 가드): 외부 의학 API(`fetchRxNorm`/`fetchFDADrug`/`fetchPubMed`/`fetchICD11` 등)는 `res.ok` 확인 후 응답 필드 경로를 방어적으로 읽는다. 배열 필드는 `!!arr`가 아니라 `arr?.length`로 존재를 판단한다(빈 배열을 "있음"으로 오판하지 않게 — 예: `boxed_warning: []`로 BOXED 플래그가 잘못 켜짐).

---


## 13. 데이터 관리 화면 필수 요소

데이터 관리 화면에는 아래 항목을 표시한다.

- 로컬 용어 수
- 클라우드 활성 용어 수
- 클라우드 삭제 표시 수
- 오래된 로컬 전용 제외 예정 수
- `canonical_version` 일치 여부
- pending 최종본 덮어쓰기 상태
- outbox 대기 수와 마지막 충돌 상태. 원격 최신본이나 원격 삭제 때문에 업로드를 보류했다면 profile/date, remoteAt, localAt을 확인 가능하게 남긴다.
- 앱 버전 또는 파일명
- Supabase 연결 상태
- 마지막 클라우드 기준본 로드 시각
- 병렬 데이터 도메인이 있으면 도메인별 활성 수, 삭제 수, hash/manifest 검증 결과

필수 버튼:

- 동기화 상태 점검
- 일반 양방향 동기화
- 현재 기기 데이터로 클라우드 최종본 덮어쓰기
- 클라우드 최종본으로 이 기기 교체
- pending 상태 재확인
- 로컬 잠금만 해제
- 전체 JSON 백업
- JSON 복원

문구 원칙:

- “이 기기를 최종본으로 지정”처럼 모호한 문구를 피한다.
- “현재 기기 데이터로 클라우드 최종본 덮어쓰기”처럼 방향을 명확히 쓴다.
- “클라우드 최종본으로 이 기기 교체”처럼 반대 방향도 명확히 쓴다.

> ⚠️AUDIT(미리보기=적용 일치): 가져오기 미리보기의 "갱신/교체" 수치는 실제 적용 모드(append=신규만, merge=`updatedAt` 더 최신일 때만)와 같은 규칙으로 계산해 표시 수치가 실제 기록과 어긋나지 않게 한다.

---


## 20. 검사일별 판정 기준 선택

- 참고치 기준을 판정에 쓰는 기능은 전역 토글로만 두지 말고 검사일 레코드에 `referenceStandard`/`reference_standard`로 저장한다.
- 대시보드, 추이, 이상 이력, 보고서는 각 검사일에 저장된 기준을 `sessionReferenceStandard()`로 읽고 같은 `effectiveAssessment()` 경로에 넘긴다.
- 새 기준 선택 UI를 추가하면 입력창, 대시보드 즉시 변경, 자동판독 병원명 감지, CSV 백업/복원, Supabase payload, 원격 row normalize, manifest/hash, 통합 SQL을 함께 갱신한다.
- USMLE나 추가 검사실 기준에 특정 항목 참고치가 없으면 판정이 비어 정상처럼 보이지 않게 기본 성별 참고치로 fallback한다.
- 보고서와 추이에는 어떤 기준으로 판정했는지 기준명을 표시한다. 여러 검사일 기준이 섞이면 날짜별 기준으로 계산된다는 안내를 남긴다.
