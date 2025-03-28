/*
Copyright 2024 Adobe
All Rights Reserved.

NOTICE: Adobe permits you to use, modify, and distribute this file in
accordance with the terms of the Adobe license agreement accompanying
it.
*/

import { FunctionComponent } from 'preact';
import { ChangeEvent, HTMLAttributes } from 'preact/compat';

export interface SearchBarProps extends HTMLAttributes<HTMLInputElement> {
  phrase: string;
  onKeyPress: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  placeholder?: string;
}

export const SearchBar: FunctionComponent<SearchBarProps> = ({
  phrase,
  onKeyPress,
  placeholder,
}) => {
  return (
    <div className="relative ds-sdk-search-bar">
      <input
        id="search"
        type="text"
        value={phrase}
        onKeyPress={onKeyPress}
        className="border border-black text-[15px] p-[11px] block-display rounded-[15px] w-full mb-[15px] h-[40px] ds-sdk-search-bar__input"
        placeholder={placeholder}
        autocomplete="off"
      />
    </div>
  );
};
