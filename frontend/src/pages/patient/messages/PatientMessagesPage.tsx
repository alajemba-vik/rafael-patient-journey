import { useTranslation } from "react-i18next";

import { PageHeader } from "../../../components/layout/PageHeader";
import { MessageThread } from "../../../components/messaging/MessageThread";

export function PatientMessagesPage() {
  const { t } = useTranslation();

  return (
    <div className="rf-narrow">
      <PageHeader title={t("messages.title")} />
      <p className="rf-section">{t("messages.intro")}</p>
      <MessageThread patientId={null} asPatient />
    </div>
  );
}

// React Router loads a lazy route's component from this export.
export { PatientMessagesPage as Component };
