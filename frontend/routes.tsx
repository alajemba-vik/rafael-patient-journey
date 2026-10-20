import { createBrowserRouter } from "react-router";

import { AppShell } from "./components/layout/AppShell";
import { RequireAuth, RoleHome } from "./components/layout/RequireAuth";
import { FaqPage } from "./pages/public/faq/FaqPage";
import { LoginPage } from "./pages/public/login/LoginPage";
import { NotFoundPage } from "./pages/public/not_found/NotFoundPage";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/connexion", element: <LoginPage /> },
      { path: "/faq", element: <FaqPage /> },
      { element: <RequireAuth />, children: [{ index: true, element: <RoleHome /> }] },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
