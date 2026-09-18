// 다음 회차 리포트 초안을 만든다.
//   node src/new-report.mjs <slug> [YYYY-MM-DD]
// 직전 회차의 "이번 주 계획"을 지난주 완료 산출물 후보로, 미해결 요청사항을 이월 항목으로 옮겨 둔다.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [slug, dateArg] = process.argv.slice(2);
if (!slug) {
  console.error('사용법: node src/new-report.mjs <slug> [YYYY-MM-DD]');
  process.exit(1);
}

const dir = join(root, 'clients', slug, 'reports');
mkdirSync(dir, { recursive: true });

// 기준일 기본값: 다가오는(또는 오늘) 월요일
const monday = (d = new Date()) => {
  const x = new Date(d);
  x.setDate(x.getDate() + ((8 - x.getDay()) % 7 || 7) - (x.getDay() === 1 ? 7 : 0));
  return x;
};
const date = dateArg ?? monday().toISOString().slice(0, 10);
const out = join(dir, `${date}.yml`);
if (existsSync(out)) {
  console.error(`이미 있습니다: ${out}`);
  process.exit(1);
}

const prevFile = readdirSync(dir).filter((f) => f.endsWith('.yml') && basename(f, '.yml') < date).sort().pop();
const prev = prevFile ? yaml.load(readFileSync(join(dir, prevFile), 'utf8')) : null;

const find = (t) => prev?.sections?.find((s) => s.title?.includes(t));
const carriedPlan = find('이번 주 계획') ?? find('이번주');
const carriedAsks = find('요청사항');
const carriedRisks = find('리스크');

const fmt = (d) => d.replace(/-/g, '.');
const end = new Date(date + 'T00:00:00');
end.setDate(end.getDate() + 6);
const endStr = `${String(end.getMonth() + 1).padStart(2, '0')}.${String(end.getDate()).padStart(2, '0')}`;

const draft = {
  period: `${fmt(date)} – ${endStr}`,
  asOf: fmt(date),
  stats: [
    { label: '보고 기간', value: `${fmt(date).slice(5)}–${endStr}`, mono: true },
    { label: '핵심 마일스톤', value: 'TODO' },
    { label: '전체 상태', pill: { text: '정상 진행', tone: 'good' } },
  ],
  summary: 'TODO — 3~4문장. 무엇을 끝냈고, 이번 주에 무엇을 하는지.',
  sections: [
    {
      type: 'table',
      title: '지난주 완료 산출물',
      // 직전 회차 계획을 후보로 옮겨 둔다. 실제 완료 여부를 확인해 정리할 것.
      rows: (carriedPlan?.rows ?? [{ area: 'TODO', items: ['TODO'] }]).map((r) => ({
        area: r.area,
        status: { text: '완료', tone: 'good' },
        items: r.items ?? [],
      })),
    },
    ...(carriedRisks ? [{ ...carriedRisks, title: '리스크 및 의존성' }] : []),
    { type: 'table', title: '이번 주 계획', columns: ['작업 영역', '내용'], rows: [{ area: 'TODO', items: ['TODO'] }] },
    ...(carriedAsks ? [{ ...carriedAsks, title: '요청사항' }] : []),
  ],
};

const header = `# ${slug} · ${date} 리포트 초안
# 직전 회차(${prevFile ?? '없음'})에서 이월한 항목이 포함되어 있습니다.
# TODO 를 모두 채운 뒤 \`npm run build\` 하세요.
`;

writeFileSync(out, header + yaml.dump(draft, { lineWidth: 100, noRefs: true, quotingType: '"' }));
console.log(`초안 생성: ${out}`);
if (carriedPlan) console.log(`  ↳ 직전 "이번 주 계획" ${carriedPlan.rows.length}행을 완료 후보로 이월`);
if (carriedAsks) console.log(`  ↳ 직전 "요청사항" 이월 — 해결된 항목은 삭제할 것`);
