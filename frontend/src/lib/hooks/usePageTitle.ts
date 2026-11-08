import { useEffect } from "react";

/** Sets the browser tab title, so tabs, history and screen readers name the page. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · Institut Rafaël`;
  }, [title]);
}
