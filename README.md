# weeklyreport

Cofoundary가 클라이언트에 제출하는 주간 보고서 소스와 발행 페이지.

리포트는 **HTML을 손으로 만들지 않는다.** 회차마다 데이터 파일 하나만 쓰고 빌드하면
디자인이 동일한 정식 보고서가 나온다.

```
clients/<slug>/
  client.yml            클라이언트 표시 정보 (1회 설정)
  reports/<날짜>.yml     회차별 내용            ← 매주 만지는 건 이것뿐
  legacy/<날짜>.html     전환 전 수기 리포트     ← 그대로 배포, 수정 금지
src/                    렌더러·빌드 스크립트·테마
static/                 리포트와 무관한 페이지 (요청 접수 등)
docs/                   빌드 산출물 (GitHub Pages 소스, 직접 수정 금지)
templates/intake.md     담당자용 작성 양식
```

## 매주 하는 일

```bash
npm install                                 # 최초 1회
node src/new-report.mjs 1stcrm 2026-09-21   # 직전 회차에서 이월된 초안 생성
# clients/1stcrm/reports/2026-09-21.yml 의 TODO 를 채운다
npm run build                               # docs/ 재생성
npm run serve                               # http://localhost:4321 에서 확인
git commit -am "1stcrm 2026-09-21" && git push
```

푸시하면 GitHub Actions가 빌드해 Pages에 배포한다.

Claude Code에서는 `/weekly-report` 스킬에 담당자가 쓴 원자료를 넘기면
대외 보고 문체로 가공하고 이월 항목을 대조해 초안까지 만들어 준다.

## 섹션 타입

`table`(영역/내용/상태 표), `notes`(태그+한 줄, 리스크·이슈), `card`(요청사항),
`dual`(좌우 2단), `text`(자유 문단). 자세한 스키마는 `.claude/skills/weekly-report/SKILL.md`.
