// scripts/build-research-manifest.mjs
// Supabase의 research_notes_med(전용 테이블)를 읽어 "해시 전용 매니페스트"를 만든다. 발명 원문은 0% — 화이트리스트 필드만.
// 목적: "이 해시들이 그 시각에 존재했다"를 공개 Release로 증명하되, 발명 내용은 노출 0 → 특허 신규성 안전.
// ⚠️ ALLOW 목록은 index.html의 RN_MANIFEST_FIELDS와 반드시 동일하게 유지할 것(둘이 어긋나면 안 됨).
// 필요 시크릿: SUPABASE_URL, SUPABASE_KEY (RLS 꺼진 상태면 anon 키로 읽힘. RLS 켜면 service_role 키 사용).

import { writeFileSync } from 'node:fs';

const ALLOW = ['id', 'evidence_chain_id', 'created_at', 'server_time', 'app_version', 'event_type',
  'entry_hash', 'previous_entry_hash', 'signature_algo', 'entry_hash_signature', 'public_key_jwk',
  'tsa_provider', 'tsa_request_hash', 'tsa_timestamp', 'tsa_token', 'tsa_status'];

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_KEY;
if (!url || !key) { console.error('❌ SUPABASE_URL / SUPABASE_KEY 시크릿이 필요합니다'); process.exit(1); }

// 전용 테이블 research_notes_med(자매 앱과 격리). 옛 공유 테이블 research_notes는 섞임 이슈로 폐기.
// project_name 필터는 방어선(전용 테이블이라 이미 자기 것뿐이지만, 혹시 모를 혼입 대비).
const RN_TABLE = 'research_notes_med';
const RN_PROJECT_NAME = 'Dr. Bugeon의 Medical Note'; // index.html의 RN_PROJECT_NAME과 동일하게 유지
const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${RN_TABLE}?select=data&order=created_at.asc&limit=100000`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
if (!res.ok) { console.error('❌ Supabase read 실패', res.status, await res.text()); process.exit(1); }
const rows = await res.json();
const _own = (x) => x && x.id && (x.project_name === RN_PROJECT_NAME || !x.project_name);
const notes = (Array.isArray(rows) ? rows : []).map(r => r.data).filter(_own);

const pick = (e) => { const o = {}; ALLOW.forEach(k => { if (e[k] !== undefined && e[k] !== null && e[k] !== '') o[k] = e[k]; }); return o; };
const entries = notes.map(pick);

// 안전장치: 허용 목록 밖 키가 하나라도 있으면 즉시 중단(원문 유출 0 보장).
for (const e of entries) for (const k of Object.keys(e)) {
  if (!ALLOW.includes(k)) { console.error('❌ 허용 목록 밖 키 발견 →', k, '(원문 유출 위험, 중단)'); process.exit(1); }
}

const manifest = {
  manifest_version: 1,
  type: 'hash-only-manifest',
  note: '발명 원문 없음(해시·시각·서명·TSA만). "이 해시들이 그 시각에 존재했다"의 공개 증명용 — public disclosure(신규성 상실) 방지. 원문은 발명자 기기·비공개 저장소에만 있음.',
  generated_at: new Date().toISOString(),
  count: entries.length,
  chain_head: notes.length ? (notes[notes.length - 1].entry_hash || '') : '',
  allowlist: ALLOW,
  entries,
};

writeFileSync('research_hash_manifest.json', JSON.stringify(manifest, null, 2));
console.log(`✅ 매니페스트 생성: ${entries.length}건 · chain_head=${(manifest.chain_head || '').slice(0, 16)}…`);
