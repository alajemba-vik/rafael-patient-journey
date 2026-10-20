import type { ReactNode } from "react";

import { usePageTitle } from "./usePageTitle";

/** Every page starts with this: its title (also used for the browser tab) and its main actions. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  usePageTitle(title);
  return (
    <div className="rf-page-header">
      <h1 className="rf-display-lg">{title}</h1>
      {children && <div className="rf-page-header__actions">{children}</div>}
    </div>
  );
}
