# 블록쇼 라이브! (BLOCK SHOW LIVE)

TV 블록 게임쇼에 출연해 보석을 모으고 탈출하는 오리지널 픽셀아트 액션 플랫포머.

- **1인 스토리**: 3챕터(요리쇼 · 퀴즈쇼 · 디스코 쇼) × 5스테이지, 보스 3종, 별 45개
- **대전**: 보석 쟁탈전 · 영역 차지 · 서바이벌 / 같은 기기 2인 · 온라인 P2P 최대 4인(2:2 팀전)
- PC(키보드·게임패드) · 모바일(가상 패드, 전체 화면) 지원

## 플레이 주소
https://0611gareddug.github.io/BBC/

## 폴더 구조
```
index.html              진입 HTML
public/                 글꼴(Galmuri, SIL OFL), 아이콘, PWA 파일
src/                    원본 소스 (난독화 전, 유지보수용)
  core/                 상수, 입력, 사운드, 저장, 소스 보호
  gfx/                  도트 그래픽 생성 (캐릭터·적·타일·배경)
  game/                 월드, 플레이어, 적·아이템, 보스, 연출(MC·관객), HUD
  modes/                스토리, 대전(로컬·방장), 온라인 참가자, 컷신
  net/                  PeerJS P2P 연결
  ui/                   메뉴 화면, 터치 패드
  data/                 스테이지 맵, MC 대사, 퀴즈
scripts/
  validate-levels.mjs   스테이지 도달 가능성 검사
  obfuscate.mjs         배포용 난독화
.github/workflows/deploy.yml  main에 푸시하면 자동 빌드·난독화·배포
```

## 개발
```bash
npm install
npm run dev        # 개발 서버
npm run build      # dist/ 생성 + 난독화
node scripts/validate-levels.mjs
```

## 배포 (처음 한 번)
저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꾸면,
이후 `main` 브랜치에 푸시할 때마다 자동으로 배포됩니다.
