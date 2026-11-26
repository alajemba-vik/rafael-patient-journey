import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { useMessages, useSendMessage } from "../../api/pathways";
import { formatDate, formatTime } from "../../lib/format";
import { QueryState } from "../feedback/QueryState";
import { Button } from "../forms/Button";
import { TextArea } from "../forms/TextArea";

const MAX_LENGTH = 2000;

type Props = {
  /** The patient whose conversation this is; null for the signed-in patient's own. */
  patientId: string | null;
  /** True on the patient's side: their own messages are "you", the team's carry a name. */
  asPatient: boolean;
};

/** The conversation between a patient and their care team, with a box to write in. */
export function MessageThread({ patientId, asPatient }: Props) {
  const { t } = useTranslation();
  const messages = useMessages(patientId);
  const send = useSendMessage(patientId);
  const [draft, setDraft] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    send.mutate(draft, { onSuccess: () => setDraft("") });
  }

  return (
    <div className="rf-stack">
      <QueryState
        query={messages}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: t("messages.empty"),
          children: <p>{asPatient ? t("messages.emptyHintPatient") : t("messages.emptyHintTeam")}</p>,
        }}
      >
        {(list) => (
          <ol className="rf-thread" aria-label={t("messages.thread")}>
            {list.map((message) => {
              const mine = message.from_patient === asPatient;
              return (
                <li key={message.id} className={mine ? "rf-thread__item rf-thread__item--mine" : "rf-thread__item"}>
                  <p className="rf-muted">
                    {t("messages.meta", {
                      name: asPatient && mine ? t("messages.you") : message.sender_name,
                      date: formatDate(message.sent_at),
                      time: formatTime(message.sent_at),
                    })}
                  </p>
                  <p className="rf-thread__body">{message.body}</p>
                </li>
              );
            })}
          </ol>
        )}
      </QueryState>
      <form className="rf-stack" onSubmit={submit}>
        <TextArea
          label={asPatient ? t("messages.writeToTeam") : t("messages.writeToPatient")}
          hint={t("messages.hint")}
          value={draft}
          maxLength={MAX_LENGTH}
          rows={3}
          onChange={(event) => setDraft(event.target.value)}
          error={send.isError ? t("messages.sendError") : undefined}
        />
        <div>
          <Button type="submit" pending={send.isPending} disabled={!draft.trim()}>
            {t("messages.send")}
          </Button>
        </div>
      </form>
    </div>
  );
}
