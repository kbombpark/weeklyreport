// 라크 위키 주간 보고 문서를 읽어 리포트 데이터로 옮긴다.
//   node src/sync-lark.mjs <slug> [YYYY-MM-DD]   위키 아카이브에서 해당 회차 문서를 찾아 변환
//   node src/sync-lark.mjs <slug> --doc <URL|token> [--date YYYY-MM-DD]
//   node src/sync-lark.mjs <slug> --list         해당 클라이언트의 위키 문서 목록만 출력
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { parseLarkReport } from './lark-parse.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPACE = '7602268973530369557'; // 위키: (임시)클라이언트 주간 리포트

const lark = (args) => {
  const out = execFileSync('lark-cli', [...args, '--as', 'user'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const i = out.indexOf('{');
  if (i === -1) throw new Error(`lark-cli 응답을 해석할 수 없습니다:\n${out.slice(0, 400)}`);
  const res = JSON.parse(out.slice(i));
  if (!res.ok) throw new Error(`lark-cli 오류: ${JSON.stringify(res.error)}`);
  return res.data;
};

const argv = process.argv.slice(2);
const slug = argv[0];
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
if (!slug || slug.startsWith('--')) {
  console.error('사용법: node src/sync-lark.mjs <slug> [YYYY-MM-DD] | --doc <URL> | --list');
  process.exit(1);
}

const clientFile = join(root, 'clients', slug, 'client.yml');
if (!existsSync(clientFile)) throw new Error(`클라이언트를 찾을 수 없습니다: ${slug}`);
const client = yaml.load(readFileSync(clientFile, 'utf8'));
if (!client.lark?.parentNode) throw new Error(`${slug}/client.yml 에 lark.parentNode 가 없습니다`);

const positional = argv.slice(1).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const date = flag('date') ?? positional;

// 위키 하위 문서 목록
const nodes = lark([
  'wiki', '+node-list',
  '--space-id', SPACE,
  '--parent-node-token', client.lark.parentNode,
]).nodes.filter((n) => n.obj_type === 'docx');

if (argv.includes('--list')) {
  for (const n of nodes) console.log(`${n.node_token}  ${n.title || '(제목 없음)'}`);
  process.exit(0);
}

let doc = flag('doc');
let resolvedDate = date;

if (!doc) {
  if (!date) throw new Error('회차 날짜(YYYY-MM-DD) 또는 --doc 이 필요합니다');
  const yymmdd = date.slice(2).replace(/-/g, '');
  const hit = nodes.filter((n) => (n.title ?? '').includes(yymmdd));
  if (!hit.length) {
    console.error(`위키에서 ${yymmdd} 문서를 찾지 못했습니다. 목록:`);
    for (const n of nodes) console.error(`  ${n.title || '(제목 없음)'}`);
    process.exit(1);
  }
  if (hit.length > 1) {
    console.error(`${yymmdd} 문서가 ${hit.length}건입니다. --doc 으로 지정하세요:`);
    for (const n of hit) console.error(`  ${n.node_token}  ${n.title}`);
    process.exit(1);
  }
  doc = hit[0].node_token;
  console.log(`위키 문서: ${hit[0].title}`);
}

const { document } = lark(['docs', '+fetch', '--doc', doc, '--doc-format', 'markdown']);
const report = parseLarkReport(document.content);
report.source = doc; // 원본 위키 노드 — Base 링크 갱신에 사용

// 문서에 작성 기준일이 있으면 그것을 파일명으로 쓴다.
if (!resolvedDate && report.asOf) resolvedDate = report.asOf.replace(/\./g, '-');
if (!resolvedDate) throw new Error('회차 날짜를 정할 수 없습니다. --date 로 지정하세요');

const outDir = join(root, 'clients', slug, 'reports');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `${resolvedDate}.yml`);

const header = `# ${slug} · ${resolvedDate}
# 라크 위키 문서에서 자동 변환: ${doc}
# 대외 보고 문체·태그·이월 대조는 /weekly-report 스킬로 다듬은 뒤 발행하세요.
`;
writeFileSync(out, header + yaml.dump(report, { lineWidth: 100, noRefs: true }));

console.log(`\n생성: ${out}`);
console.log(`  기간 ${report.period ?? '-'} / 기준일 ${report.asOf ?? '-'}`);
console.log(`  요약 ${report.summary ? report.summary.length + '자' : '없음 — 문서에 전체 요약이 비어 있습니다'}`);
for (const s of report.sections) {
  const n =
    s.rows?.length ??
    s.items?.length ??
    s.text?.length ??
    s.columns?.reduce((a, c) => a + c.items.length, 0) ??
    0;
  console.log(`  [${s.type}] ${s.title} — ${n}건`);
}
