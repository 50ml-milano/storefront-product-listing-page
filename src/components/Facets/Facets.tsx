/*
Copyright 2024 Adobe
All Rights Reserved.

NOTICE: Adobe permits you to use, modify, and distribute this file in
accordance with the terms of the Adobe license agreement accompanying
it.
*/

import { FunctionComponent } from 'preact';

import { useStore } from '../../context';
import { Facet as FacetType, PriceFacet } from '../../types/interface';
import SliderDoubleControl from '../SliderDoubleControl';
import { RangeFacet } from './Range/RangeFacet';
import { ScalarFacet } from './Scalar/ScalarFacet';

interface FacetsProps {
  searchFacets: FacetType[];
}

export const Facets: FunctionComponent<FacetsProps> = ({
  searchFacets,
}: FacetsProps) => {
  const {
    config: { priceSlider },
  } = useStore();
  return (
    <div className="ds-plp-facets flex flex-col pr-[15px]">
      <form className="ds-plp-facets__list">
        {searchFacets?.map((facet) => {
          const bucketType = facet?.buckets[0]?.__typename;
          switch (bucketType) {
            case 'ScalarBucket':
              return <ScalarFacet key={facet.attribute} filterData={facet} />;
            case 'RangeBucket':
              return priceSlider ? (
                <SliderDoubleControl filterData={facet as PriceFacet} />
              ) : (
                <RangeFacet
                  key={facet.attribute}
                  filterData={facet as PriceFacet}
                />
              );
            case 'CategoryView':
              return <ScalarFacet key={facet.attribute} filterData={facet} />;
            default:
              return null;
          }
        })}
      </form>
    </div>
  );
};
