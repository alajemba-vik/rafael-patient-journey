import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";

import { useMe } from "../../api/identity_access";
import { useNotifications } from "../../api/notifications";
import { session } from "../../api/core/session";
import { NAV_BY_ROLE } from "../../app/navigation";
import { paths } from "../../app/paths";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function AppShell() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const { data: inbox } = useNotifications(Boolean(me));
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstPage = useRef(true);

  // After navigating, start the new page at the top, and move focus to it so keyboard and
  // screen-reader users start there too. preventScroll: focusing must not scroll the page down
  // past the header.
  useEffect(() => {
    if (isFirstPage.current) {
      isFirstPage.current = false;
      return;
    }
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  function signOut() {
    session.end();
    queryClient.clear();
    navigate(paths.login);
  }

  return (
    <div className="rf-root rf-shell">
      <a className="rf-skip-link" href="#contenu">
        {t("shell.skipToContent")}
      </a>
      <header className="rf-shell__header">
        <div className="rf-shell__bar">
          <Link to={paths.home} className="rf-shell__brand">
            Institut Rafaël
          </Link>
          {me && (
            <nav className="rf-nav" aria-label={t("shell.mainNav")}>
              {NAV_BY_ROLE[me.role].map((item, _, items) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="rf-navlink"
                  // A section's first item must not also light up on a sibling item's deeper page.
                  end={items.some((other) => other.to.startsWith(`${item.to}/`))}
                >
                  {t(item.label)}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="rf-shell__account">
            <LanguageSwitcher />
            {me ? (
              <>
                <NavLink to={paths.notifications} className="rf-navlink rf-shell__inbox">
                  {t("shell.notifications")}
                  {inbox && inbox.unread > 0 && (
                    <span className="rf-count">
                      <span aria-hidden="true">{inbox.unread}</span>
                      <span className="rf-visually-hidden">{t("shell.unreadCount", { count: inbox.unread })}</span>
                    </span>
                  )}
                </NavLink>
                <span className="rf-shell__user">{me.full_name}</span>
                <button type="button" className="rf-btn rf-btn--secondary" onClick={signOut}>
                  {t("shell.signOut")}
                </button>
              </>
            ) : (
              location.pathname !== paths.login && (
                <Link to={paths.login} className="rf-btn rf-btn--secondary">
                  {t("shell.signIn")}
                </Link>
              )
            )}
          </div>
        </div>
      </header>
      <main id="contenu" ref={mainRef} tabIndex={-1} className="rf-shell__main">
        <Outlet />
      </main>
    </div>
  );
}
