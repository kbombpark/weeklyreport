// 담당자용 웹 입력 페이지.
// 필드를 직접 받아, 브라우저에서 변환기(base-parse) + 렌더러(render)를 그대로 돌려
// 완성된 보고서를 즉시 보여주고 리포트 데이터(YAML)를 만들어 준다.

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const HINTS = {
  '지난주 완료 산출물': '개발 | 신규 병원 생성 기능 구현 | 완료\n개발 | DUR 테스트 | 진행중\n- 외부 연동 구간만 남음\n디자인 | 고객관리 모달 디자인 | 완료',
  '지난주 한 일': '운영자콘솔 개편 요구사항 검토\n- 국가별 조건 반영해 개편 범위 정리\n- 기존/제안 메뉴 구조 차이 분석\n일본 운영측 자료 피드백 작성',
  '이번 주 계획': '개발 | DB 이전 실행\n개발 | 웹 전환 착수\n기획 | 2차 기능 정의',
  '이번주 할 일': '운영자콘솔 개편 설계\n- 고객사 데이터 구조 설계\n빌링 및 사용내역 화면 설계',
  '리스크 및 의존성': 'DB 이전 목표 일정 확정이 필요합니다 [확인 필요]',
  '이슈 항목': '인프라 비용이 월 12만원 추가로 확정되었습니다 [비용]',
  '요청사항': 'DB 이전 작업 가능 시간대 확인 요청드립니다.\n아래 외부 연동 QA 일정 회신 요청드립니다.\n- 전자서명\n- 닥톡',
  '요청주신 사항 확인': '지난주 요청하신 정산 기준 건 — 확인 후 반영했습니다.',
  '진행 현황': '문단으로 적어도 됩니다.',
  '향후 방향': '문단으로 적어도 됩니다.',
};

const NOTE = {
  '지난주 완료 산출물': '<code>영역 | 내용 | 상태</code> 순서. 같은 영역이라도 상태가 다르면 줄을 나눠 주세요 — 진행중 항목이 완료로 묶이면 잘못된 보고가 나갑니다.',
  '지난주 한 일': '한 줄에 한 항목. 하위 내용은 줄 앞에 <code>-</code>.',
  '이번 주 계획': '<code>영역 | 내용</code> 순서. 상태는 쓰지 않습니다.',
  '이번주 할 일': '한 줄에 한 항목. 하위 내용은 줄 앞에 <code>-</code>.',
  '리스크 및 의존성': '끝에 <code>[확인 필요]</code> 처럼 대괄호를 붙이면 태그가 됩니다.',
  '이슈 항목': '일정·비용 변동은 반드시 숫자로. 끝에 대괄호로 태그를 붙입니다.',
  '요청사항': '클라이언트가 결정·확인해줘야 하는 것만. 여기 없으면 보고서에 올라가지 않습니다.',
};

const field = (name, { type = 'textarea', required = false, rows = 6, options, hint, note, placeholder } = {}) => {
  const id = `f_${encodeURIComponent(name)}`;
  const req = required ? ' <span class="req">필수</span>' : '';
  const body =
    type === 'select'
      ? `<select id="${id}" data-field="${esc(name)}">${options
          .map((o) => `<option value="${esc(o)}">${esc(o)}</option>`)
          .join('')}</select>`
      : type === 'text' || type === 'date'
        ? `<input id="${id}" type="${type}" data-field="${esc(name)}" placeholder="${esc(placeholder ?? '')}">`
        : `<textarea id="${id}" rows="${rows}" data-field="${esc(name)}" placeholder="${esc(placeholder ?? '')}"></textarea>`;
  return `        <div class="fld">
          <label for="${id}">${esc(name)}${req}</label>
${note ? `          <p class="fld-note">${note}</p>\n` : ''}          ${body}
${hint ? `          <p class="fld-hint">${esc(hint)}</p>\n` : ''}        </div>`;
};

export function renderIntake({ client, slug, css, wordmark, symbol, repo }) {
  const cfg = client.intake ?? {};
  const sectionFields = (cfg.sections ?? []).flatMap((s) =>
    s.type === 'dual'
      ? [...(s.titleField ? [{ name: s.titleField, kind: 'text' }] : []), ...s.columns.map((c) => ({ name: c.field }))]
      : [{ name: s.field }]
  );
  const primary = new Set(
    (cfg.sections ?? []).flatMap((s) =>
      s.type === 'dual' ? s.columns.map((c) => c.field) : /완료 산출물|이번 주 계획/.test(s.field) ? [s.field] : []
    )
  );

  const statFields = (cfg.stats ?? []).map((s) =>
    s.field === '전체 상태'
      ? field(s.field, { type: 'select', options: ['정상 진행', '일부 지연', '위험'] })
      : field(s.field, { type: 'text', placeholder: '이번 회차의 대표 성과 한 줄' })
  );

  const body = sectionFields
    .map((f) =>
      f.kind === 'text'
        ? field(f.name, { type: 'text', placeholder: 'Safe Intelligence' })
        : field(f.name, {
            required: primary.has(f.name),
            rows: primary.has(f.name) ? 8 : 4,
            placeholder: HINTS[f.name],
            note: NOTE[f.name],
          })
    )
    .join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(client.name)} 주간 보고 작성</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
${css}
</style>
</head>
<body>

<div class="masthead">
  ${wordmark}
  <div class="brand-meta">
    <p class="eyebrow">Weekly Input</p>
    <p class="client">${esc(client.display ?? client.name)}</p>
  </div>
</div>

<div class="editor">
  <div class="pane pane-form">
    <header class="report-head">
      <h1>${esc(client.name)} 주간 보고 작성</h1>
      <p class="desc">사실만 적으면 됩니다. 문체는 발행 단계에서 정리합니다. 오른쪽에 완성될 보고서가 바로 보입니다.</p>
    </header>

    <div class="fld-group">
${field('회차', { type: 'date', required: true })}
${field('보고 기간', { type: 'text', required: true, placeholder: '2026.09.21 – 09.27' })}
${field('작성자', { type: 'text', placeholder: '이름' })}
${statFields.join('\n')}
    </div>

    <div class="fld-group">
${field('전체 요약', { required: true, rows: 4, placeholder: '끝낸 것 → 이번 주 할 것 → 클라이언트가 결정해야 할 것 순서로 3~4문장.', note: '대표가 가장 먼저(때로는 유일하게) 읽는 부분입니다.' })}
${body}
    </div>

    <div class="fld-group">
${field('내부 메모 (대외 미게재)', { rows: 3, note: '<strong>보고서에 실리지 않습니다.</strong> 판단 근거, 내부 사정, 추측.', placeholder: '대외로 나가면 안 되는 내용' })}
    </div>

    <div class="actions">
      <button id="btn-copy" class="btn primary">리포트 데이터 복사</button>
      <button id="btn-download" class="btn">.yml 내려받기</button>
      <button id="btn-github" class="btn">GitHub에 올리기</button>
      <button id="btn-clear" class="btn subtle">작성 내용 비우기</button>
    </div>
    <p class="saved" id="saved">작성 중인 내용은 이 브라우저에 자동 저장됩니다.</p>
  </div>

  <div class="pane pane-preview">
    <div class="preview-head">
      <span class="preview-title">미리보기</span>
      <span class="preview-note" id="pv-note"></span>
    </div>
    <iframe id="preview" title="보고서 미리보기"></iframe>
  </div>
</div>

<script type="module">
import { buildReport } from '../../assets/base-parse.mjs';
import { renderReport } from '../../assets/render.mjs';

const CLIENT = ${JSON.stringify(client)};
const SLUG = ${JSON.stringify(slug)};
const REPO = ${JSON.stringify(repo ?? '')};
const KEY = 'weeklyreport:' + SLUG;

const [css, wordmark, symbol] = await Promise.all(
  ['theme.css', 'logo-wordmark.svg', 'logo-symbol.svg'].map((f) =>
    fetch('../../assets/' + f).then((r) => r.text())
  )
);

const inputs = [...document.querySelectorAll('[data-field]')];
const el = (id) => document.getElementById(id);

const record = () =>
  Object.fromEntries(inputs.map((i) => [i.dataset.field, i.value]));

const restore = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const i of inputs) if (saved[i.dataset.field] != null) i.value = saved[i.dataset.field];
  } catch {}
};

const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(record())); } catch {}
};

const dateOf = () => el('f_' + encodeURIComponent('회차')).value || new Date().toISOString().slice(0, 10);

function current() {
  const date = dateOf();
  const report = buildReport({ client: CLIENT, record: record(), date });
  return { date, report };
}

// srcdoc 재할당은 일부 브라우저에서 다시 그리지 않는다. Blob URL 로 교체한다.
let lastUrl = null;
function show(html) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  el('preview').src = url;
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = url;
}

function refresh() {
  const { date, report } = current();
  const html = renderReport({
    client: CLIENT, report, file: date + '.html', css, wordmark, symbol,
  });
  // 미리보기에서는 지난 리포트 이력을 쓰지 않는다 — manifest.json 을 찾다가 404 가 난다.
  // (정규식 대신 문자열 탐색: 이 코드 자체가 인라인 스크립트 안에 들어간다)
  const close = '</scr' + 'ipt>';
  const a = html.lastIndexOf('<scr' + 'ipt>');
  const b = html.lastIndexOf(close);
  const body = a !== -1 && b > a ? html.slice(0, a) + html.slice(b + close.length) : html;
  show(body.replace('</head>', '<style>.history-sidebar{display:none}</style></head>'));

  const missing = [];
  if (!report.summary) missing.push('전체 요약');
  if (!report.sections.length) missing.push('내용');
  el('pv-note').textContent = missing.length
    ? missing.join(' · ') + ' 없음'
    : report.sections.length + '개 섹션';
  el('pv-note').className = 'preview-note' + (missing.length ? ' warn' : '');
}

// 직렬화는 빌드와 같은 라이브러리를 쓴다.
let yamlLib = null;
async function yamlText() {
  if (!yamlLib) {
    try {
      yamlLib = await import('https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.mjs');
    } catch {
      throw new Error('YAML 변환기를 불러오지 못했습니다. 네트워크 연결을 확인해주세요.');
    }
  }
  const { date, report } = current();
  const head = '# ' + SLUG + ' · ' + date + '\\n# 입력 페이지에서 작성 — 발행 전 이월 대조와 문체 정리를 거치세요.\\n';
  return head + yamlLib.dump(report, { lineWidth: 100, noRefs: true });
}

const fail = (e) => alert(e.message || String(e));

el('btn-copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText(await yamlText());
    el('btn-copy').textContent = '복사했습니다';
    setTimeout(() => (el('btn-copy').textContent = '리포트 데이터 복사'), 1600);
  } catch (e) { fail(e); }
};

el('btn-download').onclick = async () => {
  try {
  const blob = new Blob([await yamlText()], { type: 'text/yaml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = dateOf() + '.yml';
  a.click();
  URL.revokeObjectURL(a.href);
  } catch (e) { fail(e); }
};

el('btn-github').onclick = async () => {
  try {
  if (!REPO) return alert('저장소가 설정되지 않았습니다.');
  const path = 'clients/' + SLUG + '/reports/' + dateOf() + '.yml';
  const url = 'https://github.com/' + REPO + '/new/main?filename=' +
    encodeURIComponent(path) + '&value=' + encodeURIComponent(await yamlText());
  if (url.length > 7500) {
    alert('내용이 길어 GitHub 링크로 보낼 수 없습니다. "리포트 데이터 복사" 또는 ".yml 내려받기" 를 써주세요.');
    return;
  }
  window.open(url, '_blank', 'noopener');
  } catch (e) { fail(e); }
};

el('btn-clear').onclick = () => {
  if (!confirm('작성 중인 내용을 모두 지웁니다. 계속할까요?')) return;
  for (const i of inputs) i.value = i.tagName === 'SELECT' ? i.options[0].value : '';
  save();
  refresh();
};

let timer;
for (const i of inputs)
  i.addEventListener('input', () => {
    save();
    clearTimeout(timer);
    timer = setTimeout(refresh, 150);
  });
restore();
refresh();
</script>

</body>
</html>
`;
}

export function renderIntakeIndex({ entries, css, wordmark, symbol }) {
  const rows = entries
    .map(
      ({ slug, client }) => `          <tr>
            <td class="area"><a href="./${esc(slug)}/">${esc(client.name)}</a></td>
            <td>${esc(client.display ?? client.name)}</td>
            <td class="status"><a href="./${esc(slug)}/">작성하기 →</a></td>
          </tr>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>주간 보고 작성</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
${css}
</style>
</head>
<body>

<div class="masthead">
  ${wordmark}
  <div class="brand-meta">
    <p class="eyebrow">Weekly Input</p>
    <p class="client">담당자 작성</p>
  </div>
</div>

<div class="layout">
  <div class="content-col" style="width:100%;">
    <main>
      <header class="report-head">
        <h1>주간 보고 작성</h1>
        <p class="desc">담당 프로젝트를 선택해 이번 주 진행 내용을 작성해주세요.</p>
      </header>
      <section>
        <div class="table-wrap">
          <table>
            <thead><tr><th>프로젝트</th><th>구분</th><th></th></tr></thead>
            <tbody>
${rows}
            </tbody>
          </table>
        </div>
      </section>
    </main>
    <footer>
      ${symbol}
      <p class="note">작성 내용은 내부 검토 후 발행됩니다 &middot; <strong>Cofoundary</strong></p>
    </footer>
  </div>
</div>

</body>
</html>
`;
}
