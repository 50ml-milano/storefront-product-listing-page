/*
Copyright 2024 Adobe
All Rights Reserved.

NOTICE: Adobe permits you to use, modify, and distribute this file in
accordance with the terms of the Adobe license agreement accompanying
it.
*/

import { FunctionalComponent, FunctionComponent } from 'preact';
import { useEffect} from 'preact/hooks';
import { ProductCardShimmer } from 'src/components/ProductCardShimmer';
import { useProducts, useSensor, useTranslation } from 'src/context';
import { PageSizeOption } from 'src/types/interface';
import {
  handleUrlPageSize,
  handleUrlPagination,
} from 'src/utils/handleUrlFilters';

import { Alert } from '../components/Alert';
import { Pagination } from '../components/Pagination';
import { PerPagePicker, PerPagePickerProps } from '../components/PerPagePicker';
import { ProductList } from '../components/ProductList';

interface Props {
  showFilters: boolean;
}

export const ProductsContainer: FunctionComponent<Props> = ({
  showFilters,
}) => {
  const productsCtx = useProducts();
  const { screenSize } = useSensor();

  const {
    variables,
    items,
    setCurrentPage,
    currentPage,
    setPageSize,
    pageSize,
    totalPages,
    totalCount,
    minQueryLength,
    minQueryLengthReached,
    pageSizeOptions,
    loading,
    prevItems,
  } = productsCtx;

  useEffect(() => {
    if (currentPage < 1) {
      goToPage(1);
    }
  }, []);

  const productCardArray = Array.from({ length: 8 });
  const goToPage = (page: number | string) => {
    if (typeof page === 'number') {
      setCurrentPage(page);
      handleUrlPagination(page);
    }
  };

  const onPageSizeChange = (pageSizeOption: number) => {
    setPageSize(pageSizeOption);
    handleUrlPageSize(pageSizeOption);
  };
  const translation = useTranslation();

  const getPageSizeTranslation = (
    pageSize: number,
    pageSizeOptions: PageSizeOption[],
    PerPagePicker: FunctionalComponent<PerPagePickerProps>
  ) => {
    const pageSizeTranslation = translation.ProductContainers.pagePicker;
    const pageSizeTranslationOrder = pageSizeTranslation.split(' ');
    return pageSizeTranslationOrder.map((word: string, index: any) =>
      word === '{pageSize}' ? (
        <PerPagePicker
          pageSizeOptions={pageSizeOptions}
          value={pageSize}
          onChange={onPageSizeChange}
          key={index}
        />
      ) : (
        `${word} `
      )
    );
  };

  if (!minQueryLengthReached) {
    const templateMinQueryText = translation.ProductContainers.minquery;
    const title = templateMinQueryText
      .replace('{variables.phrase}', variables.phrase)
      .replace('{minQueryLength}', minQueryLength);
    return (
      <div className="ds-sdk-min-query__page mx-auto max-w-8xl py-12 px-4 sm:px-6 lg:px-8">
        <Alert title={title} type="warning" description="" />
      </div>
    );
  }

  if (!totalCount) {
    return (
      <div className="ds-sdk-no-results__page mx-auto max-w-8xl py-12 px-4 sm:px-6 lg:px-8">
        <Alert
          title={translation.ProductContainers.noresults}
          type="warning"
          description=""
        />
      </div>
    );
  }

  return (
      <>
        <div
            className={`flex flex-row justify-between max-w-full ${
                showFilters ? 'mx-auto' : 'mr-auto'
            } w-full h-full`}
        >
          {totalPages > 1 && (
              <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                  isOnTop={true}
              />
          )}
        </div>
        <div className={`key-${currentPage} ${showFilters ? 'filters-opened' : ''} w-full`}>
          <ProductList
              products={items}
              numberOfColumns={screenSize.columns}
              showFilters={showFilters}
              prevProducts={prevItems}
          />
        </div>
        <div
            className={`flex flex-row justify-between max-w-full ${
                showFilters ? 'mx-auto' : 'mr-auto'
            } w-full h-full`}
        >
          {totalPages > 1 && (
              <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                  isOnTop={false}
              />
          )}
        </div>
      </>
  );
};
