/*
Copyright 2024 Adobe
All Rights Reserved.

NOTICE: Adobe permits you to use, modify, and distribute this file in
accordance with the terms of the Adobe license agreement accompanying
it.
*/

import { FunctionComponent } from 'preact';
import { useState } from 'preact/hooks';

import '../ProductItem/ProductItem.css';

import {useCart, useProducts, useStore, useTranslation} from '../../context';
import NoImage from '../../icons/NoImage.svg';
import {
  Product,
  ProductViewMedia,
  RedirectRouteFunc,
  RefinedProduct,
} from '../../types/interface';
import { SEARCH_UNIT_ID } from '../../utils/constants';
import {
  generateOptimizedImages,
  getProductImageURLs,
} from '../../utils/getProductImage';
import { htmlStringDecode } from '../../utils/htmlStringDecode';
import { GoButton } from '../GoButton';
import { ImageCarousel } from '../ImageCarousel';
import { SwatchButtonGroup } from '../SwatchButtonGroup';
import ProductPrice from './ProductPriceRange';

export interface ProductProps {
  item: Product;
  currencySymbol: string;
  currencyRate?: string;
  setRoute?: RedirectRouteFunc | undefined;
  refineProduct: (optionIds: string[], sku: string) => any;
  setCartUpdated: (cartUpdated: boolean) => void;
  setItemAdded: (itemAdded: string) => void;
  setError: (error: boolean) => void;
  addToCart?: (
    sku: string,
    options: [],
    quantity: number
  ) => Promise<void | undefined>;
}

export const ProductItem: FunctionComponent<ProductProps> = ({
  item,
  currencySymbol,
  currencyRate,
  setRoute,
  refineProduct,
  setError,
}: ProductProps) => {
  const translation = useTranslation();
  const { product, productView } = item;
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [selectedSwatch, setSelectedSwatch] = useState('');
  const [imagesFromRefinedProduct, setImagesFromRefinedProduct] = useState<
    ProductViewMedia[] | null
  >();
  const [refinedProduct, setRefinedProduct] = useState<RefinedProduct>();
  const [isHovering, setIsHovering] = useState(false);
  const { addToCartGraphQL, refreshCart } = useCart();
  const { viewType } = useProducts();
  const {
    config: { optimizeImages, imageBaseWidth, imageCarousel, listview },
  } = useStore();
  const [isFocused, setIsFocused] = useState(false);
  const { storeCode } = useStore();

  const handleMouseOver = () => {
      if (!window.matchMedia('(hover: none)').matches) {
          setIsHovering(true);
      }
  };

  const handleMouseOut = () => {
      if (!window.matchMedia('(hover: none)').matches) {
          setIsHovering(true);
      }
  };

  const handleSelection = async (optionIds: string[], sku: string) => {
    const data = await refineProduct(optionIds, sku);
    setSelectedSwatch(optionIds[0]);
    setImagesFromRefinedProduct(data.refineProduct.images);
    setRefinedProduct(data);
    setCarouselIndex(0);
  };

  const isSelected = (id: string) => {
    const selected = selectedSwatch ? selectedSwatch === id : false;
    return selected;
  };

  const productImageArray = imagesFromRefinedProduct
    ? getProductImageURLs(imagesFromRefinedProduct ?? [], imageCarousel ? 3 : 1)
    : getProductImageURLs(
        productView.images ?? [],
        imageCarousel ? 3 : 1, // number of images to display in carousel
        product.small_image?.url ?? undefined
      );
  let optimizedImageArray: { src: string; srcset: any }[] = [];

  if (optimizeImages) {
    optimizedImageArray = generateOptimizedImages(
      productImageArray,
      imageBaseWidth ?? 278,
      storeCode
    );
  }

  // will have to figure out discount logic for amount_off and percent_off still
  const discount: boolean = refinedProduct
    ? refinedProduct.refineProduct?.priceRange?.minimum?.regular?.amount
        ?.value >
      refinedProduct.refineProduct?.priceRange?.minimum?.final?.amount?.value
    : product?.price_range?.minimum_price?.regular_price?.value >
        product?.price_range?.minimum_price?.final_price?.value ||
      productView?.price?.regular?.amount?.value >
        productView?.price?.final?.amount?.value;
  const isSimple = product?.__typename === 'SimpleProduct';
  const isComplexProductView = productView?.__typename === 'ComplexProductView';
  const isBundle = product?.__typename === 'BundleProduct';
  const isGrouped = product?.__typename === 'GroupedProduct';
  const isGiftCard = product?.__typename === 'GiftCardProduct';
  const isConfigurable = product?.__typename === 'ConfigurableProduct';

  const onProductClick = () => {
    window.magentoStorefrontEvents?.publish.searchProductClick(
      SEARCH_UNIT_ID,
      product?.sku
    );
  };

  const productUrl = setRoute
    ? setRoute({ sku: productView?.sku, urlKey: productView?.urlKey })
    : product?.canonical_url;

  const handleGoProduct = async () => {
    setError(false);
    if (productUrl) {
      window.open(productUrl, '_self');
    }
  };
  const getProductAttribute = (name: string) => {
    if (!item || !item.productView || !item.productView.attributes) {
      console.log(`No attributes found for product. Item: ${item.product.sku}`);
      return '';
    }

    const attribute = item.productView.attributes.find(attribute => {
      return attribute?.name === name;
    });

    return attribute ? attribute.value : '';
  };
  if (listview && viewType === 'listview') {
    return (
      <>
        <div className="grid-container">
          <div
            className={`product-image ds-sdk-product-item__image relative rounded-md overflow-hidden}`}
          >
            <a
              href={productUrl as string}
              onClick={onProductClick}
              className="!text-primary hover:no-underline hover:text-primary"
            >
              {/* Image */}
              {productImageArray.length ? (
                <ImageCarousel
                  images={
                    optimizedImageArray.length
                      ? optimizedImageArray
                      : productImageArray
                  }
                  productName={product.name}
                  carouselIndex={carouselIndex}
                  setCarouselIndex={setCarouselIndex}
                />
              ) : (
                <NoImage
                  className={`max-h-[250px] max-w-[200px] pr-5 m-auto object-cover object-center lg:w-full`}
                />
              )}
            </a>
          </div>
          <div className="product-details">
            <div className="flex flex-col w-1/3">
              {/* Product name */}
              <a
                href={productUrl as string}
                onClick={onProductClick}
                className="!text-primary hover:no-underline hover:text-primary"
              >
                <div className="ds-sdk-product-item__product-name mt-xs text-[0.875rem] text-primary">
                  {product.name !== null && htmlStringDecode(product.name)}
                </div>
                <div className="ds-sdk-product-item__product-sku mt-xs text-[0.875rem] text-primary">
                  SKU:
                  {product.sku !== null && htmlStringDecode(product.sku)}
                </div>
              </a>
            </div>
          </div>
          <div className="product-price">
            <a
              href={productUrl as string}
              onClick={onProductClick}
              className="!text-primary hover:no-underline hover:text-primary"
            >
              <ProductPrice
                item={refinedProduct ?? item}
                isBundle={isBundle}
                isGrouped={isGrouped}
                isGiftCard={isGiftCard}
                isConfigurable={isConfigurable}
                isComplexProductView={isComplexProductView}
                discount={discount}
                currencySymbol={currencySymbol}
                currencyRate={currencyRate}
              />
            </a>
          </div>
          <div className="product-description text-[0.875rem] text-primary mt-xs">
            <a
              href={productUrl as string}
              onClick={onProductClick}
              className="!text-primary hover:no-underline hover:text-primary"
            >
              {product.short_description?.html ? (
                <>
                  <span
                    dangerouslySetInnerHTML={{
                      __html: product.short_description.html,
                    }}
                  />
                </>
              ) : (
                <span />
              )}
            </a>
          </div>

          {/* TO BE ADDED LATER */}
          <div className="product-ratings" />
          <div className="product-add-to-cart">
            <div className="pb-4 h-[38px] w-96">
              <GoButton onClick={handleGoProduct} />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
      <div
          className={`ds-sdk-product-item group relative flex flex-col max-w-sm justify-between border-[1px] border-transparent h-full hover:border-black p-2 ${isFocused ? '!border-black' : ''}`}
          onMouseEnter={handleMouseOver}
          onMouseLeave={handleMouseOut}
      >
        <div class="pb-[3.1rem]">
          {!productView.inStock && (
              <div
                  className="ds-sdk-product-item__product-out-of-stock absolute top-0 left-0 w-full h-full block z-10 bg-[rgba(251,_247,_244,_0.6)]">
                <a
                    href={productUrl as string}
                    onClick={onProductClick}
                    className="!text-primary"
                    tabIndex={-1}
                >
                  <div className="table w-full h-full">
                    <span
                        className="table-cell align-middle text-center text-[25px] font-bold text-[#000] leading-none font-['PlayfairDisplay-Bold']">{translation.ProductItem.outOfStock}</span>
                  </div>
                </a>
              </div>)}
          <a
              href={productUrl as string}
              onClick={onProductClick}
              className="!text-primary"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
          >
            <div className="ds-sdk-product-item__main relative flex flex-col justify-between h-full border-b-[0]">
              <div className="ds-sdk-product-item__image relative w-full h-auto rounded-md overflow-hidden aspect-[278/371] md:aspect-[395/527]">
                {productImageArray.length ? (
                    <ImageCarousel
                        images={
                          optimizedImageArray.length
                              ? optimizedImageArray
                              : productImageArray
                        }
                        productName={product.name}
                        carouselIndex={carouselIndex}
                        setCarouselIndex={setCarouselIndex}
                    />
                ) : (
                    <NoImage
                        className={`max-h-[45rem] w-full object-cover object-center lg:w-full`}
                    />
                )}
              </div>
              <div className="flex flex-row justify-center flex-1">
                <div className="flex flex-col">
                  <div class="ds-sdk-product-item__product-manufacturer uppercase text-black font-['FuturaBT-Light']">{getProductAttribute('manufacturer')}</div>
                  <div className="ds-sdk-product-item__product-name text-black capitalize font-['PlayfairDisplay-Bold'] text-center hover:text-[#666666]">
                    {product.name !== null && htmlStringDecode(product.name)}
                  </div>
                  <div className="ds-sdk-product-item__product-profumo block text-center text-black font-['FuturaBT-Light'] mt-auto">{getProductAttribute('profumo_per')}</div>
                  <ProductPrice
                      item={refinedProduct ?? item}
                      isBundle={isBundle}
                      isGrouped={isGrouped}
                      isGiftCard={isGiftCard}
                      isConfigurable={isConfigurable}
                      isComplexProductView={isComplexProductView}
                      discount={discount}
                      currencySymbol={currencySymbol}
                      currencyRate={currencyRate}
                  />
                </div>

                {/*
            //TODO: Wishlist button to be added later
            {flags.addToWishlist && widgetConfig.addToWishlist.enabled && (
              // TODO: Remove flag during phase 3 MSRCH-4278
              <div className="ds-sdk-wishlist ml-auto mt-[1.25rem]">
                <WishlistButton
                  productSku={item.product.sku}
                  type={widgetConfig.addToWishlist.placement}
                />
              </div>
            )} */}
              </div>
            </div>
          </a>
          {productView.inStock && (<div>
            {(isHovering || isFocused) && (<GoButton onClick={handleGoProduct}/>)}
          </div>)}
        </div>
      </div>
  );
};

export default ProductItem;
