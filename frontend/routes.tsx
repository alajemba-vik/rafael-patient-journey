import { createBrowserRouter } from "react-router";

import { AppShell } from "./components/layout/AppShell";
import { RequireAuth, RoleHome } from "./components/layout/RequireAuth";
import { FaqPage } from "./pages/public/faq/FaqPage";
import { LoginPage } from "./pages/public/login/LoginPage";
import { NotFoundPage } from "./pages/public/not_found/NotFoundPage";

// Each role's pages are separate downloads, fetched the first time that person opens them.
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/connexion", element: <LoginPage /> },
      { path: "/faq", element: <FaqPage /> },
      { element: <RequireAuth />, children: [{ index: true, element: <RoleHome /> }] },
      {
        path: "/patient",
        element: <RequireAuth roles={["patient"]} />,
        children: [
          {
            index: true,
            lazy: () =>
              import("./pages/patient/home/PatientHomePage").then((m) => ({ Component: m.PatientHomePage })),
          },
          {
            path: "rendez-vous",
            lazy: () =>
              import("./pages/patient/appointments/PatientAppointmentsPage").then((m) => ({
                Component: m.PatientAppointmentsPage,
              })),
          },
          {
            path: "parcours",
            lazy: () =>
              import("./pages/patient/pathway/PatientPathwayPage").then((m) => ({ Component: m.PatientPathwayPage })),
          },
          {
            path: "questionnaires",
            lazy: () =>
              import("./pages/patient/questionnaires/PatientQuestionnairesPage").then((m) => ({
                Component: m.PatientQuestionnairesPage,
              })),
          },
        ],
      },
      {
        path: "/pro",
        element: <RequireAuth roles={["professional", "coordinator"]} />,
        children: [
          {
            index: true,
            lazy: () =>
              import("./pages/professional/schedule/SchedulePage").then((m) => ({ Component: m.SchedulePage })),
          },
          {
            path: "patients",
            lazy: () =>
              import("./pages/professional/patients/PatientsPage").then((m) => ({ Component: m.PatientsPage })),
          },
          {
            path: "patients/:patientId",
            lazy: () =>
              import("./pages/professional/patients/PatientFilePage").then((m) => ({ Component: m.PatientFilePage })),
          },
          {
            path: "tableau-de-bord",
            lazy: () =>
              import("./pages/professional/dashboard/DashboardPage").then((m) => ({ Component: m.DashboardPage })),
          },
          {
            element: <RequireAuth roles={["coordinator"]} />,
            children: [
              {
                path: "parcours",
                lazy: () =>
                  import("./pages/professional/pathways/LedPathwaysPage").then((m) => ({
                    Component: m.LedPathwaysPage,
                  })),
              },
              {
                path: "besoins",
                lazy: () => import("./pages/professional/needs/NeedsPage").then((m) => ({ Component: m.NeedsPage })),
              },
            ],
          },
        ],
      },
      {
        path: "/accueil",
        element: <RequireAuth roles={["secretary"]} />,
        children: [
          {
            index: true,
            lazy: () =>
              import("./pages/secretariat/reception/ReceptionBoardPage").then((m) => ({
                Component: m.ReceptionBoardPage,
              })),
          },
          {
            path: "patients",
            lazy: () =>
              import("./pages/secretariat/patients/ReceptionPatientsPage").then((m) => ({
                Component: m.ReceptionPatientsPage,
              })),
          },
          {
            path: "patients/:patientId",
            lazy: () =>
              import("./pages/secretariat/patients/ReceptionPatientPage").then((m) => ({
                Component: m.ReceptionPatientPage,
              })),
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
