/*
50ml customisation — not part of the upstream Adobe widget.
*/

import { getSampleVariants, SampleVariant } from '../api/sampleVariants';
import { StoreDetailsProps } from '../context/store';
import {
  FacetFilter,
  Money,
  Product,
  ProductMedia,
  ProductPrice,
  ProductViewMedia,
  SampleListingConfig,
} from '../types/interface';

/**
 * The filter that stands in for the category on a sample listing.
 *
 * A sample is never assigned to a category — it is a variant of a perfume that is. So the listing
 * asks for the parents by the capacity that makes them a sample instead.
 */
const sampleListingFilter = (
  sampleListing: SampleListingConfig
): FacetFilter => {
  const labels = sampleListing.options.map((option) => option.label);

  return labels.length === 1
    ? { attribute: sampleListing.attributeCode, eq: labels[0] }
    : { attribute: sampleListing.attributeCode, in: labels };
};

/**
 * The parent's product page with the sample already chosen.
 *
 * Built from the store's own base url rather than the product's `canonical_url`, because the
 * indexed url carries whichever host the catalog was exported from, and it is the parent's page we
 * want in every case — the sample has no page of its own.
 */
const sampleProductUrl = (
  urlKey: string | null,
  optionId: number | undefined,
  sampleListing: SampleListingConfig,
  baseUrl: string | undefined,
  fallback: string | null
): string | null => {
  if (!urlKey || !baseUrl || !optionId) {
    return fallback;
  }

  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  return `${base}${urlKey}${sampleListing.urlSuffix}?${sampleListing.attributeCode}=${optionId}`;
};

/**
 * The sample's own price, falling back to the parent's cheapest.
 *
 * Both ends of the range are built from this, so the tile always shows one price rather than the
 * parent's "from 8 to 185". The fallback matters when a sample is in the catalog but its price is
 * not: the cheapest variant of a perfume is the sample, so the low end of the parent's range is
 * the closest thing to the truth, and far closer than the high end.
 */
const priceRangeFrom = (
  variant: SampleVariant,
  cheapest: ProductPrice
): ProductPrice => {
  const final: Money | null = variant.final ?? variant.regular;
  const regular: Money | null = variant.regular ?? variant.final;

  return {
    ...cheapest,
    regular_price: regular ?? cheapest.regular_price,
    final_price: final ?? cheapest.final_price,
    discount: null,
  };
};

/**
 * One role out of a variant's media, in the shape the non-`productView` half of a tile expects.
 *
 * Falls back to the first image rather than to nothing: a sample photographed once carries the
 * `image` role alone, and a tile with no picture is worse than a tile with the wrong-sized one.
 */
const mediaForRole = (
  images: ProductViewMedia[],
  role: ProductViewMedia['roles'][number]
): ProductMedia | null => {
  const media =
    images.find((image) => image.roles?.includes(role)) ?? images[0];

  if (!media) {
    return null;
  }

  return {
    url: media.url,
    label: media.label,
    position: media.position,
    disabled: media.disabled,
  };
};

/**
 * The sample's own photography, or the parent's when the sample has none.
 *
 * A 2 ml sample is photographed as its own object — a vial, not a smaller copy of the bottle — so
 * its media is what the tile should show. Both halves of the tile have to be rewritten together:
 * the carousel reads `productView.images`, while the single image every listing actually renders
 * comes from `product.small_image`.
 */
const sampleMedia = (
  variant: SampleVariant,
  item: Product
): Pick<Product['product'], 'image' | 'small_image' | 'thumbnail'> & {
  images: ProductViewMedia[] | null;
} => {
  if (!variant.images.length) {
    return {
      images: item.productView.images,
      image: item.product.image,
      small_image: item.product.small_image,
      thumbnail: item.product.thumbnail,
    };
  }

  return {
    images: variant.images,
    image: mediaForRole(variant.images, 'image'),
    small_image: mediaForRole(variant.images, 'small_image'),
    thumbnail: mediaForRole(variant.images, 'thumbnail'),
  };
};

/**
 * Redraws one tile from its sample variant, leaving attributes as the parent's.
 */
const applySampleVariant = (
  item: Product,
  variant: SampleVariant | undefined,
  sampleListing: SampleListingConfig,
  baseUrl: string | undefined
): Product => {
  if (!variant) {
    return item;
  }

  const optionId = sampleListing.options.find(
    (option) => option.uid === variant.optionUid
  )?.id;

  const final = variant.final ?? variant.regular;
  const regular = variant.regular ?? variant.final;
  const samplePrice = priceRangeFrom(
    variant,
    item.product.price_range.minimum_price
  );
  const media = sampleMedia(variant, item);

  return {
    ...item,
    product: {
      ...item.product,
      name: variant.name ?? item.product.name,
      image: media.image,
      small_image: media.small_image,
      thumbnail: media.thumbnail,
      canonical_url: sampleProductUrl(
        item.productView?.urlKey ?? null,
        optionId,
        sampleListing,
        baseUrl,
        item.product.canonical_url
      ),
      price_range: {
        minimum_price: samplePrice,
        maximum_price: samplePrice,
      },
    },
    productView: {
      ...item.productView,
      name: variant.name ?? item.productView.name,
      images: media.images,
      inStock: (variant.inStock ?? item.productView.inStock) as any,
      price: {
        final: { adjustments: null, amount: final } as any,
        regular: { adjustments: null, amount: regular } as any,
      },
    },
  } as Product;
};

/**
 * Replaces the page of results with the sample variant of each parent, in place.
 *
 * Does nothing at all unless the category is flagged as the sample listing, and leaves any parent
 * whose variant did not come back exactly as it was, so a gap in the catalog thins the listing
 * rather than breaking it.
 */
const applySampleListing = async (
  data: any,
  storeCtx: StoreDetailsProps
): Promise<void> => {
  const sampleListing = storeCtx.config?.sampleListing;
  const items: Product[] = data?.productSearch?.items ?? [];

  if (!sampleListing?.options?.length || !items.length) {
    return;
  }

  const skus = items
    .map((item) => item.productView?.sku ?? item.product?.sku)
    .filter((sku): sku is string => !!sku);

  try {
    const variants = await getSampleVariants({
      ...storeCtx,
      skus,
      sampleListing,
    });

    data.productSearch.items = items.map((item) =>
      applySampleVariant(
        item,
        variants[item.productView?.sku ?? item.product?.sku],
        sampleListing,
        storeCtx.config?.baseUrl
      )
    );
  } catch (error) {
    // The parents are already on screen; a failed variant lookup must not empty the page.
    // eslint-disable-next-line no-console
    console.error('sample listing: could not resolve variants', error);
  }
};

export { applySampleListing, sampleListingFilter };
