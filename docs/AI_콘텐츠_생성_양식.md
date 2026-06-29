# Dr. Bugeon Medical Note — AI 콘텐츠 생성 양식

> 이 문서는 **AI 챗봇(ChatGPT · Claude · Gemini · Copilot 등 무엇이든)** 에게 주고,
> 의학 콘텐츠(용어 · 약물 · 공식 · 미생물 · 주요 질환)를 **앱에 바로 가져올 수 있는 JSON**으로 받기 위한 양식입니다.
> 일반 텍스트 + JSON 규격이라 **어떤 AI도 읽고 따를 수 있습니다.**

---

> **⭐ 권장 흐름(v4.82+):** 앱의 **🤖 AI 콘텐츠 양식** 버튼을 쓰면 ① 항상 최신 양식이 복사되고(AI가 **예쁘게 정리한 답 + 맨 끝에 붙여넣기 블록**을 줌), ② 그 블록을 같은 화면의 **📥 AI 답변 붙여넣기** 박스에 붙여넣으면 **파일 저장 없이 한 번에** 가져옵니다(용어=TSV, 그 외=JSON 자동인식). 아래 문서는 그 배경 설명·필드 참고용입니다.
>
> **붙여넣기 위치는 두 곳(v4.84+):** ① 데이터 관리 → 🤖 AI 콘텐츠 양식 → 📥 AI 답변 붙여넣기, ② **용어 추가 화면의 "🤖 JSON 붙여넣기" 탭**. 둘 다 같은 기능(전 도메인·중복 시 건너뛰기/덮어쓰기 선택).

## 0. 사용법 (딱 3단계)

1. **양식 복사** — 앱 **데이터 관리 → 🤖 AI 콘텐츠 양식** 에서 도메인을 골라 복사(또는 아래 도메인별 "AI에게 주는 글" 블록 복사).
2. **AI에게 요청** — AI 채팅창에 붙여넣고 맨 끝에 무엇을 만들지 적는다. 예: `→ "심근경색, 폐렴, 당뇨병 3개 만들어줘"`. AI가 **예쁘게 정리한 답**을 보여주고 **맨 끝에 붙여넣기 블록**(용어=TSV, 그 외=JSON)을 준다.
3. **앱에 가져오기** — 그 **블록만** 복사 → 앱 **데이터 관리 → 🤖 AI 콘텐츠 양식 → 📥 AI 답변 붙여넣기** 박스에 붙여넣고, **같은 이름이 이미 있을 때** 처리 방식을 골라 가져오기:
   - **➕ 신규만 추가** = 중복(같은 이름)은 **건너뛰기**(기존 보존).
   - **♻️ 중복 덮어쓰기** = 중복은 **기존 항목을 갱신**(새 내용으로 업데이트).
   - 중복은 **이름 기준**(용어 en/ko/uz, 약물명, 미생물명, 질환명 등)으로 판정합니다. AI가 매번 새 id를 붙여도 같은 이름이면 한 항목으로 처리됩니다.
   - 파일 저장 불필요. 코드블록 `\`\`\`` 표시가 붙어와도 자동 처리. (대안: `.json` 파일로 저장해 **JSON 백업 복원**으로 가져오기)
   - **용어**는 TSV/JSON 둘 다 가능합니다(메뉴에 "일반용어 (TSV)"와 "일반용어 (JSON)" 둘 다 있음). 약물·공식·미생물·질환은 JSON.

> **왜 `신규만 추가(append)`?** 기존 데이터를 절대 안 건드리고 새 항목만 더합니다(제일 안전). `최신 항목 병합`은 같은 항목을 덮어쓸 수 있고, `현재 데이터 교체`는 통째로 바꿉니다.

---

## 1. AI에게 먼저 줄 규칙 (모든 도메인 공통 — 양식 맨 앞에 붙이세요)

```
너는 의학 학습 앱에 넣을 데이터를 만든다. 아래 규칙을 반드시 지켜라.
1) 출력은 JSON 하나만. 코드블록(```json) 안에 넣고, 그 외 설명·인사·주석은 절대 쓰지 마라.
2) "선택 목록"이 있는 칸은 반드시 그 목록 안의 값 그대로만 써라(철자·대소문자·띄어쓰기까지 동일). 목록에 없으면 가장 가까운 값을 쓰고, 정 없으면 ""(빈 칸).
3) 모르거나 불확실한 칸은 지어내지 말고 ""(빈 문자열)로 둬라. 행(row) 배열을 모르면 [] (빈 배열).
4) 각 항목의 "id"는 서로 겹치지 않는 큰 숫자로. 예시처럼 8000000000001 부터 1씩 올려라.
5) 의학적으로 정확하게, USMLE/KMLE 시험 관점으로. 한국어·영어 칸은 해당 언어로, 모르면 비워라.
6) 내가 "○○ 만들어줘"라고 한 개수만큼 배열 안에 항목을 채워라.
```

---

## 2. 공통 "선택 목록" (드롭다운 값 — 이 값들만 허용)

여러 도메인이 함께 쓰는 값입니다. **이 목록 밖의 값을 쓰면 앱이 기본값으로 바꾸거나 버립니다.**

### 🧭 장기계 / System (`category`, `system`, `system_tags`에 사용) — 17개
```
General, Cardiovascular, Pulmonary, Renal, GI & Hepatobiliary, Endocrine,
Neurology, Hematology & Oncology, Infectious Disease, Musculoskeletal,
Dermatology, Ophthalmology, ENT, Reproductive, Psychiatry, Pediatrics, Immunology
```
- `system_tags`는 위 값 여러 개를 **쉼표로** (예: `"Cardiovascular, Endocrine"`). 위 목록 값만 인정됩니다.

### 🧠 개념분류 / Concept Category (`concept_category`) — 12개
```
Anatomy, Physiology, Symptoms & Signs, Diseases, Diagnostics, Procedures,
Pharmacology, Pathology, Microbiology, Biochemistry & Genetics, Public Health, Other / Unclassified
```

---

## 3. 도메인별 양식

각 도메인은 **① AI에게 주는 글(빈 양식)** + **② 채운 예시(이렇게 나오면 됨)** + **③ 가져오는 곳** 으로 구성됩니다.

---

### A. 일반용어 (terms)

**필드:** `ko`(한국어) · `en`(영어) · `uz`(우즈벡어) · `concept_category`(개념분류·목록) · `category`(장기계·목록) · `system_tags`(보조 장기계·쉼표) · `def_ko`/`def_en`/`def_uz`(정의 3개국어) · `usmle`(USMLE 포인트) · `ipa`(발음기호)
**필수:** `ko` · `en` · `uz` 중 **하나 이상**. 나머지는 비워도 됨.

#### A-1. JSON으로 받기 — AI에게 주는 글
```
(위 "1. 공통 규칙"을 먼저 붙인 뒤)
아래 형식으로 일반의학용어를 만들어라. category는 장기계 17개 목록, concept_category는 개념분류 12개 목록에서만 골라라.

{
  "terms": [
    {
      "id": 8000000000001,
      "ko": "한국어 용어",
      "en": "English term",
      "uz": "Oʻzbekcha (모르면 빈칸)",
      "concept_category": "개념분류 12개 중 1개",
      "category": "장기계 17개 중 1개",
      "system_tags": "장기계 값 0~여러개, 쉼표로",
      "def_ko": "한국어 정의",
      "def_en": "English definition",
      "def_uz": "",
      "usmle": "USMLE 핵심 포인트",
      "ipa": "/발음기호/"
    }
  ]
}
```

#### A-2. 표 붙여넣기(TSV)로 받기 — 더 쉬움(파일 불필요)
용어는 **탭으로 구분된 표**로도 받을 수 있습니다. 첫 줄은 머리글, 열 순서는 아래 11열.
```
ko	en	uz	concept_category	category	system_tags	def_ko	def_en	def_uz	usmle	ipa
```
AI에게: *"위 11열 머리글을 첫 줄에 두고, 각 용어를 탭으로 구분한 표(TSV)로만 출력해라. category는 장기계 목록, concept_category는 개념분류 목록에서만."*
→ 앱 **용어 추가 → TSV 붙여넣기** 탭에 붙여넣고 **`➕ 신규만`**.

#### A-3. 채운 예시 (JSON)
```json
{
  "terms": [
    {
      "id": 8000000000001,
      "ko": "심방세동",
      "en": "Atrial fibrillation",
      "uz": "",
      "concept_category": "Diseases",
      "category": "Cardiovascular",
      "system_tags": "Cardiovascular",
      "def_ko": "심방이 빠르고 불규칙하게 수축하는 상심실성 빈맥성 부정맥.",
      "def_en": "Supraventricular tachyarrhythmia with uncoordinated atrial activation.",
      "def_uz": "",
      "usmle": "irregularly irregular pulse, 뇌졸중 위험 → CHA2DS2-VASc로 항응고 결정",
      "ipa": "/ˈeɪtriəl ˌfɪbrɪˈleɪʃən/"
    }
  ]
}
```
**③ 가져오는 곳:** 데이터 관리 → JSON 백업 복원 → 파일 선택 → `신규만 추가`. (또는 A-2 TSV 붙여넣기)

---

### B. 약물 (drugs)

**필드:** `generic_name`(성분명·영어) · `ko_name`(한국어명) · `brand_name`(상품명) · `drug_class`(USMLE 계열·자유) · `same_class_drugs`(같은 계열 약들) · `drug_form`(제형·자유) · `atc_class`(ATC 분류) · `target`(작용 표적) · `route`(투여경로·자유) · `category`(장기계·목록) · `system_tags`(쉼표) · `usmle_yield`(빈출도·자유, 예 High/Moderate/Low Yield) · `ipa` · `definition_ko`/`definition_en`/`definition_uz` · `causal_chain`(인과사슬) · `why` · `moa`(작용기전) · `clinical_uses` · `adverse_effects` · `precautions` · `usmle_strategy` · `memory_line`(한 줄 암기)
**필수:** `generic_name` 또는 `ko_name` 중 하나 이상.
**주의:** 개념분류는 자동으로 `Pharmacology`가 되니 넣지 마세요. `category`만 장기계 목록에서 고릅니다.

#### B-1. AI에게 주는 글
```
(공통 규칙 먼저) 아래 형식으로 약물을 만들어라. category는 장기계 17개 목록에서만. drug_class/drug_form/route/usmle_yield는 자유 텍스트. 모르는 칸은 "".

{
  "drugs": [
    {
      "id": 8000000000001,
      "generic_name": "성분명(영어)",
      "ko_name": "한국어 약물명",
      "brand_name": "상품명(모르면 빈칸)",
      "drug_class": "USMLE 약물 계열",
      "same_class_drugs": "같은 계열 약물들",
      "drug_form": "제형 (tablet, monoclonal antibody 등)",
      "atc_class": "ATC 분류(모르면 빈칸)",
      "target": "분자 표적 / 수용체 / 효소",
      "route": "투여경로 (PO, IV 등)",
      "category": "장기계 17개 중 1개",
      "system_tags": "장기계 값, 쉼표",
      "usmle_yield": "High Yield / Moderate Yield / Low Yield",
      "ipa": "/발음/",
      "definition_ko": "한국어 한 줄 설명",
      "definition_en": "English one-liner",
      "definition_uz": "",
      "causal_chain": "약물 작용의 인과 흐름",
      "why": "왜 쓰는가",
      "moa": "작용기전(MOA)",
      "clinical_uses": "임상 적응증",
      "adverse_effects": "대표 부작용",
      "precautions": "금기 / 주의",
      "usmle_strategy": "USMLE 접근 전략 / 함정",
      "memory_line": "한 줄 암기"
    }
  ]
}
```

#### B-2. 채운 예시
```json
{
  "drugs": [
    {
      "id": 8000000000001,
      "generic_name": "Metformin",
      "ko_name": "메트포르민",
      "brand_name": "",
      "drug_class": "Biguanide",
      "same_class_drugs": "",
      "drug_form": "tablet",
      "atc_class": "A10BA02",
      "target": "AMPK 활성화 (간 당신생 억제)",
      "route": "PO",
      "category": "Endocrine",
      "system_tags": "Endocrine",
      "usmle_yield": "High Yield",
      "ipa": "/mɛtˈfɔːrmɪn/",
      "definition_ko": "제2형 당뇨병 1차 약. 간 포도당 생성 억제.",
      "definition_en": "First-line agent for type 2 diabetes; reduces hepatic gluconeogenesis.",
      "definition_uz": "",
      "causal_chain": "AMPK↑ → 간 당신생↓ → 공복혈당↓, 인슐린 감수성↑",
      "why": "체중 증가·저혈당 적고 1차 선택",
      "moa": "Complex I 억제 → AMPK 활성화 → 당신생 억제",
      "clinical_uses": "제2형 당뇨병, PCOS",
      "adverse_effects": "위장장애, 드물게 젖산산증(lactic acidosis)",
      "precautions": "신부전(eGFR<30 금기), 조영제 검사 전 중단",
      "usmle_strategy": "체중 안 늘고 저혈당 없음이 단서. lactic acidosis 함정.",
      "memory_line": "당뇨 1차 = 메트포르민, 콩팥 나쁘면 빼라"
    }
  ]
}
```
**③ 가져오는 곳:** 데이터 관리 → JSON 백업 복원 → 파일 선택 → `신규만 추가`. (약물은 TSV 미지원, JSON만)

---

### C. 공식 (formulas)

**필드:** `name`(이름) · `short_name`(약어) · `formula`(계산식) · `category`(공식 분야·자유, 예 Acid-base) · `system`(장기계·목록) · `use_case`(언제 쓰나) · `normal_range`(정상범위) · `interpretation`(해석) · `example`(예시 계산) · `memory_tip`(암기팁) · `usmle_trap`(함정) · `variables`(변수 설명) · `tags`(쉼표·장기계)
**필수:** (`name` 또는 `short_name`) **그리고** `formula`. (공식은 3개국어/정의 없음)

#### C-1. AI에게 주는 글
```
(공통 규칙 먼저) 아래 형식으로 의학 계산공식을 만들어라. system은 장기계 17개 목록에서만. category는 자유(예: Acid-base, Renal, Cardiology...).

{
  "formulas": [
    {
      "id": 8000000000001,
      "name": "공식 이름",
      "short_name": "약어",
      "formula": "계산식",
      "category": "공식 분야 (Acid-base 등)",
      "system": "장기계 17개 중 1개",
      "use_case": "언제 사용",
      "normal_range": "정상 범위",
      "interpretation": "값 해석",
      "example": "예시 계산",
      "memory_tip": "암기 팁",
      "usmle_trap": "USMLE 함정",
      "variables": "변수 설명",
      "tags": "장기계 값, 쉼표"
    }
  ]
}
```

#### C-2. 채운 예시
```json
{
  "formulas": [
    {
      "id": 8000000000001,
      "name": "Anion Gap",
      "short_name": "AG",
      "formula": "AG = Na⁺ − (Cl⁻ + HCO₃⁻)",
      "category": "Acid-base",
      "system": "Renal",
      "use_case": "대사성 산증의 원인 감별",
      "normal_range": "8–12 mEq/L",
      "interpretation": "증가 시 HAGMA (MUDPILES)",
      "example": "Na 140, Cl 100, HCO₃ 16 → AG = 24 (상승)",
      "memory_tip": "MUDPILES",
      "usmle_trap": "저알부민혈증이면 보정 필요(알부민 1g/dL↓당 AG 2.5↑)",
      "variables": "Na, Cl, HCO₃ (mEq/L)",
      "tags": "Renal"
    }
  ]
}
```
**③ 가져오는 곳:** 데이터 관리 → JSON 백업 복원 → 파일 선택 → `신규만 추가`.

---

### D. 미생물 (microbes)

**필드:** `organism`(균명·영어/학명) · `ko_name`(한국어명) · `latin_name`(학명) · `ipa` · `microbe_type`(자유, 예 Bacteria/Virus/Fungus/Parasite) · `gram_stain`(자유, 예 Gram-positive) · `shape`(자유, 예 cocci in chains) · `oxygen`(자유, 예 facultative anaerobe) · `genome`(자유, 예 dsDNA, enveloped) · `virulence`(병독인자) · `diseases`(일으키는 질환) · `diagnosis`(진단) · `treatment`(치료) · `prevention`(예방) · `usmle_clues`(USMLE 단서) · `memory_line` · `category`(장기계·**목록**) · `system_tags`(쉼표)
**필수:** `organism`(영어) 또는 `ko_name` 중 하나 이상.
**주의:** `microbe_type`, `gram_stain` 등은 **자유 텍스트**(고정 목록 없음). 단 `category`만 장기계 목록.

#### D-1. AI에게 주는 글
```
(공통 규칙 먼저) 아래 형식으로 미생물을 만들어라. category만 장기계 17개 목록에서. microbe_type/gram_stain/shape/oxygen/genome은 자유 텍스트.

{
  "microbes": [
    {
      "id": 8000000000001,
      "organism": "균명(영어/학명)",
      "ko_name": "한국어명",
      "latin_name": "학명",
      "ipa": "/발음/",
      "microbe_type": "Bacteria / Virus / Fungus / Parasite",
      "gram_stain": "Gram-positive / Gram-negative / 해당없음",
      "shape": "형태 (cocci in chains 등)",
      "oxygen": "산소요구 (facultative anaerobe 등)",
      "genome": "유전체 (dsDNA, enveloped 등)",
      "virulence": "병독 인자",
      "diseases": "일으키는 질환",
      "diagnosis": "진단 방법",
      "treatment": "치료",
      "prevention": "예방 / 백신",
      "usmle_clues": "USMLE 단서",
      "memory_line": "한 줄 암기",
      "category": "장기계 17개 중 1개 (기본 Infectious Disease)",
      "system_tags": "장기계 값, 쉼표"
    }
  ]
}
```

#### D-2. 채운 예시
```json
{
  "microbes": [
    {
      "id": 8000000000001,
      "organism": "Streptococcus pyogenes",
      "ko_name": "화농성 연쇄상구균",
      "latin_name": "Streptococcus pyogenes",
      "ipa": "/ˌstrɛptəˈkɒkəs paɪˈɒdʒɪniːz/",
      "microbe_type": "Bacteria",
      "gram_stain": "Gram-positive",
      "shape": "cocci in chains",
      "oxygen": "facultative anaerobe",
      "genome": "",
      "virulence": "M protein, streptolysin O, hyaluronidase",
      "diseases": "인두염, 성홍열, 농가진, 류마티스열, 사구체신염",
      "diagnosis": "β-hemolysis, bacitracin 감수성, PYR 양성, ASO 역가",
      "treatment": "Penicillin",
      "prevention": "조기 항생제로 류마티스열 예방",
      "usmle_clues": "bacitracin sensitive, PYR(+), 류마티스열 vs PSGN",
      "memory_line": "사슬알균 = 인두염 후 류마티스열·사구체신염",
      "category": "Infectious Disease",
      "system_tags": "Infectious Disease, ENT"
    }
  ]
}
```
**③ 가져오는 곳:** 데이터 관리 → JSON 백업 복원 → 파일 선택 → `신규만 추가`.

---

### E. 주요 질환 (diseases) — 제일 복잡 (`body` 12섹션)

질환은 **기본 칸 + `body`(12개 임상 섹션)** 구조입니다.

**기본 칸:** `ko_name`(한국어명) · `en_name`(영어명) · `uz_name` · `ipa` · `concept_category`(보통 `Diseases`) · `category`(장기계·목록) · `system_tags`(쉼표) · `one_line_summary`(한 줄 요약) · `acuity`·`emergency`·`progression`·`contagious`(아래 목록) · `body`(섹션 객체)
**필수:** `ko_name` 또는 `en_name` 중 하나 이상.

#### E-1. 기본 칸 선택 목록 (이 값들만)
- `acuity` (경과 속도): `급성` · `아급성` · `만성` · (모르면 `""`)
- `emergency` (응급도): `Emergency` · `Urgent` · `Non-urgent / Outpatient` · `""`
- `progression` (진행양상): `Progressive` · `Episodic` · `Relapsing-remitting` · `Self-limited` · `Latent / Silent` · `""`
- `contagious` (전염성): `전염성 있음` · `전염성 없음` · `조건부 전염` · `""`
- `concept_category`: 보통 `Diseases`
- `category`: 장기계 17개 목록

#### E-2. `body` 12개 섹션 구조
9개는 **객체(칸 모음)**, 3개(`cause`·`red_flags`·`diagnosis`)는 **행 배열(여러 줄)** 입니다.

| 섹션키 | 종류 | 칸 / 행 필드 |
|---|---|---|
| `profile` | 객체 | `chief_complaints`(주증상·쉼표) · `age_group` · `sex_tendency` · `risk_factors` |
| `definition` | 객체 | `ko` · `en` · `uz` |
| `cause` | **행배열** | `category`(목록▼) · `role`(목록▼) · `item`(자유) · `yield`(목록▼) |
| `pathophysiology` | 객체 | `core_mechanism` · `causal_chain` · `cells_tissues` · `molecules` · `step1_link` |
| `symptoms` | 객체 | `main_symptoms` · `exam_findings` · `vignette` · `asymptomatic`(목록▼) |
| `red_flags` | **행배열** | `sign`(자유) · `category`(목록▼) · `action`(자유) |
| `diagnosis` | **행배열** | `item`(목록▼) · `method`(자유) · `usmle`(자유) |
| `treatment` | 객체 | `initial` · `emergency` · `pharmacologic` · `surgical` · `conservative` · `longterm` · `followup` · `contraindications` · `algorithm` |
| `course` | 객체 | `untreated` · `treated` · `acute_exacerbation` · `recurrence` · `chronicity` · `prognosis` · `mortality_disability` |
| `complications` | 객체 | `acute` · `chronic` · `life_threatening` · `treatment_related` |
| `ddx` | 객체 | `similar_diseases` · `distinguishing_points` · `key_tests` · `common_misdiagnosis` |
| `usmle` | 객체 | `high_yield` · `buzzwords` · `next_best_step` · `initial_management` · `best_diagnostic_test` · `traps` · `one_line_memory` |

**행배열 섹션의 선택 목록(▼):**
- `cause.category`: `선천성·유전성·감염성·자가면역성·대사성·내분비/대사성·혈관성·종양성·약물성/독성·의인성·생활습관·생리/스트레스·영양·환경/직업·특발성·기타`
- `cause.role`: `직접 원인·주요 위험인자·악화·유발인자·병태생리 축·보호인자·연관`
- `cause.yield`: `High-yield·Medium·Low·""`
- `symptoms.asymptomatic`: `불가능 / 매우 드묾·가능 (우연히 발견)·흔함 (상당수 무증상)·초기 무증상·선별검사로 발견·우연 발견(영상 등)·""`
- `red_flags.category`: `응급·감염/패혈증·출혈/허혈·신경학적 위험·암 의심·소아/임신 위험·즉시 검사 필요·기타`
- `diagnosis.item`: `가장 먼저 할 검사·확진 검사 (gold standard)·특징적·병리진단적 소견·특징적 검사실 소견·영상 소견·조직/생검 소견·감별 검사·진단 기준·검사 결과 해석·중증도·병기·선별검사 (해당 시)·다음 최선의 단계·진단 알고리즘·기타`

> 모르는 칸은 `""`, 모르는 행배열은 `[]`. 빈 행은 자동으로 버려집니다.

#### E-3. AI에게 주는 글 (질환 — 통째로 복사)
```
(공통 규칙 먼저) 아래 형식으로 주요 질환을 만들어라.
- 기본 칸의 acuity/emergency/progression/contagious, body 안의 cause.category/role/yield·symptoms.asymptomatic·red_flags.category·diagnosis.item 은 각 칸 옆에 적힌 "선택 목록"의 값만 써라.
- body는 12개 섹션 전부 포함. 9개는 객체, cause/red_flags/diagnosis는 행 배열.
- 모르는 칸은 "", 모르는 행배열은 []. 절대 지어내지 마라.

{
  "diseases": [
    {
      "id": 8000000000001,
      "ko_name": "한국어 질환명",
      "en_name": "English disease name",
      "uz_name": "",
      "ipa": "/발음/",
      "concept_category": "Diseases",
      "category": "장기계 17개 중 1개",
      "system_tags": "장기계 값, 쉼표",
      "one_line_summary": "한 줄 요약",
      "acuity": "급성 | 아급성 | 만성 | \"\"",
      "emergency": "Emergency | Urgent | Non-urgent / Outpatient | \"\"",
      "progression": "Progressive | Episodic | Relapsing-remitting | Self-limited | Latent / Silent | \"\"",
      "contagious": "전염성 있음 | 전염성 없음 | 조건부 전염 | \"\"",
      "body": {
        "profile": { "chief_complaints": "주증상(쉼표)", "age_group": "", "sex_tendency": "", "risk_factors": "" },
        "definition": { "ko": "한국어 정의", "en": "English definition", "uz": "" },
        "cause": [ { "category": "원인분류 목록 중 1개", "role": "역할 목록 중 1개", "item": "세부 원인", "yield": "High-yield|Medium|Low|\"\"" } ],
        "pathophysiology": { "core_mechanism": "", "causal_chain": "", "cells_tissues": "", "molecules": "", "step1_link": "" },
        "symptoms": { "main_symptoms": "", "exam_findings": "", "vignette": "", "asymptomatic": "무증상 목록 중 1개 또는 \"\"" },
        "red_flags": [ { "sign": "위험신호", "category": "red_flag 분류 목록 중 1개", "action": "즉시 행동" } ],
        "diagnosis": [ { "item": "diagnosis 항목 목록 중 1개", "method": "검사방법", "usmle": "USMLE 핵심" } ],
        "treatment": { "initial": "", "emergency": "", "pharmacologic": "", "surgical": "", "conservative": "", "longterm": "", "followup": "", "contraindications": "", "algorithm": "" },
        "course": { "untreated": "", "treated": "", "acute_exacerbation": "", "recurrence": "", "chronicity": "", "prognosis": "", "mortality_disability": "" },
        "complications": { "acute": "", "chronic": "", "life_threatening": "", "treatment_related": "" },
        "ddx": { "similar_diseases": "", "distinguishing_points": "", "key_tests": "", "common_misdiagnosis": "" },
        "usmle": { "high_yield": "", "buzzwords": "", "next_best_step": "", "initial_management": "", "best_diagnostic_test": "", "traps": "", "one_line_memory": "" }
      }
    }
  ]
}
```

#### E-4. 채운 예시 (짧은 버전)
```json
{
  "diseases": [
    {
      "id": 8000000000001,
      "ko_name": "급성 심근경색",
      "en_name": "Acute myocardial infarction",
      "uz_name": "",
      "ipa": "",
      "concept_category": "Diseases",
      "category": "Cardiovascular",
      "system_tags": "Cardiovascular",
      "one_line_summary": "관상동맥 폐색으로 인한 심근 괴사.",
      "acuity": "급성",
      "emergency": "Emergency",
      "progression": "Progressive",
      "contagious": "전염성 없음",
      "body": {
        "profile": { "chief_complaints": "흉통, 호흡곤란, 발한", "age_group": "중장년 이상", "sex_tendency": "남성 우세", "risk_factors": "흡연, 당뇨, 고혈압, 이상지질혈증" },
        "definition": { "ko": "관상동맥 혈류 차단으로 심근이 괴사하는 급성 질환.", "en": "Myocardial necrosis from acute coronary artery occlusion.", "uz": "" },
        "cause": [ { "category": "혈관성", "role": "직접 원인", "item": "관상동맥 죽상경화반 파열·혈전", "yield": "High-yield" } ],
        "pathophysiology": { "core_mechanism": "관상동맥 폐색 → 허혈 → 심근 괴사", "causal_chain": "플라크 파열 → 혈전 → 혈류 차단 → 괴사", "cells_tissues": "심근세포", "molecules": "Troponin I/T, CK-MB", "step1_link": "허혈-재관류 손상" },
        "symptoms": { "main_symptoms": "압박성 흉통(>20분), 좌측 팔 방사통", "exam_findings": "S4, 발한, 저혈압", "vignette": "흡연 50대 남성의 갑작스런 흉통", "asymptomatic": "가능 (우연히 발견)" },
        "red_flags": [ { "sign": "지속 흉통 + ST 상승", "category": "응급", "action": "즉시 ECG·재관류(PCI)" } ],
        "diagnosis": [ { "item": "가장 먼저 할 검사", "method": "12-lead ECG", "usmle": "ST 상승/Q파" }, { "item": "확진 검사 (gold standard)", "method": "Troponin 상승", "usmle": "발병 3-6h 상승, 가장 특이적" } ],
        "treatment": { "initial": "MONA + 재관류", "emergency": "STEMI는 90분 내 PCI", "pharmacologic": "Aspirin, P2Y12 억제제, 헤파린, 베타차단제, 스타틴", "surgical": "PCI 또는 CABG", "conservative": "", "longterm": "이차 예방(항혈소판·스타틴·ACEi)", "followup": "심초음파로 EF 평가", "contraindications": "출혈 위험 시 혈전용해 금기", "algorithm": "STEMI→즉시 PCI, NSTEMI→위험도 따라" },
        "course": { "untreated": "치명적 부정맥·심부전·사망", "treated": "조기 재관류 시 예후 양호", "acute_exacerbation": "재경색", "recurrence": "가능", "chronicity": "허혈성 심근병증으로 진행", "prognosis": "재관류 시간에 좌우", "mortality_disability": "심실세동·심인성 쇼크 시 높음" },
        "complications": { "acute": "부정맥, 심인성 쇼크, 유두근 파열", "chronic": "심부전, 심실류", "life_threatening": "심실세동, 심파열", "treatment_related": "재관류 부정맥, 출혈" },
        "ddx": { "similar_diseases": "불안정 협심증, 대동맥 박리, 폐색전증, 심막염", "distinguishing_points": "ECG·트로포닌·통증 양상", "key_tests": "ECG, Troponin, D-dimer, CT", "common_misdiagnosis": "위식도역류·근골격 흉통으로 오인" },
        "usmle": { "high_yield": "STEMI는 즉시 재관류", "buzzwords": "crushing chest pain, ST elevation", "next_best_step": "ECG 먼저", "initial_management": "MONA + 재관류", "best_diagnostic_test": "Troponin", "traps": "후벽 경색은 V1-2 ST 하강", "one_line_memory": "흉통+ST상승=즉시 PCI" }
      }
    }
  ]
}
```
**③ 가져오는 곳:** 데이터 관리 → JSON 백업 복원 → 파일 선택 → `신규만 추가`.

---

## 4. 가져오기 안전 수칙

- **방식은 `신규만 추가(append)` 권장.** 기존 데이터 안 건드림.
- `현재 데이터 교체(replace)`는 통째로 바꾸니 평소엔 쓰지 말 것(가져오기 전 자동 백업은 됨).
- 같은 도메인을 **여러 번** 가져올 때마다 `id` 시작 숫자를 바꾸세요(예: 이번 8000000000001~, 다음 8000000010001~). 같은 id가 이미 있으면 그 항목은 그냥 건너뜁니다(덮어쓰기 안 함, 안전).
- 한 파일에 **여러 도메인**을 같이 넣어도 됩니다: `{ "terms":[...], "drugs":[...], "diseases":[...] }`.
- JSON이 깨지지 않게 — 마지막에 AI에게 *"유효한 JSON인지 확인해라"* 한 번 더 시키면 좋습니다.

---

## 5. 다른 AI도 되나요?

**네.** 이 문서는 특정 AI 전용 기능을 쓰지 않습니다 — **일반 텍스트 규칙 + JSON 형식**이라 ChatGPT · Claude · Gemini · Copilot 등 **어떤 챗봇이든** 그대로 읽고 따를 수 있습니다. AI마다 JSON을 코드블록 밖에 쓰거나 설명을 덧붙이는 버릇이 있으니, "1. 공통 규칙"의 *"JSON 하나만, 설명 금지"* 를 꼭 포함하세요.

> **이 .md 문서는 정적 스냅샷입니다.** 앱이 업데이트되어 필드나 선택 목록이 바뀌면 이 문서는 수동으로 갱신해야 합니다.
> **항상 최신을 원하면 앱 안 `🤖 AI 콘텐츠 양식` 버튼을 쓰세요** — 그 버튼은 양식을 앱의 실제 스키마에서 **자동 생성**합니다: 필드(칸)는 저장 정규화 함수에서, 질환 `body`는 `DISEASE_SECTIONS`에서, 드롭다운 값은 각 옵션 상수에서. **그래서 새 칸·새 섹션·선택값 변경이 생기면 버튼 양식에 자동으로 반영됩니다.** (이 문서와 버튼이 다르면 **버튼이 정답**입니다.)
