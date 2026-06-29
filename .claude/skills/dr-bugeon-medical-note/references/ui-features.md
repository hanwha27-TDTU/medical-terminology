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

### 10.7 UI HTML은 대부분 JS 템플릿 리터럴 (백틱 주의)

- 이 앱의 모달·카드·프레임·드로어 UI는 거의 다 `el.innerHTML = \`…\`` **백틱 템플릿 리터럴**로 생성된다. 그래서 그 안의 HTML 안내문에 **리터럴 백틱(\`)이나 세 개짜리 코드블록 표시를 그대로 넣으면 템플릿이 끊겨 JS가 깨진다**(실제로 발생; `node --check`가 잡았다). 필요하면 `\\\`` 이스케이프 또는 다른 표현으로. `${ }`도 의도치 않게 보간되지 않게 주의. **큰 UI 템플릿 문자열을 편집한 뒤에는 반드시 `node --check`.**
- **반응형 grid에 전체폭 항목(`grid-column: 1 / -1`) 섞기 주의:** 2열 grid에 동적 주입 버튼 하나만 full-span이면 자동배치가 빈 셀을 남기고 정렬이 틀어진다(모바일 자료 모드 버튼에서 실제 발생). grid 항목을 더하거나 span을 줄 때 **열 수에 맞는지·span이 의도적인지** 확인한다. 동적 주입(`insertAdjacentHTML('beforeend', …)`) 요소도 컨테이너 grid 규칙을 그대로 상속한다.
- 동적으로 같은 컨테이너에 버튼/탭을 주입할 때(예: 노트 모드 버튼, 추가-모달 JSON 탭)는 기존 항목과 **같은 클래스·같은 레이아웃 규칙**을 쓰게 하고, 데스크톱(flex)·모바일(grid) 양쪽에서 정렬을 확인한다.
- **flex 버튼이 "너무 커" 보이면 `flex-grow`를 먼저 의심한다.** 헤더 버튼은 `.header-top`의 flex 자식이라, breakpoint에서 `flex: 1 1 132px`(grow=1)을 주면 행 폭을 억지로 채워 내용보다 크게 늘어난다(v1.01에서 수정). 내용 크기 유지가 목적이면 `flex: 0 1 auto`(grow=0, 좌측 정렬·자연 줄바꿈), **폭 균등 분할이 목적일 때만**(모바일 2열) `flex: 1 1 calc(50% - gap)`. 헤더 버튼 라벨은 `.wide-label`/`.mobile-label` 쌍으로 데스크톱 긴 라벨 ↔ 모바일 짧은 라벨을 전환하니, 새 헤더 버튼도 긴 라벨이면 같은 쌍을 둔다. breakpoint는 `≤1100px`(태블릿/창)·`≤600px`(모바일)을 따로 점검.
- **긴 설정/모달은 네이티브 `<details>/<summary>` 아코디언으로 접는다(v1.05 설정 화면).** JS 없이 요약 클릭=토글이고, 자주 쓰는 섹션(예: Supabase·Cloudinary)을 위로 올려 `open`으로 두고 나머지는 접는다. 재배치 시 **인라인 컨트롤을 손으로 다시 쓰지 말고** 구획을 잘라 순서만 바꿔 감싼다(dev-workflow §2.5). `display`로 토글되는 박스(예: `onAIRouteChange`)는 **id 붙은 원본 마크업 그대로** 묶음 안에 둬야 콜백이 유지된다. 검증: input id 각 1회·섹션 제목 중복 0·`<details>/<summary>/<div>` 짝 균형·`node --check`.
- **한 모달만 넓히려면 공용 클래스를 건드리지 말고 "컴파운드 변형 클래스"를 더한다(v1.14).** 질환 편집은 원인·위험인자 행이 5칸이라 공용 `.developer-modal`(760px)로는 빽빽 → `.developer-modal.disease-edit-wide { width: min(1040px,100%) }`를 추가하고 그 모달 `<section>`에만 클래스를 붙였다. **컴파운드 선택자(`.a.b`)는 미디어쿼리 안의 단일 클래스 규칙(`.a`)보다 우선**하므로 데스크톱에서 넓어지고, 좁은 화면은 기존 `max-width: calc(100vw - …)`가 그대로 캡한다(다른 개발자 모달엔 영향 0).
- **긴 편집 모달은 저장 버튼을 sticky 헤더에 둔다(v1.19).** 하단 저장까지 스크롤하는 불편을 없애려면 헤더(`.developer-modal-head`는 이미 `position:sticky`)에 `💾 저장` 버튼을 추가한다(×옆, `flex-shrink:0`). 헤더가 sticky가 아닌 모달(예: 용어 `editModal`)은 박스를 **내부 스크롤**(`max-height:90vh;overflow-y:auto`)로 바꾸고 헤더를 `position:sticky;top:0`(배경색·`margin:0 -20px`로 패딩 폭 보정)로 전환한 뒤 저장 버튼을 넣는다. 기존 하단 저장 버튼은 그대로 둔다(두 위치 모두 동작). 각 버튼은 그 모달의 기존 저장 함수를 그대로 호출.
- **flex 행의 버튼/라벨은 `white-space:nowrap`+`flex-shrink:0`로 고정(v1.16, v1.01 연장).** 카드 헤더(`.drug-head` space-between)에서 영어 부제가 길어지면 액션 영역이 눌려 발음 버튼의 `••••+발음`이 2줄로 찌그러졌다. 라벨 줄바꿈 자체가 비정상이니 버튼에 nowrap+flex-shrink:0을 박고 제목 쪽이 줄어들게 한다.
- **행(row) "중요도순 자동 정렬"은 공용 normalize 경로에 넣는다(v1.14).** 질환 cause 행을 `normalizeDiseaseBody`에서 yield 우선순위(High-yield→Medium→Low→빈칸)로 **안정 정렬**(인덱스 보조키로 동일 등급은 입력순 유지)했다. 로드·저장 공통 경로라 별도 버튼 없이 **표시·저장 모두 자동 재배치**. 단, 정렬로 `body` 순서가 바뀌면 `canonical*HashPayload`가 그 순서를 반영하므로 **저장본 해시 1회 재베이스라인**이 생길 수 있다(손상 아님 — 완료 보고에 "최종상태 저장 1회" 안내).
- **카드 이름/부제 "클릭 복사"는 토큰별로 분리한다(v1.21 질환, v1.23 약물·미생물·공식 수평전개).** 부제가 `한국어명 · 상품명`처럼 묶음이면 한 span으로 감싸 클릭 시 묶음 전체가 복사돼 불편하다. **각 토큰을 독립된 `.copyable-text` span으로 만들고 `' · '` 구분자는 span 밖에** 두면 클릭한 토큰만 복사된다. 복사 함수(`copyXDisplay(event,id,part)`)는 `part`별 분기(예: `'ko'|'brand'|'latin'|'use'`)와 **토큰에 맞는 토스트 라벨**을 주고, 기존 `'subtitle'` 묶음 분기는 하위호환으로 남긴다. 4개 도메인(용어·약물·미생물·공식·질환) 카드 동작을 같은 패턴으로 통일한다(드로어 4종 parity와 동일 원칙).
- **드로어/카드 "개요(대시보드)" 영역엔 첫 화면에서 봐야 할 임상 핵심만 노출한다(v1.22).** 질환 상세 개요에서 IPA(발음 보조)를 빼고 그 자리에 주호소(`body.profile.chief_complaints`)·정의(`body.definition.ko`)를 넣었다. 보조·부가 정보(발음 등)는 상세 섹션으로 미루고, 의사결정에 바로 쓰는 정보를 우선 배치한다. memory-line 추가는 값이 있을 때만(`d.body?.profile?.chief_complaints ? … : ''`).
- **추가(add) 모달도 "상단 고정 추가 버튼"을 둔다(v1.24, v1.19 sticky 저장의 add판).** 추가 폼은 입력 칸이 많아 하단 추가 버튼까지 스크롤이 길다. `.add-modal-card`를 `display:flex;flex-direction:column;max-height:calc(100vh - 36px)`로 바꿔 **본문(`#addTermModalBody`)만 내부 스크롤**(`overflow-y:auto;flex:1 1 auto;min-height:0`)하고 헤더(`flex-shrink:0`)는 고정, 헤더에 `submitAddTerm()` 호출 버튼을 더한다. 탭형 추가창이면 **기본 액션이 있는 탭에서만** 헤더 버튼을 보이게 한다(`switchAddTab`에서 토글) — TSV·Excel·JSON 탭은 자체 가져오기 버튼을 쓰므로 숨김. 도메인별 라벨은 하단 버튼과 같은 분기에서 함께 갱신(`switchAddKind`). 하단 버튼은 그대로 유지(두 위치 모두 동작).
- **"표시 경로가 여럿이면 한 번에 같이 바꾼다" — 카드 ↔ 드로어 개요 parity(v1.25).** 같은 데이터를 목록 카드와 상세 드로어가 각각 렌더하므로, 한쪽 개요만 고치면 다른 쪽이 어긋난다(v1.22에서 드로어 개요만 IPA 제거+주호소·정의 추가하고 목록 카드는 그대로 둬 v1.25에서 뒤늦게 맞춤). 질환 표시를 바꿀 땐 **카드 렌더(`renderDiseases`)와 드로어 개요(`openDiseaseDrawer`/`microbe-chip-row`+`microbe-memory-line`)를 같은 구성으로** 동시에 수정한다. 두 경로 모두 같은 가드(`d.body?.profile?.chief_complaints ? … : ''`)와 같은 클래스를 쓴다. (드로어 4종 parity와 동일 원칙의 "카드↔드로어" 버전.)
- **공통 클릭 동작은 bespoke 인라인 말고 공용 클래스로 — 클릭 복사 하이라이트 통일(v1.26).** 다른 카드(약물·미생물·공식·질환)는 `.copyable-text`(:hover 시 `rgba(88,166,255,0.14)` 배경 + `var(--accent)`)로 클릭 복사 하이라이트를 주는데, **일반 용어 목록만** 인라인 `style`+`onmouseenter/onmouseleave`로 직접 칠해서 ① 터치에서 하이라이트가 잘 안 붙고 ② 한국어 hover가 `rgba(255,255,255,0.08)`이라 **라이트 모드에서 거의 안 보였다**. 세 span을 모두 `class="copyable-text"`로 바꿔 통일(=원칙 #8: 유사 동작은 공용 클래스로 묶고, 테마 종속 색 대신 토큰 사용). 새 "클릭 복사" 지점은 항상 `.copyable-text`를 쓰고, 인라인 hover 색을 새로 만들지 않는다.
- **쉼표 값은 칩(pill)으로, 클릭하면 역탐색(v1.28 주호소 → v1.29 모아보기 → v1.32 증상·징후 수평전개).** 쉼표 구분 값(주호소·증상·징후)은 plain text 대신 `.disease-ddx-plain/.disease-ddx-link` 칩으로 보여준다("비슷한 질환 목록"과 같은 디자인 재사용, 단 증상·징후는 질환 링크↗가 아니라 🔍 역탐색). 칩 클릭 → 그 소견을 가진 질환을 모달로 모아본다(감별진단). **여러 필드에 같은 동작이면 함수를 필드 일반화한다**: `openComplaintDiseaseList`(주호소 전용)를 `openFindingDiseaseList(event, finding, field)` + `FINDING_FIELDS` 맵(`{field:{noun,verb,path}}`)으로 바꿔 검색경로·모달문구를 데이터로 분기(하드코딩 3벌 대신 1함수). 각 칩은 자기 필드만 검색해 동작이 예측 가능.
- **사용자 입력을 onclick 문자열에 절대 넣지 말고 `data-*` + `this.dataset`로(v1.29~).** 칩 토큰(사용자 데이터)을 `onclick="fn(event,'${tok}')"`로 보간하면 따옴표·특수문자로 깨지거나 주입된다. `data-find="${escapeHtml(tok)}" data-field="${escapeHtml(field)}" onclick="fn(event,this.dataset.find,this.dataset.field)"`로 — `escapeHtml`이 `"`,`'`까지 이스케이프하므로 속성이 안전하고 onclick엔 리터럴만 남는다(import-backup §8.2 규약과 동일).
- **동의어·표기 변형 매칭은 "이미 쌓은 데이터"를 사전으로 재활용한다(v1.34).** 역탐색이 글자 완전일치면 실신/기절/syncope가 갈린다(띄어쓰기는 norm의 `replace(/\s/g,'')`로 이미 흡수 — 진짜 문제는 동의어/다국어). 별도 사전을 새로 만들지 말고 **용어 DB(`TERMS`)의 ko(쉼표 동의어 분리)·en·uz를 개념 인덱스(정규화표기→용어 id)로** 빌드해, 토큰이 같은 용어로 해석되면 같은 개념으로 매칭(`normFindingConcept`=NFKC+소문자+공백/괄호 제거, `buildFindingConceptIndex`). 매칭은 2단계: ① 정규화 문자열(부분포함) ② 개념키 동일. **미등록 토큰은 문자열 매칭으로 폴백** → 안 깨지고, 용어를 채울수록 좋아지는 선순환. 같은 원리를 다른 "개념 동치"가 필요한 곳(검색·자동링크·중복판정)에도 적용 가능.
- **단일 역탐색 → 다조건 "워크벤치"로 일반화(v1.35).** 칩 클릭 단일 검색을 (가능하면) 조건 누적(AND) + 보기 토글로 키운다. 상태는 모듈 변수(`_findingFilter=[{field,value}]`, `_findingView`)로 두고 `renderFindingWorkbench()`가 매번 다시 그린다. 조건 추가 후보(동반 소견)는 **매칭 결과 집합에서 데이터로 도출**(매칭 질환들의 다른 소견을 빈도순, 이미 조건에 든 것 제외) → 사용자가 타이핑 없이 +칩으로 좁힌다. 목록↔표 토글: 표는 항목=열·비교축=행(가로 스크롤, 행 라벨 `position:sticky;left:0`). 매칭 코어(문자열+개념키)는 단일 검색과 **공유**(중복 구현 금지).
- **죽은 no-op 기능을 "살릴" 때는 컨트롤을 데이터가 있는 곳에 직접 렌더한다(v1.39 노트 필터).** `renderIntegratedNoteFilters`가 존재하지 않는 컨테이너 id(`conceptFilters` 등)를 읽어 조용히 아무 것도 안 하던 케이스 — 없는 컨테이너를 새로 만드느라 씨름하지 말고, 필터 바를 **리스트 프레임 안(렌더 함수 출력)에** 넣고 ① 모듈 상태(`_xFilter`) ② 검색 결과에 AND 합성하는 순수함수 ③ `window.setXFilter`(토글→재렌더) ④ 빈 결과 시 "필터 때문"인지 구분 안내, 로 묶는다. 버튼은 기존 공용 클래스(`.filter-btn`, 라이트 오버라이드 존재) 재사용. (원칙 #8: bespoke 대신 공용.)
- **읽기용 상세(드로어)는 기본 접힘, 편집/목차는 펼침(v1.33).** 카드 클릭으로 여는 드로어 아코디언은 `<details>`를 **모두 접힌 상태**로 시작한다(rows 타입 섹션에 무심코 단 `open`이 "일부만 열린" 인상을 줬다). 개요 카드·기본정보 그리드는 접이식이 아니라 항상 노출. 단 **편집 폼의 정의 섹션 `open`, 목차(TOC) 그룹 `open`은 맥락이 달라 유지** — `open` 일괄 제거 전에 어느 렌더 경로인지(드로어 vs 폼 vs TOC) 구분한다.
- **"추가" 끝 화면은 모든 추가 경로에서 동일하게 — 추가한 도메인 목록으로(v1.42).** 단어 하나·TSV는 `finishAddFlow`로 도메인 목록 이동했지만 JSON 붙여넣기·"비교 후 선택"은 `applyPendingDataImport`의 `showExportMenu()`(데이터 관리)로 끝나 화면이 데이터 관리에 머물렀다. **추가 경로가 여럿이면 끝 동작(landing)도 통일**: 붙여넣기/검토 경로는 `applyPendingDataImport({refresh:false})`로 데이터관리 재렌더를 끄고 `finishAddFlow(null, _pasteNavDomain(parsed))`(단일 도메인이면 그 도메인, 혼합이면 terms)로 보낸다. 단 **데이터 관리의 파일 가져오기**(연속 작업)는 그대로 데이터 관리에 남긴다 — "추가 흐름"과 "데이터 관리 흐름"의 종착지는 다르다.
- **솔리드 accent 버튼이 "튀면" 소프트 틴트 토큰 + 솔리드 hover로(v1.43).** 헤더 1차 버튼을 `background:var(--accent);color:#0d1117` 솔리드로 두면 화면에서 과하게 튄다 → `--add-active-bg/border/text`(테마 토큰) 소프트 accent 틴트로 낮추고 `:hover`에서만 솔리드 accent+흰 글자로 강조하면, 위계(1차)는 유지하되 정적 상태가 차분하다. 보조 액션(예: 헤더 "AI 콘텐츠 양식")은 ghost(투명+border, hover시 accent)로, 위계는 **1차(소프트 accent)·2차(ghost)·중성(×)** 으로 구분. 헤더에 버튼이 늘면 좁은 화면(≤560px)에선 2차 버튼을 `display:none`하고 본문 내 동일 버튼으로 접근을 남긴다.

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
