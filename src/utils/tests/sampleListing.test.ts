/*
50ml customisation — not part of the upstream Adobe widget.
*/

import { applySampleListing } from '../sampleListing';

const SAMPLE_UID = 'Y29uZmlndXJhYmxlLzEzMjkvMzQ0NTI=';
const FULL_SIZE_UID = 'Y29uZmlndXJhYmxlLzEzMjkvMTIzNDU=';

const storeCtx: any = {
  environmentId: 'env',
  websiteCode: 'base',
  storeCode: 'main',
  storeViewCode: 'it_it',
  apiKey: 'key',
  apiUrl: 'https://catalog.example/graphql',
  config: {
    baseUrl: 'https://50-ml.it/',
    sampleListing: {
      attributeCode: 'capacity',
      attributeId: 1329,
      urlSuffix: '',
      options: [{ id: 34452, label: '2 ml', uid: SAMPLE_UID }],
    },
  },
};

const parent = (sku: string): any => ({
  product: {
    sku,
    name: `${sku} 100 ml`,
    canonical_url: `https://50-ml.it/${sku.toLowerCase()}`,
    image: null,
    small_image: { url: `${sku}-bottle.jpg` },
    thumbnail: null,
    price_range: {
      minimum_price: {
        final_price: { value: 170, currency: 'EUR' },
        regular_price: { value: 170, currency: 'EUR' },
      },
      maximum_price: {
        final_price: { value: 240, currency: 'EUR' },
        regular_price: { value: 240, currency: 'EUR' },
      },
    },
  },
  productView: {
    sku,
    urlKey: sku.toLowerCase(),
    name: `${sku} 100 ml`,
    images: [],
    inStock: true,
  },
});

const sampleOf = (sku: string, price: number | null = 8): any => ({
  variants: [
    {
      selections: [SAMPLE_UID],
      product: {
        sku: `${sku}-2`,
        name: `${sku} 2 ml`,
        inStock: true,
        images: [{ url: `${sku}-vial.jpg`, label: '', roles: ['small_image'] }],
        price:
          price === null
            ? { final: { amount: null }, regular: { amount: null } }
            : {
                final: { amount: { value: price, currency: 'EUR' } },
                regular: { amount: { value: price, currency: 'EUR' } },
              },
      },
    },
  ],
});

const pageOf = (skus: string[]): any => ({
  productSearch: { total_count: skus.length, items: skus.map(parent) },
});

const skusOf = (n: number) =>
  Array.from({ length: n }, (_, i) => `P${String(i).padStart(3, '0')}`);

type Answer = (variables: Record<string, string>) => any;

/** Answers each request from the skus it was asked for; `answer` returns the whole response. */
const mockCatalog = (answer: Answer) => {
  const fetchMock = jest.fn(async (_url: string, init: any) => {
    const { variables } = JSON.parse(init.body);
    const result = answer(variables);
    return {
      ok: result.status === undefined,
      status: result.status ?? 200,
      json: async () => result.body,
    };
  });
  (global as any).fetch = fetchMock;
  return fetchMock;
};

/** Every sku gets a 2 ml sample, unless `special` says otherwise. */
const sampleFor =
  (special: Record<string, any> = {}): Answer =>
  (variables) => {
    const data: Record<string, any> = {};
    Object.entries(variables).forEach(([name, sku]) => {
      data[name.replace(/^s/, 'v')] =
        sku in special ? special[sku] : sampleOf(sku);
    });
    return { body: { data } };
  };

const aliasesIn = (init: any) =>
  (JSON.parse(init.body).query.match(/variants\(/g) ?? []).length;

describe('applySampleListing', () => {
  afterEach(() => {
    delete (global as any).fetch;
  });

  it('splits a page into requests of at most 100 parents and draws every tile from its sample', async () => {
    const fetchMock = mockCatalog(sampleFor());
    const data = pageOf(skusOf(180));

    await applySampleListing(data, storeCtx);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mock.calls.forEach(([, init]) =>
      expect(aliasesIn(init)).toBeLessThanOrEqual(100)
    );
    expect(data.productSearch.items).toHaveLength(180);
    data.productSearch.items.forEach((item: any) => {
      expect(item.product.small_image.url).toMatch(/-vial\.jpg$/);
      expect(item.product.price_range.minimum_price.final_price.value).toBe(8);
    });
  });

  it('keeps the order of the page across batches', async () => {
    mockCatalog(sampleFor());
    const skus = skusOf(150);
    const data = pageOf(skus);

    await applySampleListing(data, storeCtx);

    expect(data.productSearch.items.map((i: any) => i.productView.sku)).toEqual(
      skus
    );
  });

  it('drops a parent whose variants have no 2 ml sample', async () => {
    mockCatalog(
      sampleFor({
        P001: {
          variants: [
            { selections: [FULL_SIZE_UID], product: { sku: 'P001-100' } },
          ],
        },
        P002: { variants: [] },
      })
    );
    const data = pageOf(skusOf(4));

    await applySampleListing(data, storeCtx);

    expect(data.productSearch.items.map((i: any) => i.productView.sku)).toEqual(
      ['P000', 'P003']
    );
  });

  it("drops a sample with no price of its own instead of showing the parent's", async () => {
    mockCatalog(sampleFor({ P001: sampleOf('P001', null) }));
    const data = pageOf(skusOf(3));

    await applySampleListing(data, storeCtx);

    expect(data.productSearch.items.map((i: any) => i.productView.sku)).toEqual(
      ['P000', 'P002']
    );
  });

  it('drops the parents of a failed request instead of showing their bottles, and still applies the other batch', async () => {
    const skus = skusOf(150);
    mockCatalog((variables) =>
      Object.values(variables).includes('P000')
        ? {
            status: 400,
            body: { errors: [{ message: 'token limit reached' }] },
          }
        : sampleFor()(variables)
    );
    const data = pageOf(skus);
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    await applySampleListing(data, storeCtx);

    const items = data.productSearch.items;
    // P000–P099 rode the failed request: none of them may stay as a bottle at the bottle's price.
    expect(items.map((i: any) => i.productView.sku)).toEqual(skus.slice(100));
    items.forEach((item: any) =>
      expect(item.product.small_image.url).toMatch(/-vial\.jpg$/)
    );
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('drops a parent whose own lookup errored while the rest of its request answered', async () => {
    mockCatalog((variables) => {
      const answered = sampleFor()(variables);
      // GraphQL nulls an alias that failed on its own and reports it under `errors`.
      answered.body.data.v1 = null;
      answered.body.errors = [{ message: 'internal error', path: ['v1'] }];
      return answered;
    });
    const data = pageOf(skusOf(3));

    await applySampleListing(data, storeCtx);

    expect(data.productSearch.items.map((i: any) => i.productView.sku)).toEqual(
      ['P000', 'P002']
    );
  });

  it('drops a tile that cannot be redrawn and keeps the others', async () => {
    mockCatalog(sampleFor());
    const data = pageOf(skusOf(3));
    // A tile Live Search sent without its `product` half cannot be redrawn.
    delete data.productSearch.items[1].product;
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    await applySampleListing(data, storeCtx);

    expect(data.productSearch.items.map((i: any) => i.productView.sku)).toEqual(
      ['P000', 'P002']
    );
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('links the tile to the parent page with the sample selected', async () => {
    mockCatalog(sampleFor());
    const data = pageOf(['P000']);

    await applySampleListing(data, storeCtx);

    expect(data.productSearch.items[0].product.canonical_url).toBe(
      'https://50-ml.it/p000#1329=34452'
    );
  });

  it("links to the plain parent page on the store's own host when the attribute id is missing", async () => {
    mockCatalog(sampleFor());
    const data = pageOf(['P000']);
    // The indexed url carries the host the catalog was exported from, not this store's.
    data.productSearch.items[0].product.canonical_url =
      'https://www.50-ml.com/p000';
    const { attributeId, ...withoutId } = storeCtx.config.sampleListing;

    await applySampleListing(data, {
      ...storeCtx,
      config: { ...storeCtx.config, sampleListing: withoutId },
    });

    expect(attributeId).toBe(1329);
    expect(data.productSearch.items[0].product.canonical_url).toBe(
      'https://50-ml.it/p000'
    );
  });

  it('does nothing on an ordinary category', async () => {
    const fetchMock = mockCatalog(sampleFor());
    const data = pageOf(skusOf(3));

    await applySampleListing(data, {
      ...storeCtx,
      config: { baseUrl: 'https://50-ml.it/' },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(data.productSearch.items[0].product.small_image.url).toBe(
      'P000-bottle.jpg'
    );
  });
});
