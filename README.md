# weeklyreport

Cofoundary가 클라이언트에 제출하는 주간 보고 페이지의 소스와 발행 파이프라인.

원본은 **라크 위키 아카이브의 회차 문서**다. 담당자 작성 방식은 그대로 두고,
그 문서를 읽어 외부 공유용 페이지를 만든다. HTML을 손으로 만들지 않는다.

```
라크 위키 문서  →  npm run sync  →  reports/<날짜>.yml  →  npm run build  →  docs/  →  Pages
(담당자 작성)                          (다듬는 지점)                                  ↓
                                                                    npm run base (Base 링크 갱신)
```

## 구조

```
clients/<slug>/
  client.yml            표시 정보 + 라크 위키 폴더·Base 프로젝트 키
  reports/<날짜>.yml     회차 내용 (sync 가 생성, 발행 전 다듬는다)
  legacy/<날짜>.html     전환 전 수기 리포트 — 그대로 배포, 수정 금지
src/
  lark-parse.mjs        라크 문서 → 리포트 데이터
  sync-lark.mjs         위키에서 회차 문서를 찾아 변환
  render.mjs            리포트 데이터 → HTML
  build.mjs             docs/ 생성
  new-report.mjs        직전 회차에서 이월한 빈 초안 (라크 문서 없이 쓸 때)
  update-base.mjs       Base "주간 보고 링크" 갱신
site.yml                발행 URL, 위키 도메인, Base 토큰
static/                 리포트와 무관한 페이지 (요청 접수 등)
docs/                   빌드 산출물 — 직접 수정 금지
templates/lark-doc-rules.md   담당자용 문서 작성 규칙
```

## 매주 하는 일

```bash
npm install                            # 최초 1회
npm run sync -- 1stcrm --list          # 위키 회차 문서 확인
npm run sync -- 1stcrm 2026-09-21      # 변환
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
- Base: `[전체]주간 리포트 아카이브` / 테이블 `주간 보고 링크`
- 인증은 `lark-cli auth status` 의 user 신원을 사용한다.

문서 작성 규칙은 `templates/lark-doc-rules.md`, 데이터 스키마와 편집 규칙은
`.claude/skills/weekly-report/SKILL.md` 를 본다.
