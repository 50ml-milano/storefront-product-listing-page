/*
50ml customisation — not part of the upstream Adobe widget.
*/

import { getSampleVariants, SampleVariant } from '../api/sampleVariants';
import { StoreDetailsProps } from '../context/store';
import {
  Facet,
  FacetFilter,
  Money,
  Product,
  ProductMedia,
  ProductPrice,
  ProductViewMedia,
  SampleListingConfig,
  StoreDetailsConfig,
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
 *
 * The size goes in the fragment (`#1329=34452`), which the product page reads just as it reads
 * `?capacity=34452`. Crawlers drop a fragment, so the links count for the parent's canonical url
 * and add no parameter urls to crawl. Without the attribute id it links to the plain parent page.
 */
const sampleProductUrl = (
  urlKey: string | null,
  optionId: number | undefined,
  sampleListing: SampleListingConfig,
  baseUrl: string | undefined,
  fallback: string | null
): string | null => {
  if (!urlKey || !baseUrl) {
    return fallback;
  }

  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const page = `${base}${urlKey}${sampleListing.urlSuffix}`;

  if (!optionId || !sampleListing.attributeId) {
    return page;
  }

  return `${page}#${sampleListing.attributeId}=${optionId}`;
};

/**
 * The sample's own price, as both ends of the range.
 *
 * Both ends are built from it, so the tile always shows one price rather than the parent's "from 8
 * to 185". Only called for a sample that has a price: one without is dropped from the listing,
 * since the parent's price on a 2 ml tile (170 € for `MTP-0-1373`) is worse than no tile.
 */
const priceRangeFrom = (
  final: Money,
  regular: Money,
  cheapest: ProductPrice
): ProductPrice => ({
  ...cheapest,
  regular_price: regular,
  final_price: final,
  discount: null,
});

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
 * The tile's name: the parent's name followed by the sample size, e.g. "Amsterdam Red Eau de
 * Parfum 2 ml".
 *
 * Never the sample's own product name. Since May 2026 new samples are named after the tester
 * bottle they are decanted from ("… TESTER 75 ml"), as in the ERP, on the understanding that
 * customers never see a variant's name; samples created before are named "… 2 ml". The listing is
 * the one page that shows samples as products, so it builds the name itself and old and new
 * samples read the same. Without a size label it shows the parent's name alone.
 */
const sampleName = (
  parentName: string | null | undefined,
  sizeLabel: string | undefined
): string | null | undefined =>
  parentName && sizeLabel ? `${parentName} ${sizeLabel}` : parentName;

/**
 * Redraws one tile from its sample variant, leaving attributes as the parent's.
 *
 * Drops the tile when there is no priced sample to draw it from: `undefined` (the lookup for this
 * parent failed), `null` (the parent has no sample) or a sample without a price. A sample listing
 * showing a full-size bottle at the bottle's price is wrong, while a missing tile is merely absent.
 */
const applySampleVariant = (
  item: Product,
  variant: SampleVariant | null | undefined,
  sampleListing: SampleListingConfig,
  baseUrl: string | undefined
): Product | null => {
  const final = variant?.final ?? variant?.regular;
  const regular = variant?.regular ?? variant?.final;

  if (!variant || !final || !regular) {
    return null;
  }

  const option = sampleListing.options.find(
    (candidate) => candidate.uid === variant.optionUid
  );

  const samplePrice = priceRangeFrom(
    final,
    regular,
    item.product.price_range.minimum_price
  );
  const media = sampleMedia(variant, item);

  return {
    ...item,
    product: {
      ...item.product,
      name: sampleName(item.product.name, option?.label),
      image: media.image,
      small_image: media.small_image,
      thumbnail: media.thumbnail,
      canonical_url: sampleProductUrl(
        item.productView?.urlKey ?? null,
        option?.id,
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
      name: sampleName(item.productView.name, option?.label),
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
 * Replaces the page of results with the sample variant of each parent, in place, and drops the
 * capacity filter.
 *
 * Does nothing at all unless the category is flagged as the sample listing. A parent with no
 * priced sample, or whose lookup failed, is removed, so a gap in the catalog or an outage thins
 * the listing rather than putting a bottle on it at the bottle's price.
 * `total_count` is left as Live Search gave it: the removed parents are a handful (about 15 of
 * ~3 500 on it_it), so a page may show a tile or two fewer than its size.
 */
const applySampleListing = async (
  data: any,
  storeCtx: StoreDetailsProps
): Promise<void> => {
  const sampleListing = storeCtx.config?.sampleListing;
  const items: Product[] = data?.productSearch?.items ?? [];

  if (!sampleListing?.options?.length) {
    return;
  }

  // Every sample is the same size, so a capacity filter has only the parents' bottle sizes to
  // offer, and picking one would narrow the samples by a bottle the customer is not buying.
  if (data?.productSearch?.facets) {
    data.productSearch.facets = data.productSearch.facets.filter(
      (facet: Facet) => facet.attribute !== sampleListing.attributeCode
    );
  }

  if (!items.length) {
    return;
  }

  const skus = items
    .map((item) => item.productView?.sku ?? item.product?.sku)
    .filter((sku): sku is string => !!sku);

  // Never rejects: a failed request leaves its parents out of the result, and they are dropped.
  const variants = await getSampleVariants({
    ...storeCtx,
    skus,
    sampleListing,
  });

  data.productSearch.items = items
    .map((item) => {
      try {
        return applySampleVariant(
          item,
          variants[item.productView?.sku ?? item.product?.sku],
          sampleListing,
          storeCtx.config?.baseUrl
        );
      } catch (error) {
        // A malformed tile is dropped on its own rather than failing the whole page.
        // eslint-disable-next-line no-console
        console.error('sample listing: could not redraw a tile', error);
        return null;
      }
    })
    .filter((item): item is Product => item !== null);
};

/**
 * The category the sort control works in, or none on the sample listing.
 *
 * The sample listing is a category page, but its query is a search by capacity and sorts by
 * relevance: `position` is a product's place inside a category, which samples have none of. With
 * no category the control offers relevance and selects it, matching the order on the page, and
 * the query gets no `position` default.
 */
const categoryPathForSort = (
  config: StoreDetailsConfig | undefined
): string | undefined =>
  config?.sampleListing ? undefined : config?.currentCategoryUrlPath;

export { applySampleListing, sampleListingFilter, categoryPathForSort };
