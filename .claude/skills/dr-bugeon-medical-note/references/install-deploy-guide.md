# Dr. Bugeon의 Medical Note 설치 및 배포 가이드

작성일: 2026-06-26  
대상 앱: Dr. Bugeon의 Medical Note  
권장 최신 파일: `260626_12.04 Dr. Bugeon의 Medical Note_단권화노트본문이미지삽입.html`

이 문서는 다음 네 가지를 처음부터 끝까지 설정하기 위한 통합 가이드입니다.

- Supabase 설정
- Supabase Edge Function 설정
- Cloudinary 이미지 저장 설정
- GitHub Pages 배포

특히 실제 설정 과정에서 헷갈렸던 부분을 반영했습니다.

- Edge Function 테스트에서 `result: "not found"`는 실패가 아니라 정상일 수 있습니다.
- `502`는 함수가 없다는 뜻이 아니라 Cloudinary 호출이 실패했다는 뜻일 수 있습니다.
- `Invalid cloud_name`은 API Key/Secret 문제가 아니라 Cloud name 오입력입니다.
- GitHub에는 함수 코드만 올리고 Cloudinary Secret 값은 절대 올리지 않습니다.
- Cloudinary upload preset은 반드시 `Unsigned`여야 브라우저에서 직접 업로드됩니다.

---

## 1. 전체 구조 이해

이 앱의 데이터 흐름은 아래처럼 나뉩니다.

```text
앱 HTML
  ├─ Supabase: 용어/약물/미생물/공식/단권화 노트 메타데이터 저장
  ├─ Cloudinary: 단권화 노트 이미지 원본 저장
  └─ Supabase Edge Function: Cloudinary 이미지 완전 삭제
```

이미지는 Supabase DB에 직접 저장하지 않습니다.

```text
Cloudinary에는 이미지 파일 저장
Supabase medical_notes에는 이미지 URL, publicId 같은 메타데이터만 저장
```

이 구조가 중요한 이유:

- HTML 앱에 Cloudinary API Secret을 넣으면 안 됩니다.
- 브라우저에서는 Unsigned upload preset으로 업로드만 합니다.
- 삭제는 API Secret 서명이 필요하므로 Supabase Edge Function에서 처리합니다.

---

## 2. 준비 파일

GitHub와 배포 폴더에는 최소 아래 파일이 필요합니다.

```text
index.html
supabase/functions/delete-cloudinary-image/index.ts
supabase/functions/delete-cloudinary-image/config.toml
```

현재 제공 폴더 기준 파일:

```text
260626_12.04 Dr. Bugeon의 Medical Note_단권화노트본문이미지삽입.html
supabase/functions/delete-cloudinary-image/index.ts
supabase/functions/delete-cloudinary-image/config.toml
```

GitHub Pages에서 `/Medical-Note/`처럼 폴더 주소로 접속하게 하려면, 최신 HTML 파일을 GitHub 저장소에서 보통 `index.html` 이름으로도 올려야 합니다.

---

## 3. Supabase 기본 설정

### 3.1 Supabase 프로젝트 만들기

1. Supabase 접속
2. 새 프로젝트 생성
3. Project URL과 anon public key 확인

위치는 보통 아래 메뉴입니다.

```text
Project Settings → API
```

앱에 넣을 값:

```text
Supabase URL: https://프로젝트-ref.supabase.co
Supabase anon key: eyJ...
```

주의:

- 앱에는 anon public key를 넣습니다.
- service_role key는 앱이나 GitHub에 절대 넣지 않습니다.

### 3.2 Supabase SQL 적용

앱의 개발자 정보 또는 Supabase 설정 화면에 있는 최신 SQL을 Supabase SQL Editor에 붙여넣어 실행합니다.

권장 순서:

1. Supabase Dashboard
2. SQL Editor
3. New query
4. 앱에서 제공하는 통합 SQL 붙여넣기
5. Run

확인해야 할 주요 테이블:

```text
medical_notes
language_sync_meta
```

그리고 기존 도메인 테이블:

```text
terms
drugs
formulas
microbes
```

앱에서 단권화 노트를 Supabase에 저장하려면 `medical_notes` 테이블이 반드시 있어야 합니다.

### 3.3 앱에 Supabase 연결

앱에서:

```text
데이터/백업/동기화 설정 → Supabase 설정
```

또는 앱의 해당 설정 화면에서 아래 값을 입력합니다.

```text
URL: Supabase Project URL
Key: Supabase anon public key
```

연결 테스트가 성공하면 바로 동기화를 실행하는 것이 좋습니다.

---

## 4. Cloudinary 설정

### 4.1 Cloud name 확인

Cloudinary에서 Cloud name은 계정 이름이나 표시 이름이 아닙니다.

위치:

```text
Cloudinary Console → Dashboard / API Keys
```

또는 URL 형태가 아래와 같다면:

```text
cloudinary://API_KEY:API_SECRET@dbuciqybd
```

Cloud name은:

```text
dbuciqybd
```

입니다.

실제 이번 설정에서 확인된 Cloud name:

```text
dbuciqybd
```

### 4.2 Upload preset 만들기

Cloudinary에서:

```text
Settings → Upload → Upload presets → Add upload preset
```

권장 설정:

```text
Upload preset name: medical_note_unsigned
Signing mode: Unsigned
Asset folder: Dr_bugeon_medical_notes
Overwrite: false
Generated public ID: Auto-generate an unguessable public ID value
Generated display name: Use the filename of the uploaded file as the asset's display name
Type: upload
```

핵심:

```text
Signing mode = Unsigned
```

앱은 브라우저에서 Cloudinary로 직접 업로드하므로 Signed preset이면 업로드가 실패합니다.

### 4.3 앱에 Cloudinary 설정 입력

앱의 Cloudinary 이미지 저장 설정에 아래처럼 입력합니다.

```text
Cloud name: dbuciqybd
Unsigned upload preset: medical_note_unsigned
Folder: Dr_bugeon_medical_notes
```

주의:

- `Unsigned upload preset`은 Cloudinary에서 만든 preset 이름과 100% 같아야 합니다.
- 대소문자, `_`, `-`까지 모두 일치해야 합니다.
- `Folder`도 Cloudinary의 Asset folder와 맞추는 것이 관리상 좋습니다.

---

## 5. Supabase Edge Function 설정

Cloudinary 이미지를 업로드하는 것은 브라우저에서 가능하지만, 이미지를 완전 삭제하려면 Cloudinary API Secret이 필요합니다.

API Secret은 앱 HTML이나 GitHub에 넣으면 안 됩니다. 그래서 Supabase Edge Function이 대신 삭제를 처리합니다.

### 5.1 Supabase Secrets 등록

Supabase Dashboard에서:

```text
Edge Functions → Secrets
```

아래 3개를 각각 추가합니다.

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

예시:

```text
CLOUDINARY_CLOUD_NAME = dbuciqybd
CLOUDINARY_API_KEY = Cloudinary에서 확인한 API Key
CLOUDINARY_API_SECRET = Cloudinary에서 확인한 API Secret
```

중요:

- `CLOUDINARY_API_SECRET`은 GitHub에 절대 올리지 않습니다.
- Supabase Secrets에는 넣어도 됩니다.
- API Secret 앞뒤에 공백이 들어가면 `Invalid Signature`가 날 수 있습니다.

### 5.2 Edge Function 만들기

Supabase Dashboard에서:

```text
Edge Functions → Functions → Open Editor
```

함수 이름:

```text
delete-cloudinary-image
```

앱은 아래 경로를 호출합니다.

```text
/functions/v1/delete-cloudinary-image
```

따라서 함수 이름은 반드시 정확히 같아야 합니다.

### 5.3 index.ts 코드

Supabase 웹 에디터에서 `index.ts` 전체를 아래 코드로 교체합니다. (이 코드는 저장소 `supabase/functions/delete-cloudinary-image/index.ts`와 동일해야 합니다.)

```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha1Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-1', data);
  return [...new Uint8Array(hash)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const { publicId } = await req.json();
    const normalizedPublicId = String(publicId || '').trim();

    if (!normalizedPublicId) {
      return jsonResponse({ ok: false, error: 'publicId is required' }, 400);
    }

    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME') || '';
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY') || '';
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET') || '';

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('Cloudinary env missing', {
        hasCloudName: Boolean(cloudName),
        hasApiKey: Boolean(apiKey),
        hasApiSecret: Boolean(apiSecret),
      });

      return jsonResponse(
        {
          ok: false,
          error: 'Cloudinary environment variables are missing',
          hasCloudName: Boolean(cloudName),
          hasApiKey: Boolean(apiKey),
          hasApiSecret: Boolean(apiSecret),
        },
        500
      );
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();

    const signature = await sha1Hex(
      `invalidate=true&public_id=${normalizedPublicId}&timestamp=${timestamp}${apiSecret}`
    );

    const params = new URLSearchParams({
      public_id: normalizedPublicId,
      api_key: apiKey,
      timestamp,
      signature,
      invalidate: 'true',
    });

    const cloudinaryRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      }
    );

    const result = await cloudinaryRes.json().catch(() => ({}));

    const cloudinaryOk =
      cloudinaryRes.ok &&
      (result.result === 'ok' || result.result === 'not found');

    if (!cloudinaryOk) {
      console.error('Cloudinary destroy failed', {
        publicId: normalizedPublicId,
        status: cloudinaryRes.status,
        statusText: cloudinaryRes.statusText,
        result,
      });
    }

    return jsonResponse(
      {
        ok: cloudinaryOk,
        publicId: normalizedPublicId,
        cloudinaryStatus: cloudinaryRes.status,
        cloudinaryStatusText: cloudinaryRes.statusText,
        result,
      },
      cloudinaryOk ? 200 : 502
    );
  } catch (error) {
    console.error('delete-cloudinary-image failed', error);

    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});
```

### 5.4 config.toml

Supabase 웹 에디터에서는 `config.toml`을 꼭 추가하지 않아도 됩니다.

하지만 GitHub/CLI 배포용으로는 아래 파일을 같이 보관하는 것이 좋습니다.

파일:

```text
supabase/functions/delete-cloudinary-image/config.toml
```

내용(저장소 기준):

```toml
verify_jwt = true
```

> 참고: `verify_jwt = true`이므로 함수 호출 시 `Authorization: Bearer <anon key>` 헤더가 필요합니다. 앱의 `deleteImageFromCloudinary`가 Supabase anon key를 Bearer로 함께 보내므로 정상 동작합니다.

### 5.5 Deploy

Supabase 웹 에디터에서:

```text
Save / Deploy
```

배포 후 함수 URL이 보이면 생성 성공입니다.

예:

```text
https://프로젝트-ref.supabase.co/functions/v1/delete-cloudinary-image
```

---

## 6. Edge Function 테스트

Supabase Edge Function 화면에서:

```text
Test
```

HTTP Method:

```text
POST
```

Request Body:

```json
{
  "publicId": "test"
}
```

성공 예시:

```json
{
  "ok": true,
  "publicId": "test",
  "cloudinaryStatus": 200,
  "cloudinaryStatusText": "OK",
  "result": {
    "result": "not found"
  }
}
```

여기서 `not found`는 실패가 아닙니다.

`test`라는 publicId의 이미지가 없다는 뜻일 뿐이고, Cloudinary API 호출과 인증은 정상이라는 뜻입니다.

성공으로 판단하는 기준:

```text
ok: true
cloudinaryStatus: 200
result.result: "not found" 또는 "ok"
```

---

## 7. 오류 해결표

### 7.1 502 Edge function returned an error

의미:

```text
Edge Function은 실행됐지만 Cloudinary API 호출이 실패함
```

확인:

```text
Edge Functions → delete-cloudinary-image → Logs
```

또는 Test 응답 Body의 `result.error.message` 확인

### 7.2 Invalid cloud_name

예:

```text
Invalid cloud_name drbugeon
```

원인:

```text
CLOUDINARY_CLOUD_NAME이 실제 Cloudinary cloud name이 아님
```

해결:

Cloudinary Dashboard/API Keys에서 정확한 Cloud name을 확인하고 Supabase Secret을 교체합니다.

이번에 확인된 올바른 값:

```text
dbuciqybd
```

### 7.3 Invalid Signature

원인:

- `CLOUDINARY_API_SECRET` 오입력
- 앞뒤 공백 포함
- 다른 Cloudinary 계정의 API Secret 입력

해결:

Cloudinary에서 API Secret을 다시 복사해 Supabase Secrets에서 Replace 합니다.

### 7.4 Unknown API key / Invalid api_key

원인:

```text
CLOUDINARY_API_KEY 오입력
```

해결:

Cloudinary Dashboard/API Keys에서 API Key를 다시 확인합니다.

### 7.5 Cloudinary environment variables are missing

원인:

Supabase Secrets 이름 오타 또는 누락

정확한 이름:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

### 7.6 앱에서 이미지 업로드 실패

가능한 원인:

- Upload preset이 `Signed`로 되어 있음
- 앱의 preset 이름과 Cloudinary preset 이름이 다름
- Cloud name 오입력
- Cloudinary preset이 저장되지 않음

확인할 앱 설정:

```text
Cloud name: dbuciqybd
Unsigned upload preset: medical_note_unsigned
Folder: Dr_bugeon_medical_notes
```

확인할 Cloudinary preset:

```text
Name: medical_note_unsigned
Mode: Unsigned
Asset folder: Dr_bugeon_medical_notes
```

---

## 8. GitHub 배포 방법

### 8.1 GitHub에 올릴 파일

GitHub 저장소에는 아래를 올립니다.

```text
index.html
supabase/functions/delete-cloudinary-image/index.ts
supabase/functions/delete-cloudinary-image/config.toml
```

`index.html`은 최신 HTML 앱 파일입니다.

예를 들어 제공 파일이:

```text
260626_12.04 Dr. Bugeon의 Medical Note_단권화노트본문이미지삽입.html
```

이라면 GitHub Pages용으로는 보통 이 파일을 복사해서:

```text
index.html
```

로 올립니다.

### 8.2 GitHub에 올리면 안 되는 파일/값

절대 올리지 않습니다.

```text
CLOUDINARY_API_SECRET
CLOUDINARY_API_KEY가 들어간 .env
Supabase service_role key
Supabase database password
개인 토큰
```

Cloudinary `CLOUDINARY_CLOUD_NAME`은 비밀값은 아니지만, 통일성을 위해 문서에만 기록하고 Secret 값 전체를 GitHub에 직접 넣지 않는 습관이 좋습니다.

### 8.3 GitHub Pages 설정

GitHub 저장소에서:

```text
Settings → Pages
```

권장:

```text
Source: Deploy from a branch
Branch: main
Folder: /root
```

또는 `/docs` 폴더를 쓰는 경우:

```text
Branch: main
Folder: /docs
```

GitHub Pages 주소 예:

```text
https://사용자명.github.io/Medical-Note/
```

폴더 주소로 접속할 때는 저장소 루트에 `index.html`이 있어야 자동으로 열립니다.

### 8.4 자동 배포 (데스크톱 — git 직접 push)

수동 웹 업로드 대신, 배포 저장소를 로컬에 클론해 **최신 버전 HTML → `index.html` 복사 → commit → push**로 자동화한다. 배포 = main 루트의 `index.html` 교체일 뿐임을 잊지 않는다.

- **사전 준비(1회):** ① `git config --global user.name/user.email` 설정 ② 배포 repo를 HTTPS로 클론 ③ 인증 — **Git for Windows의 Git Credential Manager(`git-credential-manager.exe`)가 있으면 gh CLI·PAT 불필요**. 첫 `git push` 때 브라우저 로그인 1회 → 이후 자동 저장. (GCM 없으면 `winget install GitHub.cli` 후 `gh auth login`, 또는 PAT.)
- **배포 스크립트 패턴(PowerShell):** 앱 폴더에서 *가장 최근 수정된 `*.html`*(index.html 제외) 선택 → `version:'X.XX'` 추출 → 클론의 `index.html`로 복사 → `git add index.html` → 변경 있으면 `git commit -m "deploy vX.XX (파일명)"` → `git push`. 실행 전 선택 파일·버전을 보여주고 y/N 확인. 더블클릭용 `.bat`(`powershell -ExecutionPolicy Bypass -File ...`)로 감싸면 편하다.
- **머신별 구체값(저장소 주소·클론 경로·스크립트 위치·Pages URL)은 스킬이 아니라 사용자별 메모리에 둔다** — 스킬에는 위 절차만, 실제 경로는 메모리(예: `medical-note-deploy`) 참조.
- **모바일/웹 환경에서는 이 절(8.4)을 실행할 수 없다.** 로컬 git/파일시스템이 없으므로, 새 HTML은 채팅/아티팩트로 전달하고 **배포는 데스크톱에서 수행하도록 안내**한다(§ SKILL "실행 환경" 참고).
- **완료 보고에 배포 결과를 포함**한다: 푸시한 커밋/버전, Pages URL, 첫 배포면 "브라우저 로그인 1회 필요" 안내. push를 사용자가 직접 해야 하면 그 사실을 분명히 적는다.

### 8.5 GitHub에 Edge Function 파일을 올리는 이유

GitHub에 아래 파일을 올려도 자동으로 실행되지는 않습니다.

```text
supabase/functions/delete-cloudinary-image/index.ts
supabase/functions/delete-cloudinary-image/config.toml
```

이 파일들은:

- 버전관리
- 나중에 재배포
- 다른 PC에서 복원
- 변경 이력 추적

을 위한 것입니다.

실제 실행은 Supabase에 배포된 Edge Function이 담당합니다.

---

## 9. Supabase CLI로 Edge Function 재배포하기

웹 에디터 대신 CLI를 쓰는 경우 아래 구조가 필요합니다.

```text
supabase/
  functions/
    delete-cloudinary-image/
      index.ts
      config.toml
```

배포:

```bash
supabase functions deploy delete-cloudinary-image
```

Secrets 설정:

```bash
supabase secrets set CLOUDINARY_CLOUD_NAME="dbuciqybd"
supabase secrets set CLOUDINARY_API_KEY="본인_API_KEY"
supabase secrets set CLOUDINARY_API_SECRET="본인_API_SECRET"
```

주의:

- 이 명령은 로컬 터미널에서 Supabase CLI 로그인과 project link가 된 상태여야 합니다.
- 초보 단계에서는 Supabase 웹 에디터가 더 쉽습니다.

---

## 10. 최종 동작 확인 체크리스트

### 10.1 Cloudinary 업로드 확인

1. 앱 열기
2. Cloudinary 설정 저장
3. 단권화 노트 편집 열기
4. 본문 편집기 커서 위치 클릭
5. 이미지 버튼 또는 이미지 추가 클릭
6. 이미지 업로드
7. 본문에 이미지가 바로 보이는지 확인
8. 저장

### 10.2 Cloudinary Media Library 확인

Cloudinary Console에서:

```text
Image → Media Library
```

폴더:

```text
Dr_bugeon_medical_notes
```

앱에서 업로드한 이미지가 보여야 합니다.

### 10.3 저장/다시 열기 확인

1. 노트 저장
2. 노트 닫기
3. 다시 노트 열기
4. 본문 안 이미지가 유지되는지 확인

### 10.4 삭제 확인

1. 노트 편집
2. 첨부 썸네일에서 이미지 삭제
3. 본문 안 같은 이미지도 같이 사라지는지 확인
4. 저장
5. Cloudinary에서 원본 삭제가 반영되는지 확인

### 10.5 취소 확인

1. 노트 편집
2. 새 이미지 업로드
3. 저장하지 않고 닫기
4. 새로 업로드된 이미지가 정리되는지 확인

---

## 11. 운영 원칙

### 11.1 최신 HTML 파일 관리

업데이트 파일명은 아래 규칙을 따릅니다.

```text
날짜_시간 앱이름_업데이트내역.html
```

예:

```text
260626_12.04 Dr. Bugeon의 Medical Note_단권화노트본문이미지삽입.html
```

GitHub Pages 배포 시에는 이 최신 파일을 `index.html`로도 반영합니다.

### 11.2 앱 내부 버전 확인

앱의 개발자 정보에서 확인합니다.

```text
앱 이름
버전
코드 최종 수정 시각
현재 파일명
업데이트 이력
```

이번 Cloudinary/본문 이미지 삽입 이후 버전:

```text
v4.46
```

### 11.3 Secret 관리

Secret은 세 곳으로 나눠 관리합니다.

```text
앱 localStorage: Supabase URL, anon key, Cloudinary cloud name, upload preset
Supabase Secrets: Cloudinary API Secret 등 서버 전용 값
GitHub: 코드와 문서만
```

GitHub에 Secret을 넣지 않습니다.

---

## 12. 빠른 복구 절차

새 PC나 새 브라우저에서 다시 설정할 때:

1. GitHub Pages 또는 최신 HTML 파일 열기
2. Supabase URL/anon key 입력
3. Cloudinary 설정 입력

```text
Cloud name: dbuciqybd
Unsigned upload preset: medical_note_unsigned
Folder: Dr_bugeon_medical_notes
```

4. Supabase Edge Function이 살아 있는지 Test
5. 앱에서 동기화
6. 단권화 노트 이미지 업로드 테스트

---

## 13. 최종 성공 기준

아래가 모두 되면 배포 완료입니다.

```text
GitHub Pages에서 앱이 열린다.
Supabase 연결 테스트가 성공한다.
단권화 노트가 Supabase에 저장된다.
Cloudinary 이미지 업로드가 된다.
본문 편집기 안에 이미지가 바로 삽입된다.
노트 저장 후 다시 열어도 이미지가 유지된다.
Edge Function Test에서 ok: true가 나온다.
이미지 제거/보호기록 정리 시 Cloudinary 삭제가 동작한다.
```

Edge Function 테스트 성공 예:

```json
{
  "ok": true,
  "publicId": "test",
  "cloudinaryStatus": 200,
  "cloudinaryStatusText": "OK",
  "result": {
    "result": "not found"
  }
}
```

이 응답은 정상입니다.
