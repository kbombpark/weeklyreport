// Base 입력 필드(여러 줄 텍스트) → 리포트 섹션.
// 규칙은 templates/intake-fields.md 와 각 필드 description 에 적힌 것과 같다.

// 한 줄에 한 항목. 줄 앞의 `-` 는 직전 항목의 하위 항목.
// 번호(`1.`)나 불릿(`•`)을 붙여 써도 받아준다.
function lines(text) {
  return String(text ?? '')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim());
}

const stripMarker = (s) => s.trim().replace(/^(?:\d+[.)]|[•*])\s*/, '').trim();
const isSub = (l) => /^\s*-\s+/.test(l) || /^\s{2,}\S/.test(l);

// 항목 목록으로. 하위 항목은 { text, sub: [...] } 로 묶는다.
function items(text) {
  const out = [];
  for (const raw of lines(text)) {
    if (isSub(raw) && out.length) {
      const t = raw.trim().replace(/^-\s+/, '').trim();
      if (!t) continue;
      const last = out[out.length - 1];
      const o = typeof last === 'string' ? { text: last } : last;
      (o.sub ??= []).push(t);
      out[out.length - 1] = o;
      continue;
    }
    const t = stripMarker(raw);
    if (t) out.push(t);
  }
  return out;
}

// `영역 | 내용 | 상태` → 표 행. 같은 영역이 연달아 오면 한 행으로 묶는다.
function tableRows(text, { plan = false } = {}) {
  const rows = [];
  for (const raw of lines(text)) {
    if (isSub(raw) && rows.length) {
      const t = raw.trim().replace(/^-\s+/, '').trim();
      const row = rows[rows.length - 1];
      const last = row.items[row.items.length - 1];
      if (!t || last === undefined) continue;
      const o = typeof last === 'string' ? { text: last } : last;
      (o.sub ??= []).push(t);
      row.items[row.items.length - 1] = o;
      continue;
    }

    const parts = stripMarker(raw).split('|').map((p) => p.trim());
    // 구분자가 없으면 영역 없이 내용만 있는 줄로 본다.
    const [area, body, status] = parts.length === 1 ? ['', parts[0], ''] : parts;
    if (!body) continue;

    const st = plan ? '' : status;
    // 같은 영역이라도 상태가 다르면 행을 나눈다 — 진행중 항목이 완료로 묶이면
    // 클라이언트에게 사실과 다른 보고가 나간다.
    const prev = rows[rows.length - 1];
    if (prev && prev.area === area && prev.status === st) prev.items.push(body);
    else rows.push({ area, items: [body], status: st });
  }

  return rows.map(({ area, items: its, status }) => {
    const row = { area, items: its };
    if (status) row.status = { text: status, tone: status.includes('완료') ? 'good' : 'prog' };
    return row;
  });
}

// 끝에 붙은 `[태그]` 를 태그로 올린다.
function notes(text) {
  return items(text).map((it) => {
    const s = typeof it === 'string' ? it : it.text;
    const m = s.match(/\[([^\]]{2,12})\]\s*[.。]?\s*$/);
    const base = m
      ? { tag: m[1], text: s.slice(0, m.index).trim().replace(/[,·\s]+$/, '') }
      : { text: s };
    if (typeof it !== 'string' && it.sub) base.sub = it.sub;
    return base;
  });
}

const paragraphs = (text) => lines(text).map(stripMarker).filter(Boolean);

// 섹션 하나를 만든다. 내용이 비면 null (보고서에서 섹션이 생략된다).
function buildSection(spec, get) {
  if (spec.type === 'dual') {
    const columns = spec.columns
      .map((c) => ({ label: c.label ?? c.field, items: items(get(c.field)) }))
      .filter((c) => c.items.length);
    if (!columns.length) return null;
    const title = spec.titleField ? get(spec.titleField) : spec.title;
    return { type: 'dual', ...(title ? { title } : {}), columns };
  }

  const raw = get(spec.field);
  if (!String(raw ?? '').trim()) return null;
  const title = spec.title ?? spec.field;

  switch (spec.type) {
    case 'table': {
      const rows = tableRows(raw, { plan: spec.plan });
      if (!rows.length) return null;
      const hasStatus = rows.some((r) => r.status);
      return {
        type: 'table',
        title,
        ...(hasStatus ? {} : { columns: ['작업 영역', '내용'] }),
        rows,
      };
    }
    case 'notes': {
      const list = notes(raw);
      return list.length ? { type: 'notes', title, items: list } : null;
    }
    case 'card': {
      const list = items(raw);
      return list.length ? { type: 'card', title, items: list } : null;
    }
    case 'text': {
      const ps = paragraphs(raw);
      return ps.length ? { type: 'text', title, text: ps } : null;
    }
    default:
      throw new Error(`알 수 없는 섹션 타입: ${spec.type}`);
  }
}

// record: { 필드명: 값 } 형태의 Base 레코드
export function buildReport({ client, record, date }) {
  const get = (name) => {
    const v = record[name];
    if (v == null) return '';
    if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : x?.name ?? x?.text ?? '')).join(', ');
    if (typeof v === 'object') return v.text ?? v.name ?? '';
    return String(v);
  };

  const cfg = client.intake ?? {};
  const asOf = date.replace(/-/g, '.');
  const report = {};

  const period = get('보고 기간');
  if (period) report.period = period;
  report.asOf = asOf;

  // 상단 요약칸 — 보고 기간 + client.yml 에 선언한 항목
  const stats = [];
  if (cfg.stats?.length) {
    const short = period.match(/(\d{2}\.\d{2})\s*[–~-]\s*(\d{2}\.\d{2})/);
    if (short) stats.push({ label: '보고 기간', value: `${short[1]}–${short[2]}`, mono: true });
    for (const s of cfg.stats) {
      const v = get(s.field);
      if (!v) continue;
      stats.push(
        s.pill
          ? { label: s.label ?? s.field, pill: { text: v, tone: v.includes('정상') ? 'good' : 'prog' } }
          : { label: s.label ?? s.field, value: v }
      );
    }
  }
  if (stats.length) report.stats = stats;

  const summary = get('전체 요약').split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
  if (summary) report.summary = summary;

  report.sections = (cfg.sections ?? []).map((s) => buildSection(s, get)).filter(Boolean);

  return report;
}

// 발행에 쓰지 않는 필드 — 어떤 경우에도 리포트로 넘기지 않는다.
export const EXCLUDED_FIELDS = ['내부 메모 (대외 미게재)', '외부 공유 링크', '상태', '작성자'];
