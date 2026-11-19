// dist/ 결과물을 저장소 맨 위로 복사 → GitHub Pages "브랜치에서 배포" 방식에서도 바로 실행됨
import { cpSync, rmSync, readdirSync, existsSync } from 'node:fs';
rmSync('assets', { recursive: true, force: true });
for (const f of readdirSync('dist')) cpSync('dist/' + f, f, { recursive: true });
if (!existsSync('.nojekyll')) cpSync('dist/index.html', 'index.html');
console.log('저장소 맨 위에 배포 파일 복사 완료:', readdirSync('dist').join(', '));
