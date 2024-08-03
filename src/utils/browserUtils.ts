export function getOptimalImageFormat(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  // Sprawdzanie AVIF dla Chrome, Edge i Opera
  if (
    /chrome\/(?:(?:9\d)|(?:1\d{2,}))/.test(ua) ||
    /edg\/(?:(?:9\d)|(?:1\d{2,}))/.test(ua) ||
    /opr\/(?:(?:9\d)|(?:1\d{2,}))/.test(ua)
  ) {
    return 'avif';
  }

  // Sprawdzanie AVIF dla Firefox
  if (/firefox\/(?:9[2-9]|[1-9]\d{2,})/.test(ua)) {
    return 'avif';
  }

  // Sprawdzanie AVIF dla Safari
  if (/safari\//.test(ua) && !/chrome/.test(ua)) {
    const match = ua.match(/version\/(\d+)/);
    const version = match ? parseInt(match[1], 10) : 0;
    if (version >= 16) {
      return 'avif';
    }
  }

  // Sprawdzanie WebP dla starszych wersji przeglądarek
  if (
    /chrome\//.test(ua) ||
    /firefox\//.test(ua) ||
    /edge\//.test(ua) ||
    /opr\//.test(ua) ||
    (/safari\//.test(ua) && !/chrome/.test(ua))
  ) {
    return 'webp';
  }

  // Domyślny format dla innych przeglądarek
  return 'jpeg';
}
