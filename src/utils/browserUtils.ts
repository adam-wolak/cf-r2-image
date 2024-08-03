export function getOptimalImageFormat(userAgent: string): string {
  if (userAgent.includes('Chrome') || userAgent.includes('Opera')) {
    return 'avif';
  } else if (userAgent.includes('Firefox')) {
    return 'avif';
  } else if (userAgent.includes('Safari') || userAgent.includes('Edge')) {
    // Sprawdzamy wersję dla Safari i Edge
    const version = parseInt(userAgent.split('Version/')[1]) || 0;
    if (version >= 16) {
      return 'avif';
    } else {
      return 'webp';
    }
  }
  return 'webp'; // Domyślny format dla innych przeglądarek
}
