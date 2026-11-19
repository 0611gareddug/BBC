// 소스 보기 방지 (배포 빌드에서만 동작)
export function installGuard() {
  if (!import.meta.env.PROD) return;
  const block = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
  document.addEventListener('contextmenu', block, true);
  document.addEventListener('dragstart', block, true);
  document.addEventListener('selectstart', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    block(e);
  }, true);
  document.addEventListener('keydown', (e) => {
    const k = e.key ? e.key.toUpperCase() : '';
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'F12' ||
      (ctrl && e.shiftKey && ['I', 'J', 'C', 'K'].includes(k)) ||
      (ctrl && e.altKey && ['I', 'J', 'C', 'U'].includes(k)) ||
      (ctrl && ['U', 'S', 'P'].includes(k))) {
      block(e);
    }
  }, true);
}
