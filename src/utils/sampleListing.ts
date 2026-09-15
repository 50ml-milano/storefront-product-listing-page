/*
50ml customisation — not part of the upstream Adobe widget.
*/

import { getSampleVariants, SampleVariant } from '../api/sampleVariants';
import { StoreDetailsProps } from '../context/store';
import {
  FacetFilter,
  Money,
  Product,
  ProductPrice,
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
 * Redraws one tile from its sample variant, leaving images and attributes as the parent's.
 *
 * Sharing the parent's imagery is deliberate: a sample's own photo is usually the same bottle, and
 * keeping it means the listing sits visually alongside the rest of the catalogue.
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

  return {
    ...item,
    product: {
      ...item.product,
      name: variant.name ?? item.product.name,
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
