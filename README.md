# weeklyreport

Cofoundary가 클라이언트에 제출하는 주간 보고 페이지의 소스와 발행 파이프라인.

담당자 입력을 읽어 외부 공유용 페이지를 만든다. HTML을 손으로 만들지 않는다.
입력 경로는 두 가지이고 둘 다 같은 리포트 데이터로 모인다.

```
웹 입력 /input/      →  clients/<slug>/intake/<날짜>.md  ┐
Base "주간 보고 입력" →  npm run sync:base                ├→ reports/<날짜>.yml → build → Pages
라크 위키 회차 문서   →  npm run sync                     ┘         ↑                      ↓
                                                    /weekly-report 스킬   npm run base
```

웹 입력은 항목을 나누지 않는다. 담당자가 메모하듯 한 칸에 적으면 그대로 저장되고,
구조화(어느 문장이 어느 섹션의 어느 행인지)와 대표 보고용 문체 변환은
`/weekly-report` 스킬이 한다. Base·위키 경로는 변환기가 구조를 먼저 잡아 주지만
문체 변환은 똑같이 스킬이 맡는다.

**입력 내용이 그대로 보고서가 되지 않는다.** 그게 이 파이프라인의 핵심이다.

Base 는 필드가 정해진 입력 양식이라 변환이 정확하고, 위키 문서는 자유도가 높다.
기존 문서 방식을 쓰던 프로젝트는 그대로 두고 옮겨갈 수 있다.

## 구조

```
clients/<slug>/
  client.yml            표시 정보 + 라크 위키 폴더·Base 프로젝트 키
  intake/<날짜>.md       담당자가 웹에서 쓴 원문 (자유 형식)
  reports/<날짜>.yml     발행용 리포트 데이터 (스킬이 만든다)
  legacy/<날짜>.html     전환 전 수기 리포트 — 그대로 배포, 수정 금지
src/
  base-parse.mjs        Base 입력 필드 → 리포트 데이터
  sync-base.mjs         Base 레코드를 회차로 찾아 변환
  lark-parse.mjs        라크 위키 문서 → 리포트 데이터
  sync-lark.mjs         위키에서 회차 문서를 찾아 변환
  render.mjs            리포트 데이터 → HTML
  build.mjs             docs/ 생성
  new-report.mjs        직전 회차에서 이월한 빈 초안 (라크 문서 없이 쓸 때)
  update-base.mjs       Base "주간 보고 링크" 갱신
site.yml                발행 URL, 위키 도메인, Base 토큰
  render-intake.mjs     담당자용 웹 입력 페이지 (입력 + 실시간 미리보기)
static/                 리포트와 무관한 페이지 (요청 접수 등)
docs/                   빌드 산출물 — 직접 수정 금지
templates/intake-fields.md    담당자용 Base 입력 양식 규칙
templates/lark-doc-rules.md   담당자용 위키 문서 작성 규칙
```

## 매주 하는 일

```bash
npm install                            # 최초 1회
npm run sync:base -- 1stcrm --list     # Base 에 입력된 회차 확인
npm run sync:base -- 1stcrm 2026-09-21 # 변환 (Base 입력)
# 또는 위키 문서에서
npm run sync -- 1stcrm --list
npm run sync -- 1stcrm 2026-09-21
# clients/1stcrm/reports/2026-09-21.yml 을 대외 보고로 다듬는다
npm run build && npm run serve         # http://localhost:4321 에서 확인
git commit -am "1stcrm 2026-09-21" && git push
npm run base -- 1stcrm 2026-09-21 --write   # Base 링크·상태 갱신
```

푸시하면 GitHub Actions가 빌드해 Pages에 배포한다.

Claude Code에서는 `/weekly-report` 스킬이 위 과정을 대신한다. 변환에 더해
직전 회차와 이월 항목을 대조하고 대외 보고 문체로 다듬는다.

## 라크 연동

- 위키 아카이브: `(임시)클라이언트 주간 리포트` (space `7602268973530369557`)
- 입력 Base: `주간 보고 입력` — 프로젝트별 테이블 + 폼
- 담당자 입력 페이지: `/input/<slug>/` — 라크 계정이 없어도 된다. 자유 형식 한 칸.
  내부 메모는 저장 파일에 포함하지 않는다 (이 저장소는 공개다).
- 발행 Base: `[전체]주간 리포트 아카이브` / 테이블 `주간 보고 링크`
- 인증은 `lark-cli auth status` 의 user 신원을 사용한다.

섹션 매핑은 각 `clients/<slug>/client.yml` 의 `intake` 에 선언돼 있다. 필드를
바꾸면 그 매핑만 고치면 되고 코드는 건드리지 않는다.

작성 규칙은 `templates/intake-fields.md` 와 `templates/lark-doc-rules.md`, 데이터 스키마와 편집 규칙은
`.claude/skills/weekly-report/SKILL.md` 를 본다.
