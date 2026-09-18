// 담당자용 웹 입력 페이지. 라크 폼을 임베드하고 작성 규칙을 함께 보여준다.
// 폼 공유 링크(lark.intakeShareUrl)가 없으면 안내 화면이 나온다.

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 프로젝트마다 쓰는 섹션이 달라서 규칙 예시도 그에 맞춰 보여준다.
function rules(client) {
  const titles = (client.intake?.sections ?? []).flatMap((s) =>
    s.type === 'dual' ? s.columns.map((c) => c.field) : [s.field]
  );
  const has = (re) => titles.some((t) => re.test(t));

  const out = [
    `모든 항목은 <strong>한 줄에 한 건</strong>입니다. 하위 내용은 줄 앞에 <code>-</code> 를 붙입니다.`,
  ];
  if (has(/완료 산출물|계획/)) {
    out.push(
      `표로 나오는 항목(<strong>지난주 완료 산출물</strong>, <strong>이번 주 계획</strong>)은 ` +
        `<code>영역 | 내용 | 상태</code> 순서로 씁니다. ` +
        `예: <code>개발 | 신규 병원 생성 기능 구현 | 완료</code><br>` +
        `같은 영역이라도 상태가 다르면 줄을 나눠 쓰세요 — 진행중 항목이 완료로 묶이면 잘못된 보고가 나갑니다.`
    );
  }
  if (has(/리스크|이슈/)) {
    out.push(
      `<strong>리스크·이슈</strong>는 끝에 대괄호를 붙이면 태그가 됩니다. ` +
        `예: <code>DB 이전 일정 확정이 필요합니다 [확인 필요]</code><br>` +
        `일정이나 비용이 바뀌었으면 반드시 숫자로 적어주세요.`
    );
  }
  if (has(/요청/)) {
    out.push(
      `<strong>요청사항</strong>에는 클라이언트가 결정하거나 확인해줘야 하는 것만 적습니다. ` +
        `여기 없으면 보고서에 올라가지 않습니다.`
    );
  }
  out.push(
    `문체는 신경 쓰지 않아도 됩니다. 사실만 적으면 대외 보고 문체로 정리해서 발행합니다. ` +
      `<strong>내부 메모</strong> 칸의 내용은 보고서에 실리지 않습니다.`
  );
  return out;
}

export function renderIntake({ client, slug, css, wordmark, symbol }) {
  const share = client.lark?.intakeShareUrl;
  const name = client.name;

  const formBlock = share
    ? `      <div class="form-card">
        <iframe src="${esc(share)}" title="${esc(name)} 주간 보고 입력 폼" loading="lazy" allow="clipboard-write"></iframe>
        <p class="form-fallback">화면이 보이지 않으면 <a href="${esc(share)}" target="_blank" rel="noopener">여기를 눌러 새 창에서 작성</a>해주세요.</p>
      </div>`
    : `      <div class="form-card">
        <div class="list-empty">
          폼 공유 링크가 아직 연결되지 않았습니다.<br>
          라크 Base <strong>주간 보고 입력</strong> → <strong>${esc(name)}</strong> 테이블의 폼에서 공유를 켠 뒤,<br>
          <code>clients/${esc(slug)}/client.yml</code> 의 <code>lark.intakeShareUrl</code> 에 링크를 넣어주세요.
        </div>
      </div>`;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(name)} 주간 보고 입력</title>
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
    <p class="client">${esc(client.display ?? name)}</p>
  </div>
</div>

<div class="layout">
  <div class="content-col" style="width:100%;">
    <main>
      <header class="report-head">
        <h1>${esc(name)} 주간 보고 입력</h1>
        <p class="desc">이번 주 진행 내용을 아래에 작성해주세요. 제출하면 클라이언트 보고 페이지의 초안이 됩니다.</p>
      </header>

      <section>
        <h2 class="section-head">작성</h2>
${formBlock}
      </section>

      <section style="margin-top:36px;">
        <h2 class="section-head">작성 방법</h2>
        <div class="note-card rules">
${rules(client).map((r) => `          <p>${r}</p>`).join('\n')}
        </div>
      </section>
    </main>

    <footer>
      ${symbol}
      <p class="note">작성 내용은 내부 검토 후 발행됩니다 &middot; <strong>Cofoundary</strong> &times; ${esc(name)}</p>
    </footer>
  </div>
</div>

</body>
</html>
`;
}

export function renderIntakeIndex({ entries, css, wordmark, symbol }) {
  const rows = entries
    .map(
      ({ slug, client, ready }) => `          <tr>
            <td class="area"><a href="./${esc(slug)}/">${esc(client.name)}</a></td>
            <td>${esc(client.display ?? client.name)}</td>
            <td class="status"><span class="pill ${ready ? 'good' : 'prog'}">${ready ? '연결됨' : '링크 미설정'}</span></td>
          </tr>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>주간 보고 입력</title>
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
        <h1>주간 보고 입력</h1>
        <p class="desc">담당 프로젝트를 선택해 이번 주 진행 내용을 작성해주세요.</p>
      </header>

      <section>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>프로젝트</th><th>구분</th><th>상태</th></tr>
            </thead>
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
