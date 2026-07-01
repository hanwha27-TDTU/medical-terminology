// Supabase Edge Function: rfc3161-timestamp
// 연구노트의 SHA-256 해시를 받아 RFC3161 TSA 서버에 공인 타임스탬프를 요청하고
// TimeStampToken(TST)을 돌려준다. 브라우저는 CORS·바이너리(ASN.1) 때문에 TSA를 직접 못 부르므로
// 이 함수가 서버 측에서 중계한다. TSA는 원본이 아니라 "해시"만 받는다(프라이버시 보존).
//
// 배포:  supabase functions deploy rfc3161-timestamp
// 환경변수(선택): TSA_URL (기본 https://freetsa.org/tsr), TSA_PROVIDER (표시 이름)
//
// 요청  body: { "hash": "<hex sha256>", "hashAlgo": "sha256" }
// 응답  body: { "provider": "...", "token": "<base64 TST>", "timestamp": "<ISO8601 best-effort>" }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const TSA_URL = Deno.env.get('TSA_URL') || 'https://freetsa.org/tsr';
const TSA_PROVIDER = Deno.env.get('TSA_PROVIDER') || (() => { try { return new URL(TSA_URL).hostname; } catch { return 'RFC3161 TSA'; } })();

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
  if (clean.length % 2 !== 0) throw new Error('bad hex length');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

// SHA-256 (2.16.840.1.101.3.4.2.1) 고정 messageImprint으로 DER TimeStampReq을 만든다. version=1, certReq=TRUE.
function buildTimeStampReq(hash: Uint8Array): Uint8Array {
  if (hash.length !== 32) throw new Error('sha256 hash must be 32 bytes');
  const sha256OidAlgId = [0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00];
  const hashedMessage = [0x04, 0x20, ...hash];                               // OCTET STRING (32)
  const miContent = [...sha256OidAlgId, ...hashedMessage];
  const messageImprint = [0x30, miContent.length, ...miContent];            // SEQUENCE
  const version = [0x02, 0x01, 0x01];                                        // INTEGER 1
  const certReq = [0x01, 0x01, 0xff];                                        // BOOLEAN TRUE
  const reqContent = [...version, ...messageImprint, ...certReq];
  return new Uint8Array([0x30, reqContent.length, ...reqContent]);          // TimeStampReq SEQUENCE (길이 < 128 가정: 실제 ~59B)
}

// 최소 DER TLV 리더 — 이 함수가 다루는 응답 크기에선 길이 필드가 짧은(short/2~3byte long) 형태만 나온다.
function readTLV(buf: Uint8Array, pos: number) {
  const tag = buf[pos];
  let len = buf[pos + 1];
  let headerLen = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | buf[pos + 2 + i];
    headerLen = 2 + n;
  }
  const valueStart = pos + headerLen;
  return { tag, len, valueStart, valueEnd: valueStart + len, totalEnd: valueStart + len };
}

// TimeStampResp ::= SEQUENCE { status PKIStatusInfo, timeStampToken ContentInfo OPTIONAL }
// PKIStatusInfo의 첫 INTEGER(status)가 0(granted)/1(grantedWithMods)이어야 함. 그다음 요소가 토큰(ContentInfo).
function extractToken(resp: Uint8Array): { token: Uint8Array; status: number } {
  const outer = readTLV(resp, 0);                       // TimeStampResp SEQUENCE
  const statusInfo = readTLV(resp, outer.valueStart);   // PKIStatusInfo SEQUENCE
  const statusInt = readTLV(resp, statusInfo.valueStart); // INTEGER status
  let status = 0;
  for (let i = statusInt.valueStart; i < statusInt.valueEnd; i++) status = (status << 8) | resp[i];
  if (status !== 0 && status !== 1) return { token: new Uint8Array(0), status };
  // 토큰은 statusInfo 바로 뒤 요소(있으면). 없으면 빈 토큰.
  if (statusInfo.totalEnd >= outer.valueEnd) return { token: new Uint8Array(0), status };
  const tok = readTLV(resp, statusInfo.totalEnd);       // ContentInfo (SEQUENCE)
  return { token: resp.slice(statusInfo.totalEnd, tok.totalEnd), status };
}

// TST 안의 genTime(GeneralizedTime, tag 0x18, "YYYYMMDDHHMMSS[.fff]Z")을 best-effort로 스캔해 ISO8601로.
function extractGenTime(token: Uint8Array): string {
  for (let i = 0; i + 2 < token.length; i++) {
    if (token[i] !== 0x18) continue;
    const len = token[i + 1];
    if (len < 13 || len > 24 || i + 2 + len > token.length) continue;
    const s = new TextDecoder().decode(token.slice(i + 2, i + 2 + len));
    const m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] || ''}Z`;
  }
  return '';
}

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  try {
    const { hash, hashAlgo } = await req.json();
    if ((hashAlgo || 'sha256') !== 'sha256') return json({ error: 'only sha256 supported' }, 400);
    const hashBytes = hexToBytes(String(hash || ''));
    const reqDer = buildTimeStampReq(hashBytes);

    const tsaRes = await fetch(TSA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/timestamp-query' },
      body: reqDer,
    });
    if (!tsaRes.ok) return json({ error: `TSA HTTP ${tsaRes.status}` }, 502);
    const respDer = new Uint8Array(await tsaRes.arrayBuffer());

    const { token, status } = extractToken(respDer);
    if (!token.length) return json({ error: `TSA status ${status} (no token)` }, 502);

    return json({ provider: TSA_PROVIDER, token: b64(token), timestamp: extractGenTime(token) });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 400);
  }
});
