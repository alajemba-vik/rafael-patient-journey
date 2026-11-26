// Every page address, defined once. Routes, menus and links all use these, so renaming a page
// is a one-line change that the typecheck follows everywhere.
export const paths = {
  home: "/",
  login: "/connexion",
  faq: "/faq",
  notifications: "/notifications",
  tasks: "/taches",
  patient: {
    home: "/patient",
    appointments: "/patient/rendez-vous",
    pathway: "/patient/parcours",
    questionnaires: "/patient/questionnaires",
    messages: "/patient/messages",
  },
  pro: {
    schedule: "/pro",
    patients: "/pro/patients",
    patient: (patientId: string) => `/pro/patients/${patientId}`,
    report: (patientId: string) => `/pro/patients/${patientId}/compte-rendu`,
    pathways: "/pro/parcours",
    needs: "/pro/besoins",
    planning: "/pro/planning-partage",
    groups: "/pro/seances-collectives",
    dashboard: "/pro/tableau-de-bord",
  },
  reception: {
    board: "/accueil",
    patients: "/accueil/patients",
    callBacks: "/accueil/a-rappeler",
    planning: "/accueil/planning",
    groups: "/accueil/seances-collectives",
    patient: (patientId: string) => `/accueil/patients/${patientId}`,
  },
  admin: {
    accounts: "/admin",
    faq: "/admin/faq",
    audit: "/admin/journal",
    dashboard: "/admin/tableau-de-bord",
  },
} as const;

/** Builders called with this give the router's parameter pattern, e.g. "/pro/patients/:patientId". */
export const PATIENT_ID_PARAM = ":patientId";
