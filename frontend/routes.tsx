import { createBrowserRouter, type RouteObject } from "react-router";

import { AppShell } from "./components/layout/AppShell";
import { RequireAuth, RoleHome } from "./components/layout/RequireAuth";
import { FaqPage } from "./pages/public/faq/FaqPage";
import { LoginPage } from "./pages/public/login/LoginPage";
import { NotFoundPage } from "./pages/public/not_found/NotFoundPage";
import { paths, PATIENT_ID_PARAM } from "./paths";

/** A page in its own download, fetched the first time someone opens it. */
function page(path: string, load: () => Promise<{ default: React.ComponentType }>): RouteObject {
  return { path, lazy: () => load().then((module) => ({ Component: module.default })) };
}

// Paths come from paths.ts. Child paths are absolute (React Router accepts that when they
// start with the parent's path), so each address is written exactly once.
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: paths.login, element: <LoginPage /> },
      { path: paths.faq, element: <FaqPage /> },
      { element: <RequireAuth />, children: [{ path: paths.home, element: <RoleHome /> }] },
      {
        element: <RequireAuth roles={["patient"]} />,
        children: [
          page(paths.patient.home, () =>
            import("./pages/patient/home/PatientHomePage").then((m) => ({ default: m.PatientHomePage })),
          ),
          page(paths.patient.appointments, () =>
            import("./pages/patient/appointments/PatientAppointmentsPage").then((m) => ({
              default: m.PatientAppointmentsPage,
            })),
          ),
          page(paths.patient.pathway, () =>
            import("./pages/patient/pathway/PatientPathwayPage").then((m) => ({ default: m.PatientPathwayPage })),
          ),
          page(paths.patient.questionnaires, () =>
            import("./pages/patient/questionnaires/PatientQuestionnairesPage").then((m) => ({
              default: m.PatientQuestionnairesPage,
            })),
          ),
        ],
      },
      {
        element: <RequireAuth roles={["professional", "coordinator"]} />,
        children: [
          page(paths.pro.schedule, () =>
            import("./pages/professional/schedule/SchedulePage").then((m) => ({ default: m.SchedulePage })),
          ),
          page(paths.pro.patients, () =>
            import("./pages/professional/patients/PatientsPage").then((m) => ({ default: m.PatientsPage })),
          ),
          page(paths.pro.patient(PATIENT_ID_PARAM), () =>
            import("./pages/professional/patients/PatientFilePage").then((m) => ({ default: m.PatientFilePage })),
          ),
          page(paths.pro.dashboard, () =>
            import("./pages/professional/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })),
          ),
        ],
      },
      {
        element: <RequireAuth roles={["coordinator"]} />,
        children: [
          page(paths.pro.pathways, () =>
            import("./pages/professional/pathways/LedPathwaysPage").then((m) => ({ default: m.LedPathwaysPage })),
          ),
          page(paths.pro.needs, () =>
            import("./pages/professional/needs/NeedsPage").then((m) => ({ default: m.NeedsPage })),
          ),
        ],
      },
      {
        element: <RequireAuth roles={["secretary"]} />,
        children: [
          page(paths.reception.board, () =>
            import("./pages/secretariat/reception/ReceptionBoardPage").then((m) => ({
              default: m.ReceptionBoardPage,
            })),
          ),
          page(paths.reception.patients, () =>
            import("./pages/secretariat/patients/ReceptionPatientsPage").then((m) => ({
              default: m.ReceptionPatientsPage,
            })),
          ),
          page(paths.reception.patient(PATIENT_ID_PARAM), () =>
            import("./pages/secretariat/patients/ReceptionPatientPage").then((m) => ({
              default: m.ReceptionPatientPage,
            })),
          ),
        ],
      },
      {
        element: <RequireAuth roles={["admin"]} />,
        children: [
          page(paths.admin.accounts, () =>
            import("./pages/admin/users/AccountsPage").then((m) => ({ default: m.AccountsPage })),
          ),
          page(paths.admin.faq, () =>
            import("./pages/admin/faq/FaqAdminPage").then((m) => ({ default: m.FaqAdminPage })),
          ),
          // The same de-identified dashboard care staff see.
          page(paths.admin.dashboard, () =>
            import("./pages/professional/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })),
          ),
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
