/*
Copyright 2024 Adobe
All Rights Reserved.

NOTICE: Adobe permits you to use, modify, and distribute this file in
accordance with the terms of the Adobe license agreement accompanying
it.
*/

import { ProductSearchSortInput } from 'src/types/interface';

export const DEFAULT_PAGE_SIZE = 24;
export const DEFAULT_PAGE_SIZE_OPTIONS = '12,24,36';
export const DEFAULT_MIN_QUERY_LENGTH = 3;
export const PRODUCT_COLUMNS = {
  desktop: 5,
  desktopSmall: 4,
  tablet: 3,
  mobile: 2,
};

export const SEARCH_SORT_DEFAULT: ProductSearchSortInput[] = [
  { attribute: 'relevance', direction: 'DESC' },

];
export const CATEGORY_SORT_DEFAULT: ProductSearchSortInput[] = [
  { attribute: 'position', direction: 'ASC' },
];

export const SEARCH_UNIT_ID = 'livesearch-plp';
export const BOOLEAN_YES = 'yes';
export const BOOLEAN_NO = 'no';
