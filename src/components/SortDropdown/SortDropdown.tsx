/*
Copyright 2024 Adobe
All Rights Reserved.

NOTICE: Adobe permits you to use, modify, and distribute this file in
accordance with the terms of the Adobe license agreement accompanying
it.
*/

import { FunctionComponent } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

import { useTranslation } from '../../context/translation';
import { useAccessibleDropdown } from '../../hooks/useAccessibleDropdown';
import Chevron from '../../icons/chevron.svg';
import { SortOption } from '../../types/interface';

export interface SortDropdownProps {
  value: string;
  sortOptions: SortOption[];
  onChange: (sortBy: string) => void;
  isMobile: boolean;
  isSortFromUrl?: string;
}

export const SortDropdown: FunctionComponent<SortDropdownProps> = ({
  value,
  sortOptions,
  onChange,
  isMobile,
  isSortFromUrl,
}: SortDropdownProps) => {
  const sortOptionButton = useRef<HTMLButtonElement | null>(null);
  const sortOptionMenu = useRef<HTMLDivElement | null>(null);

  const selectedOption = sortOptions.find((e) => e.value === value);
  const translation = useTranslation();
  const sortOptionTranslation = translation.SortDropdown.option;
  const sortOption = sortOptionTranslation.replace(
    '{selectedOption}',
    `${selectedOption?.label}`
  );
  const Label: string = isSortFromUrl ? (selectedOption ? selectedOption.label.toUpperCase() : translation.SortDropdown.title.toUpperCase())
      : translation.SortDropdown.title.toUpperCase();
  const {
    isDropdownOpen,
    setIsDropdownOpen,
    activeIndex,
    setActiveIndex,
    select,
    setIsFocus,
    listRef,
  } = useAccessibleDropdown({
    options: sortOptions,
    value,
    onChange,
  });

  useEffect(() => {
    const menuRef = sortOptionMenu.current;
    const handleBlur = () => {
      setIsFocus(false);
      setIsDropdownOpen(false);
    };

    const handleFocus = () => {
      if (menuRef?.parentElement?.querySelector(':hover') !== menuRef) {
        setIsFocus(false);
        setIsDropdownOpen(false);
      }
    };

    menuRef?.addEventListener('blur', handleBlur);
    menuRef?.addEventListener('focusin', handleFocus);
    menuRef?.addEventListener('focusout', handleFocus);

    return () => {
      menuRef?.removeEventListener('blur', handleBlur);
      menuRef?.removeEventListener('focusin', handleFocus);
      menuRef?.removeEventListener('focusout', handleFocus);
    };
  }, [sortOptionMenu]);

  return (
    <>
      <div
        ref={sortOptionMenu}
        class={`ds-sdk-sort-dropdown relative inline-block text-left rounded-md z-9 flex-1 w-[calc(50%-1.25rem)] max-w-[175px] 'h-[40px]'`}
      >
        <button
          className={`group flex justify-between items-center font-normal text-[0.9375rem] text-white font-['FuturaBT-Medium'] ${isDropdownOpen ? 'rounded-t-[15px]' : 'rounded-[15px]'} hover:cursor-pointer border-none bg-[#904745] hover:border-none  focus:border-none  active:border-none active:shadow-none h-[40px] w-full px-3 leading-none ${!isMobile ? 'py-[0.45rem] min-w-[158px]' : 'py-[0.25rem]'}`}
          ref={sortOptionButton}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          onFocus={() => setIsFocus(false)}
          onBlur={() => setIsFocus(false)}
        >
          {Label}
          <Chevron
            className={`flex-shrink-0 md:ml-sm h-md w-md stroke-1 stroke-white ${
              isDropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        {isDropdownOpen && (
          <ul
            ref={listRef}
            tabIndex={-1}
            className={`ds-sdk-sort-dropdown__items origin-top-right absolute border-
            hover:cursor-pointer right-0 w-full rounded-b-[15px] shadow-2xl bg-[#904745] ring-1 ring-black ring-opacity-5 focus:outline-none z-20`}
          >
            {sortOptions.map((option, i) => (
              <li
                key={i}
                aria-selected={option.value === selectedOption?.value}
                onMouseOver={() => setActiveIndex(i)}
                className={`py-xs  ${
                  i === activeIndex ? '' : ''
                }`}
              >
                <a
                  className={`ds-sdk-sort-dropdown__items--item block-display px-md text-[0.875rem] font-['FuturaBT-Light'] text-white
                   mb-0 no-underline active:no-underline focus:no-underline hover:no-underline hover:text-gray-900
              ${option.value === selectedOption?.value && isMobile
                  ? 'ds-sdk-sort-dropdown__items--item-selected font-semibold text-[#131313]'
                  : 'font-normal text-[#131313]'}
              ${option.value === selectedOption?.value && !isMobile
                      ? 'ds-sdk-sort-dropdown__items--item-selected font-semibold text-white'
                      : 'font-normal text-[#131313]'}`}
                  onClick={() => select(option.value)}
                >{option.value === selectedOption?.value
                      ? (!isMobile?'':'\u2713 ') +option.label
                      : option.label
                }
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};
