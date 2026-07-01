// scripts/golden-tests.mjs
// 순수함수 골든테스트 — 리팩토링이 "행위보존"인지 자동 증명하는 안전망.
// index.html에서 대상 순수함수의 소스를 추출해 실제로 실행하고, 기준 입력→출력이 일치하는지 확인한다.
// 리팩토링(추출·통합) 전후로 이 테스트가 계속 통과하면 동작이 안 바뀌었다는 뜻.
// 새 순수함수를 통합/추출할 때마다 여기 케이스를 추가하라(백로그: 골든테스트 상시화).
//
//   node scripts/golden-tests.mjs

import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const failures = [];

// index.html에서 `function NAME(...) { ... }` 선언 하나를 추출해 실행 가능한 함수로 만든다.
// (중괄호 균형으로 본문 끝을 찾음 — 문자열/정규식 내 중괄호는 이 순수 유틸들엔 없으니 충분.)
function extractFn(name) {
  const start = html.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`함수 ${name} 를 index.html에서 찾지 못함`);
  const braceOpen = html.indexOf('{', start);
  let depth = 0, i = braceOpen;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  const src = html.slice(start, i);
  return eval('(' + src + ')'); // 선언을 표현식으로 감싸 함수 객체를 얻음
}

function check(label, actual, expected) {
  if (actual !== expected) failures.push(`${label}: 기대 ${JSON.stringify(expected)} · 실제 ${JSON.stringify(actual)}`);
}

// ── 골든: _entityNameNorm (교차도메인 이름 정규화 — 소문자 + 공백·괄호 제거) ──
// 기준 구현(의도한 규칙)과 index.html의 실제 함수가 배터리 전체에서 일치해야 한다.
{
  const fn = extractFn('_entityNameNorm');
  const ref = s => String(s || '').toLowerCase().replace(/[\s()]/g, '');
  const battery = [
    '두근거림 (심계항진)', '두근거림(심계항진)', 'Ulcerative Colitis', '  Aspirin  ',
    'Sick Sinus Syndrome', '동 기능부전 증후군', '', null, undefined, 0, 'MRSA',
    'β-blocker', '오심·구토 (Nausea/vomiting)', 'a (b) c', '(  x  )',
  ];
  for (const inp of battery) check(`_entityNameNorm(${JSON.stringify(inp)})`, fn(inp), ref(inp));
}

if (failures.length) {
  console.error(`❌ 골든테스트 실패 (${failures.length}건):\n` + failures.map((f, i) => `${i + 1}. ${f}`).join('\n'));
  process.exit(1);
}
console.log('✅ 골든테스트 통과 — _entityNameNorm 이 기준 규칙과 전 케이스 일치(행위보존 확인).');
