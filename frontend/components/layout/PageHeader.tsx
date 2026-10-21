import type { ReactNode } from "react";

import { usePageTitle } from "./usePageTitle";

type Props = {
  title: string;
  /** The browser-tab title, when it must differ, e.g. to keep a patient's name out of history. */
  documentTitle?: string;
  children?: ReactNode;
};

/** Every page starts with this: its title (also used for the browser tab) and its main actions. */
export function PageHeader({ title, documentTitle, children }: Props) {
  usePageTitle(documentTitle ?? title);
  return (
    <div className="rf-page-header">
      <h1 className="rf-display-lg">{title}</h1>
      {children && <div className="rf-page-header__actions">{children}</div>}
    </div>
  );
}
