/*
50ml customisation — not part of the upstream Adobe widget.
*/

import { v4 as uuidv4 } from 'uuid';

import {
  ClientProps,
  Money,
  ProductViewMedia,
  QueryContextInput,
  SampleListingConfig,
} from '../types/interface';

export interface SampleVariant {
  sku: string;
  name: string | null;
  inStock: boolean | null;
  final: Money | null;
  regular: Money | null;
  images: ProductViewMedia[];
  optionUid: string;
}

interface SampleVariantsQuery {
  skus: string[];
  sampleListing: SampleListingConfig;
  context?: QueryContextInput;
}

const VARIANT_FIELDS = `
    variants {
        selections
        product {
            sku
            name
            inStock
            images {
                label
                url
                roles
            }
            ... on SimpleProductView {
                price {
                    final { amount { value currency } }
                    regular { amount { value currency } }
                }
            }
        }
    }
`;

/**
 * The most parents one request asks for.
 *
 * Catalog Service rejects a query past its token limit with a 400 «token limit reached»: on the live
 * it_it store 130 aliased `variants` fields pass and 135 fail. 100 leaves room for a longer sku or
 * an extra field, and keeps the largest page size (180) to two requests.
 */
const BATCH_SIZE = 100;

/**
 * One request for a batch of parents, using a GraphQL alias per parent.
 *
 * Catalog Service has no "give me the variants of these products" field — `variants` takes a single
 * sku. Aliasing keeps that to one round trip per batch instead of one per tile, which is the
 * difference between a listing that renders and one that does not.
 */
const buildSampleVariantsQuery = (
  skus: string[],
  optionUids: string[]
): { query: string; variables: Record<string, string> } => {
  // Only an unambiguous single size can be pushed down to the server; anything else is matched
  // against `selections` once the variants come back.
  const optionFilter =
    optionUids.length === 1
      ? `, optionIds: [${JSON.stringify(optionUids[0])}]`
      : '';

  const declarations = skus.map((_, index) => `$s${index}: String!`).join(', ');
  const fields = skus
    .map(
      (_, index) =>
        `v${index}: variants(sku: $s${index}${optionFilter}) {${VARIANT_FIELDS}}`
    )
    .join('\n');

  const variables: Record<string, string> = {};
  skus.forEach((sku, index) => {
    variables[`s${index}`] = sku;
  });

  return {
    query: `query sampleVariants(${declarations}) {\n${fields}\n}`,
    variables,
  };
};

const pickVariant = (
  result: any,
  optionUids: string[]
): SampleVariant | null => {
  const variants = result?.variants ?? [];

  let matchedUid = '';
  const match = variants.find((variant: any) => {
    matchedUid =
      (variant?.selections ?? []).find((selection: string) =>
        optionUids.includes(selection)
      ) ?? '';
    return matchedUid !== '';
  });

  if (!match?.product?.sku) {
    return null;
  }

  return {
    optionUid: matchedUid,
    sku: match.product.sku,
    name: match.product.name ?? null,
    inStock: match.product.inStock ?? null,
    images: match.product.images ?? [],
    final: match.product.price?.final?.amount ?? null,
    regular: match.product.price?.regular?.amount ?? null,
  };
};

const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size)
  );

/**
 * The sample variant of every parent on the page, keyed by the parent's sku.
 *
 * Three outcomes per parent, and the caller treats them differently:
 * - a `SampleVariant`: the parent has a sample;
 * - `null`: Catalog Service answered for the parent and it has no sample;
 * - absent: its batch failed, so nothing is known about it.
 */
const getSampleVariants = async ({
  environmentId,
  websiteCode,
  storeCode,
  storeViewCode,
  apiKey,
  apiUrl,
  context,
  skus,
  sampleListing,
}: SampleVariantsQuery & ClientProps): Promise<
  Record<string, SampleVariant | null>
> => {
  const optionUids = sampleListing.options.map((option) => option.uid);

  if (!skus.length || !optionUids.length) {
    return {};
  }

  const fetchBatch = async (
    batch: string[]
  ): Promise<Record<string, SampleVariant | null>> => {
    const { query, variables } = buildSampleVariantsQuery(batch, optionUids);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Magento-Environment-Id': environmentId,
        'Magento-Website-Code': websiteCode,
        'Magento-Store-Code': storeCode,
        'Magento-Store-View-Code': storeViewCode,
        'X-Api-Key': apiKey,
        'X-Request-Id': uuidv4(),
        'Content-Type': 'application/json',
        'Magento-Customer-Group': context?.customerGroup ?? '',
      },
      body: JSON.stringify({ query, variables }),
    });

    const results = await response.json().catch(() => null);

    if (!response.ok || !results?.data) {
      throw new Error(
        `variants request failed (${response.status}): ${JSON.stringify(
          results?.errors ?? null
        )}`
      );
    }

    const variants: Record<string, SampleVariant | null> = {};
    batch.forEach((sku, index) => {
      const result = results.data[`v${index}`];
      // A field that errored on its own comes back as null: unknown, not "no sample".
      if (result) {
        variants[sku] = pickVariant(result, optionUids);
      }
    });

    return variants;
  };

  const batches = await Promise.allSettled(
    chunk(skus, BATCH_SIZE).map(fetchBatch)
  );

  return batches.reduce<Record<string, SampleVariant | null>>((all, batch) => {
    if (batch.status === 'fulfilled') {
      return { ...all, ...batch.value };
    }
    // The parents of this batch get no sample, so their tiles are dropped; the rest still get theirs.
    // eslint-disable-next-line no-console
    console.error('sample listing: could not resolve variants', batch.reason);
    return all;
  }, {});
};

export { getSampleVariants };
