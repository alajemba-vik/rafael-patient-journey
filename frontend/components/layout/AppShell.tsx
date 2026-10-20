import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";

import { useMe } from "../../api/me";
import { session } from "../../api/session";
import { NAV_BY_ROLE } from "./navigation";

export function AppShell() {
  const { data: me } = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstPage = useRef(true);

  // After navigating, move focus to the new page so keyboard and screen-reader users start there.
  useEffect(() => {
    if (isFirstPage.current) {
      isFirstPage.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [location.pathname]);

  function signOut() {
    session.end();
    queryClient.clear();
    navigate("/connexion");
  }

  return (
    <div className="rf-root rf-shell">
      <a className="rf-skip-link" href="#contenu">
        Aller au contenu
      </a>
      <header className="rf-shell__header">
        <div className="rf-shell__bar">
          <Link to="/" className="rf-shell__brand">
            Institut Rafaël
          </Link>
          {me && (
            <nav className="rf-nav" aria-label="Navigation principale">
              {NAV_BY_ROLE[me.role].map((item, _, items) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="rf-navlink"
                  // "/accueil" must not also light up on "/accueil/patients", which has its own item.
                  end={items.some((other) => other.to.startsWith(`${item.to}/`))}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="rf-shell__account">
            {me ? (
              <>
                <span className="rf-shell__user">{me.full_name}</span>
                <button type="button" className="rf-btn rf-btn--secondary" onClick={signOut}>
                  Se déconnecter
                </button>
              </>
            ) : (
              location.pathname !== "/connexion" && (
                <Link to="/connexion" className="rf-btn rf-btn--secondary">
                  Se connecter
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
