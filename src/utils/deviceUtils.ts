import mobile from 'is-mobile';

export function getDeviceType(request: Request): 'mobile' | 'tablet' | 'desktop' {
  const userAgent = request.headers.get('User-Agent') || '';
  if (mobile({ ua: userAgent })) {
    return mobile({ tablet: true, ua: userAgent }) ? 'tablet' : 'mobile';
  }
  return 'desktop';
}

export function getBestImageFormat(request: Request): string {
  const accept = request.headers.get('Accept') || '';
  if (accept.includes('image/avif')) return 'avif';
  if (accept.includes('image/webp')) return 'webp';
  return 'auto';
}

export function getDimensionsFromDeviceType(deviceType: string): { width: number, height: number } {
  switch (deviceType) {
    case 'mobile':
      return { width: 360, height: 640 };
    case 'tablet':
      return { width: 768, height: 1024 };
    case 'desktop':
    default:
      return { width: 1920, height: 1080 };
  }
}
