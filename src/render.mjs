// 리포트 데이터(YAML) → 고정 템플릿 HTML 렌더러.
// 마크업은 기존 수기 리포트와 동일하게 유지한다.

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// "굵게" 표기만 지원: **텍스트**
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const TONE = { good: 'good', prog: 'prog', progress: 'prog' };
const pill = (p) => {
  if (!p) return '';
  const o = typeof p === 'string' ? { text: p } : p;
  const tone = TONE[o.tone] ?? (o.tone ? '' : 'good');
  return `<span class="pill${tone ? ' ' + tone : ''}">${inline(o.text)}</span>`;
};

// 항목은 문자열이거나 { text, sub: [...] } 형태를 허용한다.
const itemList = (items, tag = 'ol', indent = '') => {
  if (!items?.length) return '';
  const li = items
    .map((it) => {
      const o = typeof it === 'string' ? { text: it } : it;
      const sub = o.sub?.length ? '\n' + itemList(o.sub, 'ul', indent + '  ') + '\n' + indent + '  ' : '';
      return `${indent}  <li>${inline(o.text)}${sub}</li>`;
    })
    .join('\n');
  return `${indent}<${tag}>\n${li}\n${indent}</${tag}>`;
};

// 항목이 하나뿐이면 목록 없이 문장으로 둔다(기존 리포트 관행).
const cellBody = (row) => {
  const items = row.items ?? (row.text ? [row.text] : []);
  if (items.length === 1 && typeof items[0] === 'string') return inline(items[0]);
  return '\n' + itemList(items, 'ol', '                  ') + '\n                ';
};

const sectionHead = (title) => (title ? `        <h2 class="section-head">${inline(title)}</h2>\n` : '');

const blocks = {
  // 작업 영역 / 내용 / 상태 표
  table(s) {
    const withStatus = s.rows.some((r) => r.status);
    const cols = s.columns ?? (withStatus ? ['작업 영역', '내용', '상태'] : ['작업 영역', '내용']);
    const head = cols.map((c) => `<th>${inline(c)}</th>`).join('');
    const rows = s.rows
      .map((r) => {
        const status = withStatus ? `\n                <td class="status">${pill(r.status)}</td>` : '';
        return `              <tr>
                <td class="area">${inline(r.area ?? '')}</td>
                <td>${cellBody(r)}</td>${status}
              </tr>`;
      })
      .join('\n');
    return `      <section>
${sectionHead(s.title)}        <div class="table-wrap">
          <table>
            <thead>
              <tr>${head}</tr>
            </thead>
            <tbody>
${rows}
            </tbody>
          </table>
        </div>
      </section>`;
  },

  // 태그 + 한 줄 설명 (리스크 / 이슈)
  notes(s) {
    const items = s.items
      .map((it) => {
        const o = typeof it === 'string' ? { text: it } : it;
        const tag = o.tag ? `\n            <span class="tag">${inline(o.tag)}</span>` : '';
        return `          <div class="risk-item">${tag}
            <p>${inline(o.text)}</p>
          </div>`;
      })
      .join('\n');
    return `      <section>
${sectionHead(s.title)}        <div class="risk-list">
${items}
        </div>
      </section>`;
  },

  // 요청사항 등 강조 카드
  card(s) {
    const body = s.items?.length
      ? itemList(s.items, 'ol', '          ')
      : `          <p>${inline(s.text)}</p>`;
    return `      <section>
${sectionHead(s.title)}        <div class="ask-card">
${body}
        </div>
      </section>`;
  },

  // 좌/우 2단 (지난주 한 일 · 이번주 할 일)
  dual(s) {
    const cols = s.columns
      .map(
        (c) => `          <div class="sub-card">
            <span class="sub-label">${inline(c.label)}</span>
${itemList(c.items, 'ol', '            ')}
          </div>`
      )
      .join('\n');
    const head = s.title
      ? `        <div class="product-head"><h2>${inline(s.title)}</h2></div>\n`
      : '';
    return `      <div class="product">
${head}        <div class="dual-col">
${cols}
        </div>
      </div>`;
  },

  // 자유 문단
  text(s) {
    const ps = (Array.isArray(s.text) ? s.text : [s.text])
      .map((p) => `          <p>${inline(p)}</p>`)
      .join('\n');
    return `      <section>
${sectionHead(s.title)}        <div class="summary-card">
${ps}
        </div>
      </section>`;
  },
};

export function renderReport({ client, report, file, css, wordmark, symbol }) {
  // 보고서 제목은 클라이언트명 + 보고 종류로 통일한다. display("…프로젝트")는 상단 브랜드 영역에만 쓴다.
  const title = `${client.name} ${report.kind ?? client.kind ?? '주간 보고'}`;
  const docTitle = `${client.name} ${client.docKind ?? client.kind ?? '주간 리포트'} · ${report.asOf ?? report.date}`;

  const stats = report.stats?.length
    ? `
      <div class="stat-row">
${report.stats
  .map(
    (st) => `        <div class="stat">
          <p class="label">${inline(st.label)}</p>
          <p class="value${st.mono ? ' mono' : ''}">${st.pill ? pill(st.pill) : inline(st.value)}</p>
        </div>`
  )
  .join('\n')}
      </div>
`
    : '';

  const summary = report.summary
    ? `
      <section>
${report.summaryTitle === null ? '' : sectionHead(report.summaryTitle ?? '전체 요약')}        <div class="summary-card">
          <p>${inline(report.summary)}</p>
        </div>
      </section>
`
    : '';

  const body = (report.sections ?? [])
    .map((s) => {
      const fn = blocks[s.type];
      if (!fn) throw new Error(`알 수 없는 섹션 타입: ${s.type}`);
      return fn(s);
    })
    .join('\n\n');

  const period = report.period
    ? `      <p class="period mono">${inline(report.period)}${
        report.asOf ? `<span class="sep">/</span>작성 기준일 ${inline(report.asOf)}` : ''
      }</p>\n`
    : '';

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(docTitle)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
${css}
</style>
</head>
<body>

<div class="masthead">
  ${wordmark}
  <div class="brand-meta">
    <p class="eyebrow">${esc(client.eyebrow ?? 'Weekly Report')}</p>
    <p class="client">${esc(client.display ?? client.name)}</p>
  </div>
</div>

<div class="layout">
  <aside class="history-sidebar">
    <p class="history-title">지난 리포트</p>
    <nav class="history-list" id="history-list">
      <span class="history-empty">불러오는 중&hellip;</span>
    </nav>
  </aside>

  <div class="content-col">
    <main>
      <header class="report-head">
        <h1>${esc(title)}</h1>
${period}      </header>
${stats}${summary}
${body}
    </main>

    <footer>
      ${symbol}
      <p class="note">${esc(client.footerNote ?? '본 보고서는 매주 갱신됩니다')} &middot; <strong>Cofoundary</strong> &times; ${esc(client.name)}</p>
    </footer>
  </div>
</div>

<script>
  var CURRENT_FILE = ${JSON.stringify(file)};
  fetch('./manifest.json', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(list){
    var nav = document.getElementById('history-list');
    nav.innerHTML = '';
    if (!list || !list.length) { nav.innerHTML = '<span class="history-empty">기록 없음</span>'; return; }
    list.forEach(function(item){
      var a = document.createElement('a');
      a.href = './' + item.file;
      a.textContent = item.label;
      a.className = 'history-link' + (item.file === CURRENT_FILE ? ' active' : '');
      nav.appendChild(a);
    });
  }).catch(function(){
    document.getElementById('history-list').innerHTML = '<span class="history-empty">기록을 불러오지 못했습니다</span>';
  });
</script>

</body>
</html>
`;
}
