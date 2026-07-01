// scripts/check-version-bump.mjs
// 버전 범프 강제(헤드리스 CI) — index.html이 바뀌었는데 버전·이력을 안 올리면 실패.
//   AGENTS.md §4: 매 앱 변경마다 APP_INFO.version +0.01 + UPDATE_HISTORY 최상단 새 항목,
//   그리고 "최신 · " 접두사는 [0]에만. 이 "소프트 규칙"을 기계로 승격한다.
//
//   node scripts/check-version-bump.mjs           # base = origin/main(기본)
//   BASE_REF=<ref> node scripts/check-version-bump.mjs
//
// 검사:
//   불변(base 무관): UPDATE_HISTORY의 "최신 · " 접두사는 정확히 1개(=[0]).
//   변경 시(base와 index.html이 다를 때): 버전 증가 + 최상단 이력 항목 신규.

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// version: '2.16' → 216 (이 앱은 minor 2자리, 1.99→2.00 롤. parseFloat 금지: 2.16 > 2.9 이어야 함).
function verNum(s) { const [a, b] = String(s || '').split('.'); return Number(a) * 100 + Number(b || 0); }

function extract(html) {
  const version = (html.match(/version:\s*'([\d.]+)'/) || [])[1] || null;
  const uh = html.indexOf('const UPDATE_HISTORY');
  const block = uh >= 0 ? html.slice(uh, uh + 6000) : '';
  const titles = [...block.matchAll(/title:\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
  const latestCount = (html.match(/title:\s*'최신 · /g) || []).length;
  return { version, titles, latestCount };
}

const cur = readFileSync('index.html', 'utf8');
const baseRef = process.env.BASE_REF || 'origin/main';
let base = null;
try { base = execSync(`git show ${baseRef}:index.html`, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }); } catch {}

const errors = [];
const C = extract(cur);

// ── 불변(base 무관) ──
if (!C.version) errors.push('APP_INFO.version을 못 읽음(형식 변경?).');
if (C.latestCount !== 1) errors.push(`UPDATE_HISTORY의 "최신 · " 접두사가 ${C.latestCount}개 — 정확히 1개(맨 위 항목만)여야 함(AGENTS §4).`);
if (C.titles[0] && !C.titles[0].startsWith('최신 · ')) errors.push(`UPDATE_HISTORY[0] 제목이 "최신 · "로 시작하지 않음: "${C.titles[0]}".`);

// ── 변경 시(버전 증가 + 새 이력) ──
if (base == null) {
  console.warn(`⚠️ base(${baseRef}) index.html을 못 읽어 버전 증가 검사는 건너뜀 — 불변 검사만 수행(CI에선 origin/main fetch 필요).`);
} else if (base === cur) {
  // index.html 변경 없음 → 범프 불필요.
} else {
  const B = extract(base);
  if (!(verNum(C.version) > verNum(B.version)))
    errors.push(`index.html이 변경됐는데 버전이 안 올랐음: base ${B.version} → 현재 ${C.version} (AGENTS §4: 매 변경 +0.01).`);
  if (C.titles[0] && B.titles[0] && C.titles[0] === B.titles[0])
    errors.push(`index.html이 변경됐는데 UPDATE_HISTORY 최상단이 그대로 — 새 항목을 추가해야 함(현재[0]="${C.titles[0]}").`);
}

if (errors.length) {
  console.error(`❌ 버전 범프/이력 규칙 ${errors.length}건:\n` + errors.map((e, i) => `${i + 1}. ${e}`).join('\n'));
  process.exit(1);
}
console.log(`✅ 버전 범프 OK — v${C.version} · UPDATE_HISTORY "최신 ·" 1개 · ${base == null ? 'base 미확인(불변만)' : base === cur ? 'index.html 무변경' : '변경분 버전 증가·새 이력 확인'}.`);
