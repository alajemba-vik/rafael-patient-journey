import { Navigate, Outlet, useLocation } from "react-router";

import { useMe, type Role } from "../../api/me";
import { session } from "../../api/session";
import { QueryState } from "../feedback/QueryState";
import { NotAllowedState } from "../feedback/states";
import { homeFor } from "./navigation";

/**
 * Pages behind a login. `roles` only decides what the menu leads to: the API still checks
 * every permission and answers 403 otherwise.
 */
export function RequireAuth({ roles }: { roles?: Role[] }) {
  const location = useLocation();
  const me = useMe();

  if (!session.getToken()) {
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  }
  return (
    <QueryState query={me}>
      {(user) => (roles && !roles.includes(user.role) ? <NotAllowedState /> : <Outlet />)}
    </QueryState>
  );
}

/** "/" sends each person to their own home page. */
export function RoleHome() {
  const me = useMe();
  return <QueryState query={me}>{(user) => <Navigate to={homeFor(user.role)} replace />}</QueryState>;
}
