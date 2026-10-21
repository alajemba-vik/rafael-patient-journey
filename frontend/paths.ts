// Every page address, defined once. Routes, menus and links all use these, so renaming a page
// is a one-line change that the typecheck follows everywhere.
export const paths = {
  home: "/",
  login: "/connexion",
  faq: "/faq",
  patient: {
    home: "/patient",
    appointments: "/patient/rendez-vous",
    pathway: "/patient/parcours",
    questionnaires: "/patient/questionnaires",
  },
  pro: {
    schedule: "/pro",
    patients: "/pro/patients",
    patient: (patientId: string) => `/pro/patients/${patientId}`,
    pathways: "/pro/parcours",
    needs: "/pro/besoins",
    dashboard: "/pro/tableau-de-bord",
  },
  reception: {
    board: "/accueil",
    patients: "/accueil/patients",
    patient: (patientId: string) => `/accueil/patients/${patientId}`,
  },
  admin: {
    accounts: "/admin",
    faq: "/admin/faq",
    dashboard: "/admin/tableau-de-bord",
  },
} as const;

/** Builders called with this give the router's parameter pattern, e.g. "/pro/patients/:patientId". */
export const PATIENT_ID_PARAM = ":patientId";
