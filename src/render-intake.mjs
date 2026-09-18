// 담당자용 웹 입력 페이지.
// 항목을 잘게 나누지 않고 자유 형식으로 받는다. 구조화와 문체 변환은 발행 단계에서
// /weekly-report 스킬이 한다 — 여기서 기계적으로 표를 만들지 않는다.

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PLACEHOLDER = `형식은 자유입니다. 메모하듯 적으시면 됩니다.

지난주
- DUR 코드 이전 끝냄. 테스트는 아직
- 수정 항목 QA 반영 완료
- 상용 서비스 아웃바운드 IP 고정 — 외부 연동 기관 IP 제한 때문에
- 디자인: 고객관리 모달 최종안 나옴
- 악성 문자 시스템 인프라 분석 끝

이번주
- DUR 테스트
- DB 이전 검토
- 악성 문자 인프라 구축 착수
- 안드로이드 앱 QA

막힌 것 / 확인 필요
- 전체 마이그레이션 목표 완료일이 아직 안 정해짐
- DUR 인수인계 업체 일정 회신이 없음

일정·비용
- 악성 문자 인프라 월 10~15만원 추가

요청
- DB 이전 작업 가능 시간대 알려달라고 해야 함
- 외부 연동 QA 일정 (전자서명, 네모닉, 이지콜, 이브렙, 닥톡)`;

export function renderIntake({ client, slug, css, wordmark, symbol, repo }) {
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

<div class="layout">
  <div class="content-col" style="width:100%;">
    <main>
      <header class="report-head">
        <h1>${esc(client.name)} 주간 보고 작성</h1>
        <p class="desc">형식 맞추지 마시고 아는 대로 적어주세요. 표로 정리하고 대표 보고용 문체로 바꾸는 일은 발행 단계에서 합니다.</p>
      </header>

      <div class="fld-group">
        <div class="meta-row">
          <div class="fld">
            <label for="f-date">회차 <span class="req">필수</span></label>
            <input id="f-date" type="date" data-field="date">
          </div>
          <div class="fld">
            <label for="f-period">보고 기간</label>
            <input id="f-period" type="text" data-field="period" placeholder="비워두면 회차 기준 한 주로 채웁니다">
          </div>
          <div class="fld">
            <label for="f-author">작성자</label>
            <input id="f-author" type="text" data-field="author" placeholder="이름">
          </div>
        </div>
      </div>

      <div class="fld-group">
        <div class="fld">
          <label for="f-body">이번 주 내용 <span class="req">필수</span></label>
          <p class="fld-note">
            문장을 다듬지 마세요. 아래 다섯 가지가 들어가 있으면 충분합니다 —
            <strong>지난주 한 일 · 이번 주 할 일 · 막힌 것 · 일정이나 비용 변동 · 클라이언트에게 요청할 것</strong>.
            빠진 게 있으면 발행 전에 따로 여쭤봅니다.
          </p>
          <textarea id="f-body" rows="24" data-field="body" placeholder="${esc(PLACEHOLDER)}"></textarea>
        </div>
      </div>

      <div class="fld-group">
        <div class="fld">
          <label for="f-memo">내부 메모</label>
          <p class="fld-note">
            보고서에 실리지 않고, <strong>아래에서 만드는 파일에도 들어가지 않습니다.</strong>
            판단 근거나 내부 사정을 남기시려면 따로 복사해 전달해주세요.
          </p>
          <textarea id="f-memo" rows="3" data-field="memo" placeholder="대외로 나가면 안 되는 내용"></textarea>
          <div class="actions" style="margin-top:10px;">
            <button id="btn-memo" class="btn subtle">내부 메모만 따로 복사</button>
          </div>
        </div>
      </div>

      <section style="margin-top:28px;">
        <h2 class="section-head">작성 점검</h2>
        <div class="note-card">
          <ul class="checks" id="checks"></ul>
          <p class="check-note">단어를 훑어본 추정입니다. 표시가 없어도 내용에 있으면 괜찮습니다.</p>
        </div>
      </section>

      <div class="actions" style="margin-top:22px;">
        <button id="btn-copy" class="btn primary">작성 내용 복사</button>
        <button id="btn-download" class="btn">파일로 내려받기</button>
        <button id="btn-github" class="btn">GitHub에 올리기</button>
        <button id="btn-clear" class="btn subtle">비우기</button>
      </div>
      <p class="saved">작성 중인 내용은 이 브라우저에 자동 저장됩니다.</p>
    </main>

    <footer>
      ${symbol}
      <p class="note">작성 내용은 내부 검토 후 발행됩니다 &middot; <strong>Cofoundary</strong> &times; ${esc(client.name)}</p>
    </footer>
  </div>
</div>

<script type="module">
const SLUG = ${JSON.stringify(slug)};
const REPO = ${JSON.stringify(repo ?? '')};
const KEY = 'weeklyreport:intake:' + SLUG;
const el = (id) => document.getElementById(id);
const inputs = [...document.querySelectorAll('[data-field]')];
const val = (n) => document.querySelector('[data-field="' + n + '"]').value.trim();

// 회차(월요일)로부터 한 주 기간 문자열
function defaultPeriod(date) {
  if (!date) return '';
  const start = new Date(date + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const f = (d) => String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  return start.getFullYear() + '.' + f(start) + ' – ' + f(end);
}

const CHECKS = [
  { label: '지난주 한 일', re: /지난\\s*주|저번\\s*주|완료|끝냄|마무리|했음|반영/ },
  { label: '이번 주 할 일', re: /이번\\s*주|금주|예정|착수|진행할|계획/ },
  { label: '막힌 것 · 확인 필요', re: /막힘|막힌|지연|블로커|확인\\s*필요|미정|안\\s*정해|회신|대기/ },
  { label: '일정 · 비용 변동', re: /[0-9]\\s*(만원|원|일|주|개월|월)|비용|일정|추가|연기/ },
  { label: '클라이언트에게 요청할 것', re: /요청|부탁|회신|확인해|알려|결정/ },
];

function refresh() {
  const body = val('body');
  const ul = el('checks');
  ul.innerHTML = '';
  for (const c of CHECKS) {
    const ok = c.re.test(body);
    const li = document.createElement('li');
    li.className = ok ? 'ok' : 'miss';
    li.textContent = (ok ? '확인됨 · ' : '안 보임 · ') + c.label;
    ul.appendChild(li);
  }
  if (body.length && body.length < 80) {
    const li = document.createElement('li');
    li.className = 'miss';
    li.textContent = '안 보임 · 내용이 너무 짧습니다';
    ul.appendChild(li);
  }
}

const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(inputs.map((i) => [i.dataset.field, i.value]))));
  } catch {}
};

const restore = () => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const i of inputs) if (s[i.dataset.field] != null) i.value = s[i.dataset.field];
  } catch {}
};

// 담당자 원문 그대로. 내부 메모는 넣지 않는다 — 이 저장소는 공개되어 있다.
function fileText() {
  const date = val('date');
  if (!date) throw new Error('회차를 선택해주세요.');
  if (!val('body')) throw new Error('이번 주 내용을 입력해주세요.');
  const period = val('period') || defaultPeriod(date);
  const author = val('author');
  return [
    '---',
    'client: ' + SLUG,
    'date: ' + date,
    period ? 'period: "' + period + '"' : null,
    author ? 'author: "' + author + '"' : null,
    'source: web-intake',
    '---',
    '',
    val('body'),
    '',
  ].filter((l) => l !== null).join('\\n');
}

const fileName = () => (val('date') || 'draft') + '.md';
const fail = (e) => alert(e.message || String(e));

el('btn-copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText(fileText());
    el('btn-copy').textContent = '복사했습니다';
    setTimeout(() => (el('btn-copy').textContent = '작성 내용 복사'), 1600);
  } catch (e) { fail(e); }
};

el('btn-memo').onclick = async () => {
  try {
    if (!val('memo')) throw new Error('내부 메모가 비어 있습니다.');
    await navigator.clipboard.writeText(val('memo'));
    el('btn-memo').textContent = '복사했습니다';
    setTimeout(() => (el('btn-memo').textContent = '내부 메모만 따로 복사'), 1600);
  } catch (e) { fail(e); }
};

el('btn-download').onclick = () => {
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([fileText()], { type: 'text/markdown' }));
    a.download = fileName();
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) { fail(e); }
};

el('btn-github').onclick = () => {
  try {
    if (!REPO) throw new Error('저장소가 설정되지 않았습니다.');
    const text = fileText();
    const path = 'clients/' + SLUG + '/intake/' + fileName();
    const url = 'https://github.com/' + REPO + '/new/main?filename=' +
      encodeURIComponent(path) + '&value=' + encodeURIComponent(text);
    if (url.length > 7500) throw new Error('내용이 길어 GitHub 링크로 보낼 수 없습니다. "작성 내용 복사" 또는 "파일로 내려받기" 를 써주세요.');
    window.open(url, '_blank', 'noopener');
  } catch (e) { fail(e); }
};

el('btn-clear').onclick = () => {
  if (!confirm('작성 중인 내용을 모두 지웁니다. 계속할까요?')) return;
  for (const i of inputs) i.value = '';
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
        <p class="desc">담당 프로젝트를 선택해 이번 주 진행 내용을 적어주세요.</p>
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
