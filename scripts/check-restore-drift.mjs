// scripts/check-restore-drift.mjs
// 복원 드리프트 자동 탐지(헤드리스 CI) — in-app computeRestoreGaps의 정적 CI 미러.
// 축: RESTORE — <domain>ToRow가 쓴 DB 컬럼을 rowTo<Domain>이 다시 읽는가(`r.<col>`)?
//   안 읽으면 클라우드엔 저장돼도 새 기기/복원 때 그 값이 안 올라와 조용히 유실.
//   (schema-drift가 normalize↔해시 payload라면, 이건 toRow↔rowTo 왕복 parity.)
//
//   node scripts/check-restore-drift.mjs
//
// ⚠️ "의도된" 신규 컬럼으로 실패하면 = rowTo<Domain>에서 그 컬럼을 읽으라는 신호(불변조건 17·복원 parity).

import { readFileSync } from 'node:fs';

// 실행 코드만(내장 지시문 text/markdown 블록 제외).
const html = readFileSync('index.html', 'utf8').replace(/<script id="rnPatentInstructionDoc"[\s\S]*?<\/script>/i, '');

// DB 컬럼 기준 제외(내용 아님) — in-app computeRestoreGaps의 EXCL과 동일(snake_case).
const EXCL = new Set(['id', 'created_at', 'updated_at', 'deleted_at', 'hidden_at']);

const DOMAINS = [
  { label: '일반용어', toRow: 'termToRow', fromRow: 'rowToTerm' },
  { label: '약물', toRow: 'drugToRow', fromRow: 'rowToDrug' },
  { label: '공식', toRow: 'formulaToRow', fromRow: 'rowToFormula' },
  { label: '미생물', toRow: 'microbeToRow', fromRow: 'rowToMicrobe' },
  { label: '주요 질환', toRow: 'diseaseToRow', fromRow: 'rowToDisease' },
];

// 함수 소스 추출(중괄호 균형) — check-schema-drift.mjs와 동일 기법.
function fnSource(name) {
  let s = html.indexOf(`function ${name}(`);
  if (s < 0) throw new Error(`함수 ${name} 없음`);
  if (html.slice(s - 6, s) === 'async ') s -= 6;
  const bo = html.indexOf('{', s); let d = 0, i = bo;
  for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}') { d--; if (d === 0) { i++; break; } } }
  return html.slice(s, i);
}
function stripComments(s) {
  return String(s).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
// `return {` 객체 리터럴의 최상위 키(=DB 컬럼)만. 삼항 `?:`·중첩 오인 방지(최상위 콤마 분리).
function returnTopLevelKeys(rawSrc) {
  const src = stripComments(rawSrc);
  const a = src.indexOf('return {');
  if (a < 0) return null;
  const open = src.indexOf('{', a);
  let depth = 0, i = open, inner = '';
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') { depth++; if (depth === 1) continue; }
    else if (c === '}') { depth--; if (depth === 0) break; }
    if (depth >= 1) inner += c;
  }
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
  let written, readSet;
  try { written = returnTopLevelKeys(fnSource(d.toRow)); } catch (e) { gaps.push(`${d.label}: ${d.toRow} 추출 실패 — ${e.message}`); continue; }
  try {
    const src = stripComments(fnSource(d.fromRow));
    readSet = new Set((src.match(/\br\.([a-z_][a-z0-9_]*)/g) || []).map(x => x.slice(2)));
  } catch (e) { gaps.push(`${d.label}: ${d.fromRow} 추출 실패 — ${e.message}`); continue; }
  if (!written) { gaps.push(`${d.label}: ${d.toRow} return 리터럴 못 찾음(구조 변경?)`); continue; }
  if (!readSet.size) { gaps.push(`${d.label}: ${d.fromRow}에서 읽는 컬럼(r.<col>)을 못 찾음(구조 변경?)`); continue; }
  const missing = written.filter(c => !EXCL.has(c) && !readSet.has(c));
  if (missing.length) gaps.push(`${d.label}: ${d.toRow}엔 있으나 ${d.fromRow}이 안 읽음 → [${missing.join(', ')}] (복원/새 기기에서 유실 위험 · 복원 parity)`);
}

if (gaps.length) {
  console.error(`❌ 복원 드리프트(restore) ${gaps.length}건:\n` + gaps.map((g, i) => `${i + 1}. ${g}`).join('\n'));
  process.exit(1);
}
console.log(`✅ 복원 드리프트 없음(restore) — 5도메인 toRow가 쓴 컬럼을 rowTo가 모두 다시 읽음(왕복 parity).`);
