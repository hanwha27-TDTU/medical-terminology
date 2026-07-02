// scripts/check-index-scripts.mjs
// 단일 파일(index.html)의 "배포 전 자동 점검" — 파일을 나누지 않는 대신 자동검사로 안정성을 지킨다.
// 검사 항목(모두 HARD 실패 = 오탐 없이 진짜 문제일 때만 실패):
//   1) 실행되는 <script> 블록 JS 문법 검사(node --check) — 문법 오류 배포 방지
//   2) 실행 <script> 블록 수가 기준 이상인지 — 저장 중 블록이 잘리거나 삭제되면 감지(함정 #7)
//   3) 파일이 </html>로 끝나는지 — 대용량 편집 시 끝부분 절단 감지(함정 #7)
//   4) 필수 심볼 존재 — 핵심 함수·상수가 실수로 삭제되지 않았는지(GPT식 SELF_CHECK의 정적·정확명 버전)
//   5) 도메인 parity — 6도메인의 Supabase 테이블명이 스키마 점검 대상에 다 있는지(누락=동기화 결함군)
//
//   node scripts/check-index-scripts.mjs
//
// ⚠️ 여기 목록은 "있으면 안전"이 아니라 "없으면 확실히 문제"인 것만 넣는다(오탐으로 CI를 막지 않기 위해).

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HTML_PATH = 'index.html';
const MIN_SCRIPT_BLOCKS = 4;        // 현재 실행 <script> 블록 수(줄어들면 절단·삭제 의심)
const REQUIRED_SYMBOLS = [
  // 연구노트 무결성(특허 증거) 핵심
  'function _rnComputeHash', 'function stableForHash', 'function rnVerifyChain',
  'const RN_PROJECT_NAME', "const RESEARCH_NOTES_TABLE = 'research_notes_med'", 'function _rnIsOwnProject',
  // 동기화·해시 페이로드
  'function canonicalDiseaseHashPayload', 'function computeSchemaDrift', 'async function checkLiveSchema',
  // 백업/복원·가져오기
  'async function applyPendingDataImport', 'function mergeDomainFavoritesImport', 'function createCompleteBackupObject', 'function readDataImportFile',
  // 핵심 UI·흐름(회귀 방지) — 탭전환·필터·렌더·추가·노트추가 함수가 삭제/리네임되면 "탭/저장/가져오기 깨짐"
  // → 헤드리스 환경에서 실제 클릭 대신 "핵심 흐름 함수 존재"로 정적 감지(수동 UI 체크리스트의 자동 보조).
  'function setLibraryMode', 'function applyFilters', 'function renderFilterControls', 'function showAddTermModal',
  'window.openIntegratedNoteModal', 'function renderDiseaseFrame',
  // 플래시카드(전 도메인 능동 회상) — 원본 불변·별도 로컬 기록
  'function buildFlashcardPool', 'function showFlashcards', 'function renderFlashcard',
  // 어학(Language) 도메인 코어(L2~L4b) — 삭제/리네임 시 "어학 저장·복원·동기화·방·TTS·오디오 깨짐" 정적 감지.
  'function installLanguageDomain', 'function normalizeLangRecord', 'function importLanguageBackupData',
  'function langToRow', 'function syncLanguageWithCloud', 'function sbUploadLangAudio',
  'KBG_MedicalNote.AppUI.roomClinicalLanguage', 'KBG_MedicalNote.AppUI.langOpenDetail', 'KBG_MedicalNote.AppUI.langSpeakEnglish',
];
// 컬럼-스키마 점검 대상 도메인만(medical_notes는 jsonb-blob이라 컬럼 드리프트 점검 대상이 아님 — 의도적 제외).
const REQUIRED_TABLES = ['medical_terms', 'medical_drugs', 'medical_formulas', 'medical_microbes', 'medical_diseases', 'research_notes_med'];

const html = readFileSync(HTML_PATH, 'utf8');
const errors = [];

// ── 1) + 2) 실행 <script> 블록 추출 + node --check ──
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m, execBlocks = 0;
const dir = mkdtempSync(join(tmpdir(), 'idxchk-'));
while ((m = re.exec(html))) {
  const attrs = m[1] || '';
  if (/\bsrc=/.test(attrs)) continue; // 외부 스크립트
  if (/type=/.test(attrs) && !/type=["']?(text\/javascript|application\/javascript|module)/.test(attrs)) continue; // 비-JS(text/markdown 등)
  execBlocks++;
  const f = join(dir, `block_${execBlocks}.js`);
  writeFileSync(f, m[2]);
  try { execFileSync('node', ['--check', f], { stdio: 'pipe' }); }
  catch (e) { errors.push(`JS 문법 오류: 실행 <script> 블록 #${execBlocks}\n${String(e.stderr || e.message || e).slice(0, 800)}`); }
}
if (execBlocks < MIN_SCRIPT_BLOCKS) errors.push(`실행 <script> 블록이 ${execBlocks}개뿐 — 기준 ${MIN_SCRIPT_BLOCKS}개 미만(블록 절단/삭제 의심).`);

// ── 3) 절단 가드 ──
if (!/<\/html>\s*$/i.test(html)) errors.push('파일이 </html>로 끝나지 않음 — 저장 중 끝부분 절단 의심.');

// ── 4) 필수 심볼 ──
for (const sym of REQUIRED_SYMBOLS) if (!html.includes(sym)) errors.push(`필수 심볼 누락: ${sym}`);

// ── 5) 도메인 parity(테이블명이 스키마 자기점검·라이브점검 대상에 다 있는지) ──
// computeSchemaDrift와 checkLiveSchema 사이 구간(스키마 점검부)에 각 테이블명이 등장하는지 본다.
const driftIdx = html.indexOf('function computeSchemaDrift');
const liveEnd = html.indexOf('async function runLiveSchemaCheck');
const schemaRegion = (driftIdx >= 0 && liveEnd > driftIdx) ? html.slice(driftIdx, liveEnd) : '';
for (const t of REQUIRED_TABLES) {
  if (!schemaRegion.includes(`'${t}'`) && !schemaRegion.includes(t)) {
    errors.push(`도메인 parity: 테이블 '${t}'가 스키마 점검부(computeSchemaDrift~checkLiveSchema)에 없음 — 도메인 누락 의심.`);
  }
}

if (errors.length) {
  console.error(`❌ index.html 자동 점검 실패 (${errors.length}건):\n\n` + errors.map((e, i) => `${i + 1}. ${e}`).join('\n\n'));
  process.exit(1);
}
console.log(`✅ index.html 자동 점검 통과 — 실행 <script> ${execBlocks}개 문법 OK · 필수 심볼 ${REQUIRED_SYMBOLS.length}개 · 도메인 ${REQUIRED_TABLES.length}개 parity · 절단 없음.`);
