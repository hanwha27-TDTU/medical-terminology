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

// index.html에서 `function NAME(...) { ... }` 선언 하나의 소스 문자열을 추출한다.
// (중괄호 균형으로 본문 끝을 찾음 — 대상 순수 유틸들엔 문자열/정규식 내 중괄호가 없으니 충분.)
function extractSource(name) {
  let start = html.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`함수 ${name} 를 실행 코드에서 찾지 못함`);
  if (html.slice(start - 6, start) === 'async ') start -= 6; // async 함수도 통째로(접두 포함)
  const braceOpen = html.indexOf('{', start);
  let depth = 0, i = braceOpen;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start, i);
}
// 자기완결 함수: 소스만 eval.
function extractFn(name) { return eval('(' + extractSource(name) + ')'); }
// 의존이 있는 함수: 의존 함수들을 같은 스코프에 함께 선언한 뒤 대상을 반환(예: formulaIdentityKey→normalizeSyncText).
function extractWithDeps(target, deps = []) {
  const srcs = [...deps, target].map(extractSource);
  return eval('(function(){' + srcs.join('\n') + '\nreturn ' + target + ';})()');
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

// ── 의존 있는 순수함수: formulaIdentityKey (normalizeSyncText 사용) ──
// 전엔 _aiRemapIdsByName·_dupDomainCfg에 같은 로직이 2벌 복붙 → 단일 formulaIdentityKey로 통합됨(v2.14).
{
  let fk;
  try { fk = extractWithDeps('formulaIdentityKey', ['normalizeSyncText']); } catch (e) { failures.push(`formulaIdentityKey: 추출 실패 — ${e.message}`); }
  if (fk) {
    const ref = f => { const n = String(f.name || f.short_name || f.formula_name || f.formula || '').toLowerCase().replace(/\s+/g, ''); return n ? `name:${n}` : ''; };
    const FORMULAS = [
      { name: 'Anion Gap' }, { short_name: 'AG' }, { formula_name: 'Cockcroft-Gault' }, { formula: 'Na - (Cl + HCO3)' },
      { name: '', short_name: '', formula_name: '', formula: 'a/b' }, {}, { name: 'MAP', formula: '(SBP+2*DBP)/3' }, { name: '  Body Mass Index  ' },
    ];
    for (const f of FORMULAS) check(`formulaIdentityKey(${JSON.stringify(f)})`, fk(f), ref(f));
  }
}

// ── 클라우드 스키마 오류 분류기 (조용한 유실 방지의 핵심) ──
golden('_isCloudSchemaError', t => /PGRST204|42703|42P01|could not find the .* column|column .* does not exist|relation .* does not exist/i.test(String(t || '')), [
  `{"code":"PGRST204","message":"Could not find the 'parent_id' column of 'medical_diseases' in the schema cache"}`,
  `{"code":"42703","message":"column \\"parent_id\\" does not exist"}`,
  `{"code":"42P01","message":"relation \\"medical_diseases\\" does not exist"}`,
  'TypeError: Failed to fetch', '{"code":"PGRST301","message":"JWT expired"}', '500 Internal Server Error', '', null,
]);

// ── 중복판정·매칭 키 family (모두 normalizeSyncText 의존) — 이번 세션 내내 고친 버그多 영역 → 골든으로 고정 ──
// 의존(normalizeSyncText)을 함께 추출해 실행. 기준 규칙은 각 *IdentityKey의 필드 우선순위를 그대로 반영.
function goldenD(name, deps, refImpl, battery) {
  let fn; try { fn = extractWithDeps(name, deps); } catch (e) { failures.push(`${name}: 추출 실패 — ${e.message}`); return; }
  for (const inp of battery) check(`${name}(${JSON.stringify(inp)})`, fn(inp), refImpl(inp));
}
const nz = s => String(s || '').toLowerCase().replace(/\s+/g, '');       // = normalizeSyncText 기준
const idOr = (o) => `id:${Number(o.id) || 'empty'}`;
const dz = ['normalizeSyncText'];
// term: en→ko→uz
goldenD('termIdentityKey', dz, t => { const en = nz(t.en), ko = nz(t.ko), uz = nz(t.uz); return en ? `en:${en}` : ko ? `ko:${ko}` : uz ? `uz:${uz}` : idOr(t); },
  [{ en: 'Aspirin' }, { ko: '아스피린' }, { uz: 'X' }, {}, { en: '', ko: '두근거림' }, { id: 5 }, { en: 'A B', ko: '가 나' }]);
// drug: generic→ko→brand
goldenD('drugIdentityKey', dz, d => { const g = nz(d.generic_name || d.genericName || d.en), ko = nz(d.ko_name || d.koName || d.ko), b = nz(d.brand_name || d.brandName || d.brand); return g ? `generic:${g}` : ko ? `ko:${ko}` : b ? `brand:${b}` : idOr(d); },
  [{ generic_name: 'Metformin' }, { ko_name: '메트포르민' }, { brand_name: 'Glucophage' }, { en: 'X', koName: '와이' }, {}, { id: 9 }]);
// microbe: organism→latin→ko
goldenD('microbeIdentityKey', dz, m => { const o = nz(m.organism || m.name || m.en), latin = nz(m.latin_name || m.scientific_name), ko = nz(m.ko_name || m.ko); return o ? `organism:${o}` : latin ? `latin:${latin}` : ko ? `ko:${ko}` : idOr(m); },
  [{ organism: 'S. aureus' }, { latin_name: 'Staphylococcus aureus' }, { ko_name: '황색포도상구균' }, { name: 'E. coli' }, {}, { id: 3 }]);
// disease: ko→en→uz (ko 우선)
const dzMatchRef = d => { const out = []; const ko = nz(d.ko_name || d.ko), en = nz(d.en_name || d.name || d.en), uz = nz(d.uz_name || d.uz); if (ko) out.push(`ko:${ko}`); if (en) out.push(`en:${en}`); if (uz) out.push(`uz:${uz}`); if (!out.length) out.push(idOr(d)); return out; };
goldenD('diseaseIdentityKey', dz, d => { const ko = nz(d.ko_name || d.ko), en = nz(d.en_name || d.name || d.en), uz = nz(d.uz_name || d.uz); return ko ? `ko:${ko}` : en ? `en:${en}` : uz ? `uz:${uz}` : idOr(d); },
  [{ ko_name: '동기능부전증후군', en_name: 'Sick sinus syndrome' }, { en_name: 'Colitis' }, { uz_name: 'X' }, {}, { id: 7 }]);
// diseaseMatchKeys: ko/en/uz 전 키 배열
goldenD('diseaseMatchKeys', dz, dzMatchRef,
  [{ ko_name: '동정지', en_name: 'Sinus arrest' }, { ko_name: '동방차단' }, { en_name: 'X only' }, {}, { id: 4 }]);
// diseasesSameEntity(a,b): 키 교집합 존재 (2-arg)
{
  let fn; try { fn = extractWithDeps('diseasesSameEntity', ['normalizeSyncText', 'diseaseMatchKeys']); } catch (e) { failures.push(`diseasesSameEntity: ${e.message}`); }
  if (fn) {
    const same = (a, b) => { const kb = new Set(dzMatchRef(b)); return dzMatchRef(a).some(k => kb.has(k)); };
    const pairs = [
      [{ ko_name: '동정지', en_name: 'Sinus arrest' }, { ko_name: '동정지', en_name: 'Other EN' }], // ko 같음 → true
      [{ ko_name: 'A', en_name: 'Shared' }, { ko_name: 'B', en_name: 'Shared' }],                    // en 같음 → true
      [{ ko_name: 'A', en_name: 'X' }, { ko_name: 'B', en_name: 'Y' }],                               // 다 다름 → false
    ];
    for (const [a, b] of pairs) check(`diseasesSameEntity(${JSON.stringify(a)},${JSON.stringify(b)})`, fn(a, b), same(a, b));
  }
}

// ── 🔴 CRITICAL ZONE 잠금: stableForHash(canonical 직렬화) characterization ──
// 특허 증거 해시는 JSON.stringify(stableForHash(entry))로 만들어진다. 이 직렬화가 "실수로" 바뀌면
// 과거 모든 엔트리의 entry_hash가 어긋난다(재베이스라인·검증 붕괴). 그래서 현재 출력을 고정 기준으로 못박는다.
// ⚠️ 이 테스트가 "의도된" 변경으로 실패하면: 직렬화를 정말 바꿔야 하는지 재확인 + 기준값 갱신 + 매니페스트 갱신
//    + 사용자에게 "전 엔트리 해시 재베이스라인" 고지가 필요하다(불변조건 19 · CRITICAL ZONE).
{
  let fn; try { fn = extractFn('stableForHash'); } catch (e) { failures.push(`stableForHash: 추출 실패 — ${e.message}`); }
  if (fn) {
    const J = x => JSON.stringify(fn(x));
    const cases = [
      [{ b: 2, a: 1, c: { z: 9, y: 8 } }, '{"a":1,"b":2,"c":{"y":8,"z":9}}'],            // 키 정렬(중첩 포함)
      [{ k: undefined, j: null, i: 'x' }, '{"i":"x","j":null,"k":null}'],                  // undefined→null
      [[{ q: 1, p: 2 }, 's', null, 3], '[{"p":2,"q":1},"s",null,3]'],                      // 배열 보존 + 내부 정렬
      [{ previous_entry_hash: 'abc', id: '1', created_at: 't', data: { ko: '동정지' } }, '{"created_at":"t","data":{"ko":"동정지"},"id":"1","previous_entry_hash":"abc"}'],
      [[0, '', false, null], '[0,"",false,null]'],                                          // 원시값 보존
    ];
    for (const [inp, expected] of cases) check(`JSON.stringify(stableForHash(${JSON.stringify(inp)}))`, J(inp), expected);
  }
}

// ── 🔴 CRITICAL ZONE 잠금: _rnComputeHash — 해시 제외 목록 + 전체 해시 characterization ──
// (a) 사후부착 18필드는 해시에 영향 없어야 하고(제외 목록 잠금) (b) 해시되는 필드는 영향 있어야 하며
// (c) 고정 엔트리 → 고정 해시(직렬화+제외+SHA-256 전체 알고리즘 잠금). 실수로 바뀌면 CI 빨간불.
// ⚠️ "의도된" 변경으로 실패 시: 전 엔트리 재베이스라인 경보 → 매니페스트 갱신 + 사용자 고지 후 기준 갱신(불변조건 19).
{
  let fn; try { fn = extractWithDeps('_rnComputeHash', ['_rnSha256Bytes', '_rnSha256', 'stableForHash']); } catch (e) { failures.push(`_rnComputeHash: 추출 실패 — ${e.message}`); }
  if (fn) {
    const base = { id: '1', created_at: 't', feature_name: 'X', event_type: 'idea', data: { ko: 'a' } };
    // 18개 사후부착 필드(서명·TSA·server_time·witness) 전부 얹은 사본 — 해시가 변하면 안 됨.
    const excluded = { ...base, entry_hash: 'ZZ', signature_status: 's', signed_by: 'b', tsa_token: 'T', server_time: 'sv', tsa_status: 'success', entry_hash_signature: 'sig', public_key_jwk: { x: 1 }, signature_algo: 'A', tsa_provider: 'p', tsa_request_hash: 'rh', tsa_timestamp: 'ts', tsa_error: 'e', witness_name: 'w', witness_email: 'we', witness_signature: 'ws', witness_signed_at: 'wa', witness_signed_at2: 'wa2' };
    const changed = { ...base, feature_name: 'Y' }; // 해시 대상 필드 변경 — 해시가 달라져야 함
    const [hb, he, hc] = await Promise.all([fn(base), fn(excluded), fn(changed)]);
    check('_rnComputeHash 고정 해시(characterization)', hb, 'ed4e873bea31cfa5d5c575b20d142455340c5f8fef91db72dc8654d4000f86a5');
    check('_rnComputeHash 사후부착 18필드 제외(해시 불변)', he, hb);
    check('_rnComputeHash 해시대상 필드 변경 → 해시 달라짐', hc !== hb, true);
  }
}

// ── 연구노트 기여 판정(_rnContrib, v2.33) — 카드 👤/🤖 배지와 증거 보고서 집계의 단일 기준 → 골든 잠금 ──
// 4종 시드(사람만/AI만/둘다/빈) + 트림 시맨틱(공백만='미기재') + 선시드 빈 ai_metadata 오탐 방지.
golden('_rnContrib', e => {
  const has = v => !!(v && String(v).trim());
  const human = has(e.human_idea) || has(e.human_modification) || has(e.final_decision);
  const ai = has(e.ai_prompt_summary) || has(e.ai_output_summary) || has(e.ai_prompt_full) || has(e.ai_output_full) || has(e.ai_metadata && e.ai_metadata.model_name);
  return { human, ai, model: (e.ai_metadata && e.ai_metadata.model_name && String(e.ai_metadata.model_name).trim()) || '' };
}, [
  { human_idea: '사람의 착상' },                                                          // 사람만 → 👤
  { ai_output_summary: 'AI 요약', ai_metadata: { model_name: 'Claude (Claude Code)' } },  // AI만 → 🤖 + 모델
  { human_idea: '착상', final_decision: '확정', ai_prompt_summary: '프롬프트' },          // 둘 다
  { human_idea: '', human_modification: '', final_decision: '', ai_prompt_summary: '', ai_metadata: { model_name: '' } }, // 선시드 빈값 → 미기재
  { human_idea: '   ', ai_output_full: ' \n ' },                                          // 공백만 → 미기재(트림)
  { ai_metadata: { model_name: 'GPT-5' } },                                               // 모델명 단독 → AI로 집계
  {},
]);

if (failures.length) {
  console.error(`❌ 골든테스트 실패 (${failures.length}건):\n` + failures.map((f, i) => `${i + 1}. ${f}`).join('\n'));
  process.exit(1);
}
console.log('✅ 골든테스트 통과 — 17종(정규화 6 + 식별/매칭키 7 + 스키마오류분류 1 + 기여판정 1 + stableForHash 직렬화 + _rnComputeHash 해시)이 기준과 일치.');
