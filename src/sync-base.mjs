// 라크 Base "주간 보고 입력" 의 레코드를 읽어 리포트 데이터로 옮긴다.
//   node src/sync-base.mjs <slug> <YYYY-MM-DD>   해당 회차 레코드를 변환
//   node src/sync-base.mjs <slug> --list         입력된 회차 목록
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { buildReport, EXCLUDED_FIELDS } from './base-parse.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = yaml.load(readFileSync(join(root, 'site.yml'), 'utf8'));

const argv = process.argv.slice(2);
const slug = argv[0];
const date = argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
if (!slug || slug.startsWith('--')) {
  console.error('사용법: node src/sync-base.mjs <slug> <YYYY-MM-DD> | --list');
  process.exit(1);
}

const lark = (args) => {
  const r = execFileSync('lark-cli', [...args, '--as', 'user'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const i = r.indexOf('{');
  if (i === -1) throw new Error(`lark-cli 응답을 해석할 수 없습니다:\n${r.slice(0, 400)}`);
  const res = JSON.parse(r.slice(i));
  if (!res.ok) throw new Error(`lark-cli 오류: ${JSON.stringify(res.error)}`);
  return res.data;
};

const clientFile = join(root, 'clients', slug, 'client.yml');
if (!existsSync(clientFile)) throw new Error(`클라이언트를 찾을 수 없습니다: ${slug}`);
const client = yaml.load(readFileSync(clientFile, 'utf8'));
const tableId = client.lark?.intakeTable;
if (!tableId) throw new Error(`${slug}/client.yml 에 lark.intakeTable 이 없습니다`);

// Base 레코드를 { 필드명: 값 } 배열로 정규화
const data = lark([
  'base', '+record-list',
  '--base-token', site.intake.token,
  '--table-id', tableId,
  '--format', 'json',
]);
const records = (data.data ?? []).map((row, i) => {
  const rec = { _id: data.record_id_list?.[i] };
  data.fields.forEach((name, j) => (rec[name] = row[j]));
  return rec;
});

if (argv.includes('--list')) {
  if (!records.length) console.log('입력된 회차가 없습니다.');
  for (const r of records) {
    const status = Array.isArray(r['상태']) ? r['상태'][0] : r['상태'];
    console.log(`${r['회차'] ?? '(회차 없음)'}  ${status ?? '-'}  ${r['보고 기간'] ?? ''}`);
  }
  process.exit(0);
}

if (!date) throw new Error('회차 날짜(YYYY-MM-DD)가 필요합니다');

const hit = records.filter((r) => String(r['회차'] ?? '').trim() === date);
if (!hit.length) {
  console.error(`${slug} 테이블에 회차 ${date} 레코드가 없습니다. 입력된 회차:`);
  for (const r of records) console.error(`  ${r['회차'] ?? '(회차 없음)'}`);
  process.exit(1);
}
if (hit.length > 1) {
  console.error(`회차 ${date} 레코드가 ${hit.length}건입니다. Base 에서 중복을 정리하세요.`);
  process.exit(1);
}
const record = hit[0];

const report = buildReport({ client, record, date });
report.source = { base: site.intake.token, table: tableId, record: record._id };

// 발행에서 제외되는 필드가 채워져 있으면 알려 준다(내용은 넘기지 않는다).
const withheld = EXCLUDED_FIELDS.filter((f) => String(record[f] ?? '').trim());

const wiki = record['위키 문서 링크'];
const outDir = join(root, 'clients', slug, 'reports');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `${date}.yml`);

const header = `# ${slug} · ${date}
# Base "주간 보고 입력" 에서 자동 변환 — 레코드 ${record._id}
# 대외 보고 문체·이월 대조는 /weekly-report 스킬로 다듬은 뒤 발행하세요.
`;
writeFileSync(out, header + yaml.dump(report, { lineWidth: 100, noRefs: true }));

const status = Array.isArray(record['상태']) ? record['상태'][0] : record['상태'];
const author = Array.isArray(record['작성자']) ? record['작성자'][0]?.name : record['작성자'];

console.log(`생성: ${out}`);
console.log(`  작성자 ${author ?? '-'} / 상태 ${status ?? '-'}`);
console.log(`  기간 ${report.period ?? '-'} / 기준일 ${report.asOf}`);
console.log(`  요약 ${report.summary ? report.summary.length + '자' : '없음 — 대표가 가장 먼저 읽는 부분입니다'}`);
for (const s of report.sections) {
  const n = s.rows?.length ?? s.items?.length ?? s.text?.length ?? s.columns?.reduce((a, c) => a + c.items.length, 0) ?? 0;
  console.log(`  [${s.type}] ${s.title ?? ''} — ${n}건`);
}
const empty = (client.intake?.sections ?? []).length - report.sections.length;
if (empty > 0) console.log(`  (빈 섹션 ${empty}개는 보고서에서 생략됩니다)`);
if (withheld.length) console.log(`  발행 제외 필드: ${withheld.join(', ')}`);
if (wiki) console.log(`  위키 문서: ${wiki}`);
