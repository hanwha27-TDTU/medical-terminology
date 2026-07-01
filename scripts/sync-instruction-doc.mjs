// scripts/sync-instruction-doc.mjs
// 단일 원본(docs/특허연구노트_통합지시문.md)을 index.html의 내장 블록(rnPatentInstructionDoc)과 동기화한다.
// 목적: 지시문을 고치면 원본 파일 하나만 고치고 이 스크립트로 내장본을 자동 갱신 → 원본/내장본 drift 방지.
//
//   node scripts/sync-instruction-doc.mjs           # 원본 → index.html 내장 블록에 주입(갱신)
//   node scripts/sync-instruction-doc.mjs --check    # 어긋나면 exit 1 (CI 드리프트 검사용)
//
// ⚠️ 원본에 </script> 가 있으면 HTML 블록이 깨지므로 거부한다(안전장치).

import { readFileSync, writeFileSync } from 'node:fs';

const DOC_PATH = 'docs/특허연구노트_통합지시문.md';
const HTML_PATH = 'index.html';
const OPEN = '<script id="rnPatentInstructionDoc" type="text/markdown">';
const CLOSE = '</script>';
const check = process.argv.includes('--check');

const body = readFileSync(DOC_PATH, 'utf8').replace(/^\n+/, '').replace(/\n+$/, '');
if (/<\/script/i.test(body)) { console.error('❌ 원본에 </script> 포함 — 내장 불가(안전장치). 표현을 바꾸세요.'); process.exit(1); }

const html = readFileSync(HTML_PATH, 'utf8');
const start = html.indexOf(OPEN);
if (start < 0) { console.error('❌ index.html에서 내장 블록 시작 태그를 찾지 못함'); process.exit(1); }
const innerStart = start + OPEN.length;
const closeIdx = html.indexOf(CLOSE, innerStart);
if (closeIdx < 0) { console.error('❌ 내장 블록 종료 태그를 찾지 못함'); process.exit(1); }

const currentInner = html.slice(innerStart, closeIdx);
const wantInner = `\n${body}\n`;

if (currentInner === wantInner) { console.log('✅ 내장 지시문이 원본과 동기화되어 있습니다.'); process.exit(0); }

if (check) {
  console.error('❌ 내장 지시문이 원본(docs/특허연구노트_통합지시문.md)과 다릅니다.');
  console.error('   → node scripts/sync-instruction-doc.mjs 를 실행해 동기화한 뒤 다시 커밋하세요.');
  process.exit(1);
}

const next = html.slice(0, innerStart) + wantInner + html.slice(closeIdx);
writeFileSync(HTML_PATH, next);
console.log(`✅ 내장 지시문을 원본으로 갱신했습니다 (${body.length + 1} bytes).`);
