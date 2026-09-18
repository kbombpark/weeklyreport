// 라크 위키 주간 보고 문서(docx) → 리포트 데이터.
// 담당자가 쓰는 문서 구조를 그대로 읽는다. 문체 가공은 하지 않는다 — 그건 스킬의 몫.

const unescapeMd = (s) => s.replace(/\\([\\`*_{}\[\]()#+\-.!~|])/g, '$1');
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rarr: '\u2192', larr: '\u2190', mdash: '\u2014', ndash: '\u2013',
  middot: '\u00b7', hellip: '\u2026', lsquo: '\u2018', rsquo: '\u2019',
  ldquo: '\u201c', rdquo: '\u201d', times: '\u00d7', deg: '\u00b0',
};

// 라크 본문에는 `&amp;mdash;` 처럼 이중 인코딩된 엔티티가 섞여 있어
// 더 이상 변하지 않을 때까지 반복해서 해제한다.
const decode = (s) => {
  let out = String(s).replace(/<br\s*\/?>/g, '\n');
  for (let i = 0; i < 4; i++) {
    const next = out.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
    if (next === out) break;
    out = next;
  }
  return out;
};
const stripTags = (s) => decode(s).replace(/<[^>]+>/g, '');
const plain = (s) => unescapeMd(decode(s)).replace(/[ \t]+/g, ' ').trim();
const clean = (s) => unescapeMd(stripTags(s)).replace(/[ \t]+/g, ' ').trim();

// <ol>/<ul> 을 중첩 포함해 항목 배열로. 목록이 없으면 null.
function parseList(html) {
  const open = html.search(/<(ol|ul)\b/);
  if (open === -1) return null;
  const tag = html.slice(open).match(/<(ol|ul)\b/)[1];
  // 같은 종류의 여는/닫는 태그를 세어 균형 잡힌 끝을 찾는다.
  const re = new RegExp(`</?(?:ol|ul)\\b[^>]*>`, 'g');
  re.lastIndex = open;
  let depth = 0, end = -1, m;
  while ((m = re.exec(html))) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) { end = m.index + m[0].length; break; }
  }
  if (end === -1) return null;
  const inner = html.slice(open + html.slice(open).indexOf('>') + 1, end - `</${tag}>`.length);

  const items = [];
  const li = /<li\b[^>]*>/g;
  let start;
  while ((start = li.exec(inner))) {
    // 이 <li> 에 대응하는 </li> 를 중첩을 고려해 찾는다.
    const liRe = /<\/?li\b[^>]*>/g;
    liRe.lastIndex = start.index;
    let d = 0, stop = inner.length;
    let x;
    while ((x = liRe.exec(inner))) {
      d += x[0].startsWith('</') ? -1 : 1;
      if (d === 0) { stop = x.index; li.lastIndex = liRe.lastIndex; break; }
    }
    const body = inner.slice(start.index + start[0].length, stop);
    const sub = parseList(body);
    const text = clean(sub ? body.slice(0, body.search(/<(ol|ul)\b/)) : body);
    if (!text && !sub) continue;
    items.push(sub ? { text, sub } : text);
  }
  return items.length ? items : null;
}

// 표 한 칸 → { items, note }
function parseCell(html) {
  const list = parseList(html);
  if (list) {
    // 목록 뒤에 붙은 보충 설명(* 로 시작)은 별도 항목으로 살린다.
    const after = clean(html.slice(html.lastIndexOf('</ol>') + 5 > 4 ? html.lastIndexOf('</ol>') + 5 : html.lastIndexOf('</ul>') + 5));
    const extra = after.split('\n').map((l) => l.replace(/^\*\s*/, '').trim()).filter(Boolean);
    return [...list, ...extra];
  }
  const text = clean(html);
  return text ? text.split('\n').map((l) => l.trim()).filter(Boolean) : [];
}

function parseTable(html) {
  const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  if (!rows.length) return null;
  const head = [...rows[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => clean(m[1]));
  const body = rows.slice(head.length ? 1 : 0);
  const out = [];
  for (const r of body) {
    const cells = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (!cells.length) continue;
    const row = { area: clean(cells[0]), items: parseCell(cells[1] ?? '') };
    if (cells[2] !== undefined) {
      const s = clean(cells[2]);
      if (s) row.status = { text: s, tone: s.includes('완료') ? 'good' : 'prog' };
    }
    out.push(row);
  }
  return { columns: head.length ? head : undefined, rows: out };
}

// 마크다운 목록(중첩 포함) → 항목 배열
function parseMdList(body) {
  const lines = body.split('\n').filter((l) => /^\s*(?:[-*+]|\d+[.)])\s+/.test(l));
  if (!lines.length) return null;
  const nodes = lines.map((l) => {
    const m = l.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/);
    return { indent: m[1].replace(/\t/g, '    ').length, text: plain(m[2]) };
  }).filter((n) => n.text);
  if (!nodes.length) return null;

  const base = Math.min(...nodes.map((n) => n.indent));
  const out = [];
  for (const n of nodes) {
    if (n.indent <= base || !out.length) out.push({ text: n.text });
    else {
      const parent = out[out.length - 1];
      (parent.sub ??= []).push(n.text);
    }
  }
  // 하위 항목이 없으면 문자열로 평탄화한다.
  return out.map((o) => (o.sub ? o : o.text));
}

// 마크다운 파이프 표 → { columns, rows }
function parsePipeTable(body) {
  const lines = body.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
  if (lines.length < 2) return null;
  const cells = (l) => l.replace(/^\||\|$/g, '').split('|').map((c) => plain(c));
  const head = cells(lines[0]);
  if (!/^[\s|:-]+$/.test(lines[1])) return null; // 구분선이 없으면 표가 아니다
  const rows = [];
  for (const l of lines.slice(2)) {
    const c = cells(l);
    if (!c.length || c.every((x) => !x)) continue;
    const row = { area: c[0], items: c[1] ? [c[1]] : [] };
    if (c[2]) row.status = { text: c[2], tone: c[2].includes('완료') ? 'good' : 'prog' };
    rows.push(row);
  }
  return rows.length ? { columns: head, rows } : null;
}

const isRiskTitle = (t) => /리스크|이슈|의존|확인 필요|특이/.test(t);
const isAskTitle = (t) => /요청/.test(t);

// 제목 하나에 딸린 본문 → 섹션 (표 / 태그목록 / 카드 / 문단)
function parseBody(title, body) {
  const htmlTable = body.match(/<table>[\s\S]*?<\/table>/);
  const table = htmlTable ? parseTable(htmlTable[0]) : parsePipeTable(body);
  if (table) {
    const hasStatus = table.rows.some((r) => r.status);
    return { type: 'table', title, ...(hasStatus ? {} : { columns: table.columns }), rows: table.rows };
  }

  const list = parseMdList(body);
  if (list) {
    if (isRiskTitle(title)) {
      return {
        type: 'notes',
        title,
        items: list.map((it) => {
          const text = typeof it === 'string' ? it : it.text;
          const tag = text.match(/\[([^\]]{2,12})\]\s*[.。]?\s*$/);
          return tag
            ? { tag: tag[1], text: text.slice(0, tag.index).trim().replace(/[,·\s]+$/, '') }
            : { text };
        }),
      };
    }
    return { type: 'card', title, items: list };
  }

  const text = body.split('\n').map(plain).filter(Boolean);
  return text.length ? { type: 'text', title, text } : null;
}

// "## 지난주 한 일" / "## 이번주 할 일" 쌍은 좌우 2단으로 낸다.
const DUAL_LEFT = /지난\s*주|지난주|완료/;
const DUAL_RIGHT = /이번\s*주|금주|계획|할\s*일/;

function parseSection(title, body) {
  const subs = body.split(/\n(?=##\s)/);
  if (subs.length < 2 && !/^##\s/.test(body.trimStart())) return [parseBody(title, body)];

  const parsed = subs
    .map((chunk) => {
      const t = chunk.match(/^##\s*(.*)$/m);
      if (!t) return null;
      const rest = chunk.slice(chunk.indexOf('\n') + 1);
      return { title: clean(t[1]), body: rest };
    })
    .filter(Boolean);

  if (
    parsed.length === 2 &&
    DUAL_LEFT.test(parsed[0].title) &&
    DUAL_RIGHT.test(parsed[1].title)
  ) {
    const cols = parsed.map((s) => ({ label: s.title, items: parseMdList(s.body) ?? [] }));
    if (cols.every((c) => c.items.length)) return [{ type: 'dual', title, columns: cols }];
  }

  return parsed.map((s) => parseBody(s.title, s.body)).filter(Boolean);
}

export function parseLarkReport(markdown) {
  const src = markdown.replace(/<title>[\s\S]*?<\/title>/, '').trim();

  const report = {};
  const period = src.match(/\*\*보고 기간:?\*\*\s*([^\n]*)/);
  if (period) {
    const raw = plain(period[1]);
    const asOf = raw.match(/작성 기준일\s*([\d.]+)/);
    report.period = raw.replace(/\s*\(?작성 기준일[^)]*\)?/, '').replace(/~/, '–').trim();
    if (asOf) report.asOf = asOf[1];
  }
  const summary = src.match(/\*\*전체 요약:?\*\*\s*([\s\S]*?)(?=\n#|\n\*\*|$)/);
  if (summary) {
    const s = clean(summary[1]).split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
    if (s) report.summary = s;
  }

  // "# 제목" 단위로 자른다.
  const parts = src.split(/\n(?=#\s)/).slice(1);
  report.sections = parts
    .flatMap((p) => {
      const nl = p.indexOf('\n');
      const title = clean(p.slice(2, nl === -1 ? undefined : nl));
      return parseSection(title, nl === -1 ? '' : p.slice(nl + 1));
    })
    .filter(Boolean);

  return report;
}
