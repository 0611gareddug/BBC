# 블록쇼 라이브! (BLOCK SHOW LIVE)

TV 블록 게임쇼에 출연해 보석을 모으고 탈출하는 오리지널 픽셀아트 액션 플랫포머.

- **1인 스토리**: 3챕터(요리쇼 · 퀴즈쇼 · 디스코 쇼) × 5스테이지, 보스 3종, 별 45개
- **대전**: 보석 쟁탈전 · 영역 차지 · 서바이벌 / 같은 기기 2인 · 온라인 P2P 최대 4인(2:2 팀전)
- PC(키보드·게임패드) · 모바일(가상 패드, 전체 화면) 지원

## 플레이 주소
https://0611gareddug.github.io/BBC/

## 폴더 구조
```
index.html, assets/, fonts/ …   배포용 빌드 결과 (GitHub Pages가 바로 보여주는 파일, 직접 수정 금지)
web/index.html          원본 HTML
public/                 글꼴(Galmuri, SIL OFL), 아이콘, PWA 파일
src/                    원본 소스 (난독화 전, 유지보수용)
scripts/                레벨 검사 · 난독화 · 배포 파일 복사
```

## 개발
```bash
npm install
npm run dev        # 개발 서버
npm run publish    # 빌드 + 난독화 후 저장소 맨 위로 복사 → 커밋·푸시하면 배포
```

## 배포
Settings → Pages → Source: **Deploy from a branch**, Branch: **main / (root)**
