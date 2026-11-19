// 배포용 난독화: dist/assets/*.js 를 덮어씀 (원본은 src/ 에 그대로 보관)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import JavaScriptObfuscator from 'javascript-obfuscator';

const dir = 'dist/assets';
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.js')) continue;
  const p = join(dir, f);
  const src = readFileSync(p, 'utf8');
  const out = JavaScriptObfuscator.obfuscate(src, {
    compact: true,
    target: 'browser',
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.6,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    splitStrings: false,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    selfDefending: false,
    debugProtection: false,
    numbersToExpressions: false,
    transformObjectKeys: false,
    unicodeEscapeSequence: false,
  }).getObfuscatedCode();
  writeFileSync(p, out);
  console.log(`난독화 완료: ${f} (${(src.length / 1024).toFixed(0)}KB → ${(out.length / 1024).toFixed(0)}KB)`);
}
