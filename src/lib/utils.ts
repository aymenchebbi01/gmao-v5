export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function isMobileApp(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Path check: dedicated tablet / mobile routes
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  if (
    path.startsWith('/tablet') ||
    path.startsWith('/mobile-') ||
    path === '/mobile-status' ||
    hash.startsWith('#tablet') ||
    hash.startsWith('#mobile-')
  ) {
    return true;
  }

  // 2. Active mobile/tablet session indicator
  try {
    if (sessionStorage.getItem('isMobileSession') === 'true') {
      return true;
    }
  } catch {}

  // 3. Real tablet & mobile devices (smartphones, Android tablets, iPads, touchscreens)
  const ua = navigator.userAgent || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) {
    return true;
  }

  // iPadOS detection (modern iPads identify as Macintosh with multitouch)
  if (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) {
    return true;
  }

  return false;
}

export function setMobileSession(isMobile: boolean) {
  try {
    if (isMobile) {
      sessionStorage.setItem('isMobileSession', 'true');
    } else {
      sessionStorage.removeItem('isMobileSession');
    }
  } catch {}
}
