// clients/<slug>/reports/*.yml → docs/<slug>/*.html
// legacy/*.html 은 손대지 않고 그대로 복사한다(기존 링크 보존).
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { renderReport } from './render.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'docs');
const CLIENTS = join(root, 'clients');

const read = (p) => readFileSync(p, 'utf8');
const loadYaml = (p) => yaml.load(read(p)) ?? {};
const ls = (dir, ext) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).sort() : [];

const css = read(join(root, 'src/assets/theme.css'));
const wordmark = read(join(root, 'src/assets/logo-wordmark.svg')).trim();
const symbol = read(join(root, 'src/assets/logo-symbol.svg')).trim();

const label = (date) => date.replace(/-/g, '.');

const redirectPage = (title) => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F5F7FB;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;color:#5B6478;}
  a{color:#0C56C2;}
</style>
</head>
<body>
<p id="msg">최신 리포트로 이동 중입니다&hellip;</p>
<script>
  fetch('./manifest.json', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(list){
    if (list && list.length) {
      location.replace('./' + list[0].file);
    } else {
      document.getElementById('msg').textContent = '리포트를 찾을 수 없습니다.';
    }
  }).catch(function(){
    document.getElementById('msg').textContent = '리포트를 불러오지 못했습니다.';
  });
</script>
</body>
</html>
`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const slugs = existsSync(CLIENTS)
  ? readdirSync(CLIENTS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  : [];

const summary = [];

for (const slug of slugs) {
  const dir = join(CLIENTS, slug);
  const client = { slug, ...loadYaml(join(dir, 'client.yml')) };
  const outDir = join(OUT, slug);
  mkdirSync(outDir, { recursive: true });

  const entries = [];

  // 1) 데이터 기반 리포트
  for (const f of ls(join(dir, 'reports'), '.yml')) {
    const date = basename(f, '.yml');
    const report = { date, ...loadYaml(join(dir, 'reports', f)) };
    const file = `${date}.html`;
    writeFileSync(
      join(outDir, file),
      renderReport({ client, report, file, css, wordmark, symbol })
    );
    entries.push({ date, file, label: report.label ?? label(date) });
  }

  // 2) 전환 전 수기 HTML — 그대로 배포
  for (const f of ls(join(dir, 'legacy'), '.html')) {
    if (f === 'index.html') continue;
    const date = basename(f, '.html');
    if (entries.some((e) => e.file === f)) continue; // 데이터 버전이 있으면 그쪽 우선
    copyFileSync(join(dir, 'legacy', f), join(outDir, f));
    entries.push({ date, file: f, label: label(date), legacy: true });
  }

  entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  writeFileSync(
    join(outDir, 'manifest.json'),
    JSON.stringify(entries.map(({ date, file, label }) => ({ date, file, label })), null, 2) + '\n'
  );
  writeFileSync(join(outDir, 'index.html'), redirectPage(`${client.name} ${client.docKind ?? client.kind ?? '주간 리포트'}`));

  summary.push({ client, latest: entries[0], count: entries.length });
  console.log(`${slug.padEnd(12)} ${entries.length}건  최신 ${entries[0]?.date ?? '-'}`);
}

// 루트 목록 (내부용)
const cards = summary
  .map(
    ({ client, latest, count }) => `      <a class="card" href="./${client.slug}/">
        <span class="name">${client.name}</span>
        <span class="meta">최신 ${latest ? label(latest.date) : '-'} · 총 ${count}건</span>
      </a>`
  )
  .join('\n');

writeFileSync(
  join(OUT, 'index.html'),
  `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Cofoundary 주간 리포트</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  :root{ --bg:#F5F7FB; --surface:#fff; --border:#DEE3ED; --ink:#101A2E; --muted:#5B6478; --navy:#03153B; }
  @media (prefers-color-scheme: dark){ :root{ --bg:#0A1220; --surface:#101B2E; --border:#22314C; --ink:#E7EAF2; --muted:#95A2BC; } }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:'IBM Plex Sans KR',ui-sans-serif,system-ui,sans-serif;line-height:1.7;}
  .masthead{background:var(--navy);padding:22px max(20px,calc(50% - 420px));}
  .masthead p{margin:0;color:#fff;font-weight:600;}
  .masthead .eyebrow{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.14em;color:#E0A32E;text-transform:uppercase;margin-bottom:3px;}
  main{max-width:840px;margin:0 auto;padding:32px 20px 56px;}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;}
  .card{display:block;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;text-decoration:none;color:inherit;}
  .card:hover{border-color:#1070FC;}
  .name{display:block;font-weight:600;font-size:16px;}
  .meta{display:block;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--muted);margin-top:4px;}
</style>
</head>
<body>
<div class="masthead">
  <p class="eyebrow">Weekly Report</p>
  <p>Cofoundary 프로젝트 주간 리포트</p>
</div>
<main>
  <div class="grid">
${cards}
  </div>
</main>
</body>
</html>
`
);

// 리포트와 무관한 정적 페이지(요청 접수 페이지 등)는 그대로 복사한다.
const copyTree = (from, to) => {
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  for (const e of readdirSync(from, { withFileTypes: true })) {
    e.isDirectory() ? copyTree(join(from, e.name), join(to, e.name)) : copyFileSync(join(from, e.name), join(to, e.name));
  }
};
copyTree(join(root, 'static'), OUT);

writeFileSync(join(OUT, '.nojekyll'), '');
console.log(`\ndocs/ 생성 완료 — 클라이언트 ${slugs.length}곳`);
