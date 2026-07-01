// scripts/check-schema-drift.mjs
// 스키마 드리프트 자동 탐지(헤드리스 CI) — 앱 개발자 패널의 자기점검을 커밋 단계로 끌어올린다.
// 축: PROPAGATION — normalize<D>ForStorage의 편집 내용 필드가 canonical<D>HashPayload에 다 있는가?
//   빠지면 그 필드만 수정 시 스냅샷 해시가 그대로라 "변경 없음" 오판 → 다른 기기로 전파 안 됨(조용한 유실).
//   (이번 세션의 parent_id·favorite 버그가 정확히 이 축. in-app computePropagationGaps의 정적 CI 미러.)
//
//   node scripts/check-schema-drift.mjs
//
// ⚠️ 이 검사가 "의도된" 신규 필드로 실패하면 = 그 필드를 canonical*HashPayload에 추가하라는 신호(불변조건 11).

import { readFileSync } from 'node:fs';

// 실행 코드만(내장 지시문 text/markdown 블록의 동명 함수 제외).
const html = readFileSync('index.html', 'utf8').replace(/<script id="rnPatentInstructionDoc"[\s\S]*?<\/script>/i, '');

// 해시 페이로드에서 제외되는(내용 아님) 필드 — in-app computePropagationGaps의 EXCL과 동일.
const EXCL = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt', 'hiddenAt', 'conceptCategory']);

const DOMAINS = [
  { label: '일반용어', norm: 'normalizeTermForStorage', payload: 'canonicalTermHashPayload' },
  { label: '약물', norm: 'normalizeDrugForStorage', payload: 'canonicalDrugHashPayload' },
  { label: '공식', norm: 'normalizeFormulaForStorage', payload: 'canonicalFormulaHashPayload' },
  { label: '미생물', norm: 'normalizeMicrobeForStorage', payload: 'canonicalMicrobeHashPayload' },
  { label: '주요 질환', norm: 'normalizeDiseaseForStorage', payload: 'canonicalDiseaseHashPayload' },
];

// 함수 소스 추출(중괄호 균형).
function fnSource(name) {
  let s = html.indexOf(`function ${name}(`);
  if (s < 0) throw new Error(`함수 ${name} 없음`);
  if (html.slice(s - 6, s) === 'async ') s -= 6;
  const bo = html.indexOf('{', s); let d = 0, i = bo;
  for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}') { d--; if (d === 0) { i++; break; } } }
  return html.slice(s, i);
}
// 주석 제거 — 객체 리터럴 속성 위 주석(예: parent_id 위 설명)이 키 추출을 깨뜨리는 것 방지(://는 보존).
function stripComments(s) {
  return String(s).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
// anchor(`return {` 또는 `stableForHash({`)로 시작하는 객체 리터럴의 **최상위 키**만 뽑는다.
// 최상위 콤마로 분리(중첩 (){}[] 무시) 후 각 조각의 선행 `key:` 추출 → 삼항 `?:`·중첩 오인 방지.
function topLevelKeys(rawSrc, anchor) {
  const src = stripComments(rawSrc);
  const a = src.indexOf(anchor);
  if (a < 0) return null;
  const open = src.indexOf('{', a);
  let depth = 0, i = open, inner = '';
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') { depth++; if (depth === 1) continue; }
    else if (c === '}') { depth--; if (depth === 0) break; }
    if (depth >= 1) inner += c;
  }
  // 최상위 콤마 분리
  const parts = []; let buf = '', dd = 0;
  for (const c of inner) {
    if ('{[('.includes(c)) dd++;
    else if ('}])'.includes(c)) dd--;
    if (c === ',' && dd === 0) { parts.push(buf); buf = ''; continue; }
    buf += c;
  }
  parts.push(buf);
  const keys = [];
  for (const p of parts) { const m = p.match(/^\s*['"]?([A-Za-z_]\w*)['"]?\s*:/); if (m) keys.push(m[1]); }
  return keys;
}

const gaps = [];
for (const d of DOMAINS) {
  let normKeys, payKeys;
  try { normKeys = topLevelKeys(fnSource(d.norm), 'return {'); } catch (e) { gaps.push(`${d.label}: ${d.norm} 추출 실패 — ${e.message}`); continue; }
  try { payKeys = topLevelKeys(fnSource(d.payload), 'stableForHash({'); } catch (e) { gaps.push(`${d.label}: ${d.payload} 추출 실패 — ${e.message}`); continue; }
  if (!normKeys || !payKeys) { gaps.push(`${d.label}: 리터럴 앵커 못 찾음(구조 변경?)`); continue; }
  const paySet = new Set(payKeys);
  const missing = normKeys.filter(k => !EXCL.has(k) && !paySet.has(k));
  if (missing.length) gaps.push(`${d.label}: normalize엔 있으나 canonical 해시 payload에 없음 → [${missing.join(', ')}] (전파 안 됨 위험 · 불변조건 11)`);
}

if (gaps.length) {
  console.error(`❌ 스키마 드리프트(propagation) ${gaps.length}건:\n` + gaps.map((g, i) => `${i + 1}. ${g}`).join('\n'));
  process.exit(1);
}
console.log(`✅ 스키마 드리프트 없음(propagation) — 5도메인 normalize 내용 필드가 canonical 해시 payload에 모두 포함.`);
