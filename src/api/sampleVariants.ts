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
 * One request for the whole page, using a GraphQL alias per parent.
 *
 * Catalog Service has no "give me the variants of these products" field — `variants` takes a single
 * sku. Aliasing keeps that to one round trip instead of one per tile, which is the difference
 * between a listing that renders and one that does not.
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

/**
 * The sample variant of every parent on the page, keyed by the parent's sku.
 *
 * Parents with no matching variant are simply absent from the map — the caller leaves those tiles
 * showing the parent, which is a worse tile but still a working one.
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
  Record<string, SampleVariant>
> => {
  const optionUids = sampleListing.options.map((option) => option.uid);

  if (!skus.length || !optionUids.length) {
    return {};
  }

  const { query, variables } = buildSampleVariantsQuery(skus, optionUids);

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

  const results = await response.json();

  const variants: Record<string, SampleVariant> = {};
  skus.forEach((sku, index) => {
    const variant = pickVariant(results?.data?.[`v${index}`], optionUids);
    if (variant) {
      variants[sku] = variant;
    }
  });

  return variants;
};

export { getSampleVariants };
