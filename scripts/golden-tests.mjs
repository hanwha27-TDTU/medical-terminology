// scripts/golden-tests.mjs
// 순수함수 골든테스트 — 리팩토링이 "행위보존"인지 자동 증명하는 안전망.
// index.html에서 대상 순수함수의 소스를 추출해 실제로 실행하고, 기준 규칙과 입력→출력이 일치하는지 확인한다.
// 리팩토링(추출·통합) 전후로 이 테스트가 계속 통과하면 동작이 안 바뀌었다는 뜻.
// 새 순수함수를 통합/추출할 때마다 여기 케이스를 추가하라. (⚠️ 자기완결 순수함수만 — 다른 함수를 호출하면
//  eval 스코프에 그 의존함수가 없어 실패한다. 의존이 있으면 그 함수도 함께 추출해 같은 스코프에서 eval할 것.)
//
//   node scripts/golden-tests.mjs

import { readFileSync } from 'node:fs';

const rawHtml = readFileSync('index.html', 'utf8');
// 실행 코드만 대상 — 내장 지시문(type="text/markdown") 블록엔 같은 이름의 예제 함수가 있어 추출이 헷갈릴 수 있다.
const html = rawHtml.replace(/<script id="rnPatentInstructionDoc"[\s\S]*?<\/script>/i, '');
const failures = [];

// index.html에서 `function NAME(...) { ... }` 선언 하나를 추출해 실행 가능한 함수로 만든다.
// (중괄호 균형으로 본문 끝을 찾음 — 대상 순수 유틸들엔 문자열/정규식 내 중괄호가 없으니 충분.)
function extractFn(name) {
  const start = html.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`함수 ${name} 를 실행 코드에서 찾지 못함`);
  const braceOpen = html.indexOf('{', start);
  let depth = 0, i = braceOpen;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return eval('(' + html.slice(start, i) + ')');
}

function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) failures.push(`${label}: 기대 ${e} · 실제 ${a}`);
}
// 기준 구현(의도한 규칙)과 index.html 실제 함수가 배터리 전체에서 일치하는지 대조.
function golden(name, refImpl, battery) {
  let fn;
  try { fn = extractFn(name); } catch (e) { failures.push(`${name}: 추출 실패 — ${e.message}`); return; }
  for (const inp of battery) check(`${name}(${JSON.stringify(inp)})`, fn(inp), refImpl(inp));
}

const NAMES = ['두근거림 (심계항진)', '두근거림(심계항진)', 'Ulcerative Colitis', '  Aspirin  ', '동 기능부전 증후군', '', null, undefined, 0, 'MRSA', 'β-blocker', '오심·구토 (Nausea/vomiting)', 'a (b) c', '(  x  )', 'ﾊﾝ', 'A,B , C', '실신\n기절', 'X (Y) (Z)'];

// ── 골든 대상(자기완결 순수함수) ──
golden('_entityNameNorm', s => String(s || '').toLowerCase().replace(/[\s()]/g, ''), NAMES);
golden('normalizeSyncText', v => String(v || '').toLowerCase().replace(/\s+/g, ''), NAMES);
golden('_findingNorm', s => String(s || '').toLowerCase().replace(/\s/g, ''), NAMES);
golden('normFindingConcept', s => String(s || '').normalize('NFKC').toLowerCase().replace(/\s/g, '').replace(/[()]/g, ''), NAMES);
golden('_findingSplit', s => String(s || '').split(/[,\n]/).map(t => t.trim()).filter(Boolean), NAMES);
golden('_findingConceptForms', s => {
  const out = []; const raw = String(s || '').trim(); if (raw) out.push(raw);
  const m = raw.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (m) { if (m[1].trim()) out.push(m[1].trim()); if (m[2].trim()) out.push(m[2].trim()); }
  return out;
}, NAMES);

if (failures.length) {
  console.error(`❌ 골든테스트 실패 (${failures.length}건):\n` + failures.map((f, i) => `${i + 1}. ${f}`).join('\n'));
  process.exit(1);
}
console.log('✅ 골든테스트 통과 — 순수함수 6종이 기준 규칙과 전 케이스 일치(행위보존 확인).');
