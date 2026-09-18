// 발행 후 라크 Base "주간 보고 링크" 레코드를 갱신한다.
//   node src/update-base.mjs <slug> <YYYY-MM-DD>          미리보기만 (기본)
//   node src/update-base.mjs <slug> <YYYY-MM-DD> --write  실제 반영
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = yaml.load(readFileSync(join(root, 'site.yml'), 'utf8'));

const [slug, date] = process.argv.slice(2);
const write = process.argv.includes('--write');
if (!slug || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
  console.error('사용법: node src/update-base.mjs <slug> <YYYY-MM-DD> [--write]');
  process.exit(1);
}

const lark = (args) => {
  const out = execFileSync('lark-cli', [...args, '--as', 'user'], { encoding: 'utf8', maxBuffer: 16e6 });
  const res = JSON.parse(out.slice(out.indexOf('{')));
  if (!res.ok) throw new Error(`lark-cli 오류: ${JSON.stringify(res.error)}`);
  return res.data;
};

const client = yaml.load(readFileSync(join(root, 'clients', slug, 'client.yml'), 'utf8'));
const reportFile = join(root, 'clients', slug, 'reports', `${date}.yml`);
if (!existsSync(reportFile)) throw new Error(`리포트 데이터가 없습니다: ${reportFile}`);
const report = yaml.load(readFileSync(reportFile, 'utf8'));

const rows = lark([
  'base', '+record-list',
  '--base-token', site.base.token,
  '--table-id', site.base.table,
  '--format', 'json',
]);
const iProject = rows.fields.indexOf('프로젝트');
const idx = rows.data.findIndex((r) => r[iProject] === client.lark.project);
if (idx === -1) {
  throw new Error(`Base 에서 프로젝트 "${client.lark.project}" 레코드를 찾지 못했습니다`);
}
const recordId = rows.record_id_list?.[idx] ?? rows.data[idx].at(-1);

const external = `${site.baseUrl}/${slug}/${date}.html`;
const fields = {
  '보고 기간': report.period ?? '',
  '작성일': `${date} 00:00`,
  '외부 공유 링크': `[외부 공유 페이지 (GitHub Pages)](${external})`,
  '상태': ['공유 완료'],
};
if (report.source) {
  fields['내부 위키 링크'] = `[내부 보고](${site.larkDomain}/wiki/${report.source})`;
}

console.log(`레코드 ${recordId} (${client.lark.project})`);
for (const [k, v] of Object.entries(fields)) console.log(`  ${k}: ${Array.isArray(v) ? v.join(', ') : v}`);

if (!write) {
  console.log('\n미리보기입니다. 실제 반영하려면 --write 를 붙이세요.');
  process.exit(0);
}

lark([
  'base', '+record-upsert',
  '--base-token', site.base.token,
  '--table-id', site.base.table,
  '--record-id', recordId,
  '--json', JSON.stringify(fields),
]);
console.log('\nBase 갱신 완료');
