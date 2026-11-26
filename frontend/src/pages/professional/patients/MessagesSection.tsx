import { useTranslation } from "react-i18next";

import { MessageThread } from "../../../components/messaging/MessageThread";

export function MessagesSection({ patientId }: { patientId: string }) {
  const { t } = useTranslation();

  return (
    <section className="rf-panel rf-section" aria-labelledby="messages-title">
      <h2 id="messages-title" className="rf-title">
        {t("messages.title")}
      </h2>
      <MessageThread patientId={patientId} asPatient={false} />
    </section>
  );
}
