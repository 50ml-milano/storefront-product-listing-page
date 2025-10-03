/*
Copyright 2024 Adobe
All Rights Reserved.

NOTICE: Adobe permits you to use, modify, and distribute this file in
accordance with the terms of the Adobe license agreement accompanying
it.
*/

import { ProductViewMedia } from '../types/interface';

const getProductImageURLs = (
  images: ProductViewMedia[],
  amount: number = 3,
  topImageUrl?: string
): string[] => {
  const imageUrlArray: Array<string> = [];
  const url = new URL(window.location.href);
  const protocol = url.protocol;

  // const topImageUrl = "http://master-7rqtwti-wdxwuaerh4gbm.eu-4.magentosite.cloud/media/catalog/product/3/1/31t0a-sopll._ac_.jpg";
  for (const image of images) {
    const imageUrl = image.url?.replace(/^https?:\/\//, '');
    if (imageUrl) {
      imageUrlArray.push(`${protocol}//${imageUrl}`);
    }
  }

  if (topImageUrl) {
    const topImageUrlFormatted = `${protocol}//${topImageUrl.replace(
      /^https?:\/\//,
      ''
    )}`;
    const index = topImageUrlFormatted.indexOf(topImageUrlFormatted);
    if (index > -1) {
      imageUrlArray.splice(index, 1);
    }

    imageUrlArray.unshift(topImageUrlFormatted);
  }

  return imageUrlArray.slice(0, amount);
};

export interface ResolveImageUrlOptions {
  width: number;
  height?: number;
  auto?: string;
  optimize?: string;
  crop?: boolean;
  fit?: string;
  'bg-color'?: string;
}

const resolveImageUrl = (url: string, opts: ResolveImageUrlOptions): string => {
  const [base, query] = url.split('?');
  const params = new URLSearchParams(query);

  Object.entries(opts).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  });

  return `${base}?${params.toString()}`;
};

const getBackgroundColor = (storeCode?: string): string => {
  if (storeCode === 'mmataha') {
    return '255,254,240';
  }
  return '255,255,255';
};

const generateOptimizedImages = (
  imageUrls: string[],
  baseImageWidth: number,
  storeCode?: string
): { src: string; srcset: any }[] => {
  const baseOptions = {
    fit: 'bounds',
    dpi: 1,
    height: 371,
  };

  const bgColor = getBackgroundColor(storeCode);
  const imageUrlArray: Array<{ src: string; srcset: any }> = [];

  for (const imageUrl of imageUrls) {
    const src = resolveImageUrl(imageUrl, {
      ...baseOptions,
      width: baseImageWidth,
    });
    const dpiSet = [1, 2, 3];
    const srcset = dpiSet.map((dpi) => {
      return `${resolveImageUrl(imageUrl, {
        ...baseOptions,
        auto: 'webp',
        optimize: 'medium',
        width: baseImageWidth * dpi,
        height: 371*dpi,
        'bg-color': bgColor,
      })} ${dpi}x`;
    });
    imageUrlArray.push({ src, srcset });
  }

  return imageUrlArray;
};

export { generateOptimizedImages, getProductImageURLs };
