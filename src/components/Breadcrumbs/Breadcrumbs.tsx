/*
Copyright 2024 Adobe
All Rights Reserved.

NOTICE: Adobe permits you to use, modify, and distribute this file in
accordance with the terms of the Adobe license agreement accompanying
it.
*/

import { FunctionComponent } from 'preact';

import Chevron from '../../icons/chevron.svg';

export interface PageProps {
  name: string;
  href: string;
  current: boolean;
}
export interface BreadcrumbsProps {
  pages: PageProps[];
}

export const Breadcrumbs: FunctionComponent<BreadcrumbsProps> = ({
  pages,
}: BreadcrumbsProps) => {
  return (
    <nav className="ds-sdk-breadcrumbs flex" aria-label="Breadcrumbs">
      <ol role="list" className="flex column items-center space-x-2">
        {pages.map((page, index) => (
          <li key={page.name} className="ds-sdk-breadcrumbs__item">
            <div className="flex items-center">
              {index > 0 && (
                <Chevron className="h-sm w-sm transform -rotate-90 stroke-gray-400" />
              )}

              <a
                href={page.href}
                className={`ml-2 text-[0.875rem] font-normal hover:text-gray-900 first:ml-0 ${
                  page.current
                    ? 'ds-sdk-breadcrumbs__item--current text-gray-500 font-light'
                    : 'text-black'
                }`}
                aria-current={page.current ? 'page' : undefined}
              >
                {page.name}
              </a>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
