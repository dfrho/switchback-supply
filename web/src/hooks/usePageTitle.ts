import { useEffect } from 'react';

/** Sets the browser tab title for the current page. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | Switchback Supply` : 'Switchback Supply | Gear for the long way up';
  }, [title]);
}
