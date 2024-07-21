import { getDimensionsFromDeviceType } from '../utils/deviceUtils';
import { config } from '../config';
import { optimizeImageUrl } from '../utils/urlUtils';

export class ImageHandler {
  constructor(
    private deviceType: string,
    private bestFormat: string,
    private request: Request
  ) {}

  element(element: Element) {
    const src = element.getAttribute('src');
    if (src) {
      const newSrc = this.getOptimizedImageUrl(src, element);
      element.setAttribute('src', newSrc);
    }

    const srcset = element.getAttribute('srcset');
    if (srcset) {
      const newSrcset = this.getOptimizedSrcset(srcset, element);
      element.setAttribute('srcset', newSrcset);
    }
  }

getOptimizedImageUrl(src: string, element: Element): string {
  const { width, height } = this.getDimensions(element);
  
  return optimizeImageUrl(src, {
    format: this.bestFormat,
    width,
    height,
    fit: config.TRANSFORM_PARAMS.fit,
    gravity: config.TRANSFORM_PARAMS.gravity,
    quality: config.TRANSFORM_PARAMS.quality
  });
 }

  getOptimizedSrcset(srcset: string, element: Element): string {
    return srcset.split(',').map(src => {
      const [url, descriptor] = src.trim().split(' ');
      const optimizedUrl = this.getOptimizedImageUrl(url, element);
      return `${optimizedUrl} ${descriptor}`;
    }).join(', ');
  }

  getDimensions(element: Element): { width: number, height: number } {
    let width = parseInt(element.getAttribute('width') || '0');
    let height = parseInt(element.getAttribute('height') || '0');
    if (width && height) return { width, height };

    const srcset = element.getAttribute('srcset');
    if (srcset) {
      const sizes = srcset.split(',').map(src => {
        const [, descriptor] = src.trim().split(' ');
        return parseInt(descriptor) || 0;
      });
      width = Math.max(...sizes);
      height = Math.round(width * 3 / 4);
    }

    if (!width || !height) {
      return getDimensionsFromDeviceType(this.deviceType);
    }

    return { width, height };
  }
}
