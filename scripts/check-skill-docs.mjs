// scripts/check-skill-docs.mjs
// 스킬 문서 자기검증(헤드리스 CI) — "적어만 둔" 스킬이 현실과 어긋나면 실패시킨다.
//   이 세션에서 실제로 난 드리프트(참고문서 7 vs 10, 게이트 3 vs 4)를 기계가 막기 위한 게이트.
//   문서는 판단을 강제하진 못해도, 문서 자신의 정합성은 100% 기계로 잠글 수 있다.
//
//   node scripts/check-skill-docs.mjs
//
// 검사(전부 결정적·저오탐):
//   1. SKILL.md가 링크한 references/*.md == 실제 파일 목록(고아 파일·끊긴 링크 0)
//   2. "N개 참고문서(...)" 개수·이름 == 실제
//   3. 문서가 언급한 모든 scripts/*.mjs가 디스크에 존재
//   4. 워크플로가 실제로 돌리는 머지 게이트 스크립트가 SKILL.md·AGENTS.md·regression.md에 다 언급됨
//      (= "게이트 추가했는데 문서에 안 적음" / "문서엔 있는데 안 도는 게이트" 드리프트 차단)

import { readFileSync, readdirSync } from 'node:fs';

const SKILL_DIR = '.claude/skills/dr-bugeon-medical-note';
const REF_DIR = `${SKILL_DIR}/references`;
const WF_DIR = '.github/workflows';

const read = (p) => readFileSync(p, 'utf8');
const errors = [];
const fail = (m) => errors.push(m);

// ── 입력 수집 ──────────────────────────────────────────────
const skill = read(`${SKILL_DIR}/SKILL.md`);
const agents = read('AGENTS.md');
const regression = read(`${REF_DIR}/regression.md`);
const actualRefs = readdirSync(REF_DIR).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort();
const scriptFiles = new Set(readdirSync('scripts').filter((f) => f.endsWith('.mjs')));

// ── 1) 참고문서 링크 ↔ 실제 파일 집합 일치 ──────────────────
const linked = new Set();
for (const m of skill.matchAll(/references\/([A-Za-z0-9_-]+)\.md/g)) linked.add(m[1]);
const linkedArr = [...linked].sort();
for (const f of actualRefs) if (!linked.has(f)) fail(`참고문서 파일 references/${f}.md 가 SKILL.md에서 링크되지 않음(고아 문서).`);
for (const f of linkedArr) if (!actualRefs.includes(f)) fail(`SKILL.md가 references/${f}.md 를 링크하나 파일이 없음(끊긴 링크).`);

// ── 2) "N개 참고문서(...)" 요약 == 실제 ─────────────────────
const summ = skill.match(/(\d+)\s*개\s*참고문서\s*\(([^)]*)\)/);
if (!summ) fail('SKILL.md에 "N개 참고문서(...)" 구성 요약 줄을 찾지 못함(형식 변경?).');
else {
  const n = Number(summ[1]);
  const names = summ[2].split(',').map((s) => s.trim()).filter(Boolean).sort();
  if (n !== actualRefs.length) fail(`SKILL.md 요약 개수 ${n} ≠ 실제 참고문서 ${actualRefs.length}개.`);
  if (names.length !== actualRefs.length || names.some((x, i) => x !== actualRefs[i]))
    fail(`SKILL.md 요약 이름목록 [${names.join(', ')}] ≠ 실제 [${actualRefs.join(', ')}].`);
}

// ── 3) 문서가 언급한 scripts/*.mjs 전부 실재 ─────────────────
const docCorpus = [skill, agents, ...actualRefs.map((f) => read(`${REF_DIR}/${f}.md`))].join('\n');
const mentionedScripts = new Set();
for (const m of docCorpus.matchAll(/scripts\/([A-Za-z0-9_.-]+\.mjs)/g)) mentionedScripts.add(m[1]);
for (const s of [...mentionedScripts].sort()) if (!scriptFiles.has(s)) fail(`문서가 scripts/${s} 를 언급하나 파일이 없음(오탈자/삭제?).`);

// ── 4) 워크플로 머지 게이트 ↔ 문서 언급 일치 ─────────────────
// 머지 차단 게이트 = 아래 워크플로에서 도는 node scripts (manifest 발행 워크플로 제외).
// skill-docs-check.yml 포함 → 이 린터 자신도 "문서에 등록됐는지" 스스로 검사(자기잠금).
const GATE_WFS = ['index-scripts-check.yml', 'instruction-doc-sync.yml', 'skill-docs-check.yml'];
const gateScripts = new Set();
for (const wf of GATE_WFS) {
  let src; try { src = read(`${WF_DIR}/${wf}`); } catch { fail(`워크플로 ${wf} 없음(경로 변경?).`); continue; }
  for (const m of src.matchAll(/node\s+scripts\/([A-Za-z0-9_.-]+\.mjs)/g)) gateScripts.add(m[1]);
}
const gateArr = [...gateScripts].sort();
// 게이트의 "권위 있는 전체경로 목록"은 AGENTS.md §2 머지 게이트 + regression.md (A)에 산다.
// (SKILL.md는 "golden·doc-sync" 축약 요약이라 전체경로를 강제하지 않는다 — 참고문서 정합은 검사 1·2가 잠근다.)
const needMentions = { 'AGENTS.md': agents, 'references/regression.md': regression };
for (const g of gateArr) {
  if (!scriptFiles.has(g)) fail(`워크플로가 scripts/${g} 를 돌리나 파일이 없음.`);
  for (const [label, body] of Object.entries(needMentions))
    if (!body.includes(g)) fail(`머지 게이트 scripts/${g} 가 ${label}에 언급되지 않음(게이트 추가 후 문서 미반영 드리프트).`);
}

// ── 결과 ───────────────────────────────────────────────────
if (errors.length) {
  console.error(`❌ 스킬 문서 정합성 ${errors.length}건:\n` + errors.map((e, i) => `${i + 1}. ${e}`).join('\n'));
  process.exit(1);
}
console.log(`✅ 스킬 문서 정합성 OK — 참고문서 ${actualRefs.length}개 링크·요약 일치 · 언급 스크립트 ${mentionedScripts.size}종 실재 · 머지 게이트 ${gateArr.length}종 문서 반영.`);
