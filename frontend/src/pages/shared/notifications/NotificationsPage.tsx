import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useMe } from "../../../api/identity_access";
import { useMarkAllRead, useMarkRead, useNotifications, type Notification } from "../../../api/notifications";
import { QueryState } from "../../../components/feedback/QueryState";
import { Button } from "../../../components/forms/Button";
import { PageHeader } from "../../../components/layout/PageHeader";
import { formatDate, formatTime } from "../../../lib/format";
import { notificationLink } from "./notificationLink";

function useNotificationText() {
  const { t } = useTranslation();
  return (notification: Notification) => {
    const startsAt = notification.params.starts_at;
    return t(`notifications.templates.${notification.template}`, {
      date: startsAt ? formatDate(startsAt) : "",
      time: startsAt ? formatTime(startsAt) : "",
      name: notification.params.professional_name ?? "",
      reason: notification.params.reason ? t(`careTeam.reasons.${notification.params.reason as "care_team"}`) : "",
    });
  };
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const inbox = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const textOf = useNotificationText();

  return (
    <div className="rf-narrow">
      <PageHeader title={t("notifications.title")}>
        {inbox.data && inbox.data.unread > 0 && (
          <Button variant="secondary" onClick={() => markAllRead.mutate()} pending={markAllRead.isPending}>
            {t("notifications.markAllRead")}
          </Button>
        )}
      </PageHeader>
      <QueryState query={inbox} empty={{ isEmpty: (data) => data.items.length === 0, title: t("notifications.empty") }}>
        {(data) => (
          <ul className="rf-list">
            {data.items.map((notification) => {
              const unread = notification.status === "unread";
              const link = me ? notificationLink(notification, me.role) : null;
              const text = textOf(notification);
              return (
                <li
                  key={notification.id}
                  className={unread ? "rf-notification rf-notification--unread" : "rf-notification"}
                >
                  <div className="rf-stack">
                    <p>
                      {unread && <span className="rf-visually-hidden">{t("notifications.unread")} </span>}
                      {link ? (
                        <Link className="rf-link" to={link} onClick={() => unread && markRead.mutate(notification.id)}>
                          {text}
                        </Link>
                      ) : (
                        text
                      )}
                    </p>
                    <p className="rf-muted">
                      {t("notifications.sentAt", {
                        date: formatDate(notification.sent_at),
                        time: formatTime(notification.sent_at),
                      })}
                    </p>
                  </div>
                  {unread && (
                    <Button
                      variant="secondary"
                      onClick={() => markRead.mutate(notification.id)}
                      pending={markRead.isPending && markRead.variables === notification.id}
                    >
                      {t("notifications.markRead")}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
    </div>
  );
}

// React Router loads a lazy route's component from this export.
export { NotificationsPage as Component };
