import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { useDayBoard } from "../../../api/reception";
import type { Appointment } from "../../../api/scheduling";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatTime, formatWeekday } from "../../../lib/format";
import { Button } from "../../../components/forms/Button";
import { PageHeader } from "../../../components/layout/PageHeader";
import { downloadCsv } from "../../../lib/csv";
import { instituteDateTime, instituteToday } from "../../../lib/time";
import { useNow } from "../../../lib/hooks/useNow";
import { AppointmentCard } from "./AppointmentCard";
import { actionsFor, groupBoard, type DayKind } from "./board";
import { DayNavigator } from "./DayNavigator";

const DAY_PARAM = "jour";
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function ReceptionBoardPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const today = instituteToday();
  // A hand-edited or stale link falls back to today rather than an error page.
  const requested = params.get(DAY_PARAM);
  const day = requested && ISO_DAY.test(requested) ? requested : today;
  const board = useDayBoard(day);
  const now = useNow();
  const isToday = day === today;
  const isFuture = day > today;
  const isPast = day < today;
  const dayKind: DayKind = isPast ? "past" : isFuture ? "future" : "today";

  function goTo(next: string) {
    // Each day is a history entry: Back returns to the day seen before.
    setParams(next === today ? {} : { [DAY_PARAM]: next });
  }

  function cardProps(a: Appointment) {
    return { appointment: a, now, live: isToday, actions: actionsFor(a, dayKind, now) };
  }

  const dayLabel = formatWeekday(instituteDateTime(day, "12:00").toISOString());

  return (
    <>
      <PageHeader title={isToday ? t("board.titleToday") : t("board.title")}>
        <DayNavigator day={day} today={today} onChange={goTo} />
        {board.data && board.data.length > 0 && (
          <Button
            variant="secondary"
            onClick={() =>
              downloadCsv(
                `rendez-vous-${day}.csv`,
                [t("export.start"), t("export.end"), t("export.patient"), t("export.practitioner"), t("export.status")],
                board.data.map((a) => [
                  formatTime(a.starts_at),
                  formatTime(a.ends_at),
                  a.patient_name,
                  a.professional_name,
                  t(`labels.status.${a.status}`),
                ]),
              )
            }
          >
            {t("export.csv")}
          </Button>
        )}
      </PageHeader>
      <p className="rf-muted rf-section">
        <span className="rf-capitalize">{dayLabel}</span>
        {isToday && t("board.autoUpdated")}
      </p>
      <QueryState
        query={board}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: isToday ? t("board.emptyToday") : t("board.emptyDay"),
        }}
      >
        {(list) => {
          const lanes = groupBoard(list);
          // Appointments a past day left open: someone forgot to mark them, so they stay in view.
          const unresolved = [...lanes.waiting, ...lanes.inSession, ...lanes.upcoming];
          const manage = (a: Appointment) => <AppointmentCard key={a.id} {...cardProps(a)} manageable />;
          const show = (a: Appointment) => <AppointmentCard key={a.id} {...cardProps(a)} />;
          return (
            <>
              <ul className="rf-summary" aria-live="polite" aria-label={t("board.summary")}>
                {isToday && <Count value={lanes.waiting.length} label={t("board.count.waiting")} />}
                {isToday && <Count value={lanes.inSession.length} label={t("board.count.inSession")} />}
                {!isPast && <Count value={lanes.upcoming.length} label={t("board.count.upcoming")} />}
                {isPast && unresolved.length > 0 && (
                  <Count value={unresolved.length} label={t("board.count.unresolved")} />
                )}
                {!isFuture && <Count value={lanes.done.length} label={t("board.count.done")} />}
                {!isFuture && <Count value={lanes.noShow.length} label={t("board.count.noShow")} />}
                <Count value={lanes.cancelled.length} label={t("board.count.cancelled")} />
              </ul>
              {isToday && (
                <div className="rf-board">
                  <Lane
                    icon="⏳"
                    title={t("board.lane.waiting")}
                    items={lanes.waiting}
                    empty={t("board.lane.waitingEmpty")}
                  >
                    {manage}
                  </Lane>
                  <Lane
                    icon="🩺"
                    title={t("board.lane.inSession")}
                    items={lanes.inSession}
                    empty={t("board.lane.inSessionEmpty")}
                  >
                    {manage}
                  </Lane>
                  <Lane
                    icon="📅"
                    title={t("board.lane.upcoming")}
                    items={lanes.upcoming}
                    empty={t("board.lane.upcomingEmpty")}
                  >
                    {manage}
                  </Lane>
                </div>
              )}
              {isFuture && (
                <Lane
                  icon="📅"
                  title={t("board.lane.planned")}
                  items={lanes.upcoming}
                  empty={t("board.lane.plannedEmpty")}
                  wide
                >
                  {manage}
                </Lane>
              )}
              {isPast && unresolved.length > 0 && (
                <Lane icon="⚠️" title={t("board.lane.unresolved")} items={unresolved} empty="" wide>
                  {manage}
                </Lane>
              )}
              <ClosedLane title={t("board.lane.done")} items={lanes.done} open={isPast}>
                {show}
              </ClosedLane>
              <ClosedLane title={t("board.lane.noShow")} items={lanes.noShow} open={isPast}>
                {show}
              </ClosedLane>
              <ClosedLane title={t("board.lane.cancelled")} items={lanes.cancelled}>
                {show}
              </ClosedLane>
            </>
          );
        }}
      </QueryState>
    </>
  );
}

function Count({ value, label }: { value: number; label: string }) {
  return (
    <li>
      <strong>{value}</strong> {label}
    </li>
  );
}

type LaneProps = { title: string; items: Appointment[]; children: (a: Appointment) => React.ReactNode };

function Lane({
  icon,
  title,
  items,
  empty,
  wide,
  children,
}: LaneProps & { icon: string; empty: string; wide?: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <section className={wide ? "rf-lane rf-section" : "rf-lane"} aria-labelledby={id}>
      <div className="rf-lane__header">
        {/* The icon is decoration: the lane's accessible name stays its plain title. */}
        <h2 id={id} className="rf-title">
          <span aria-hidden="true">{icon}</span> {title}
        </h2>
        <span className="rf-lane__count" aria-label={t("board.laneCount", { count: items.length })}>
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rf-lane__empty">{empty}</p>
      ) : (
        <ul className={wide ? "rf-cards rf-cards--grid" : "rf-cards"}>{items.map(children)}</ul>
      )}
    </section>
  );
}

/** Done, missed and cancelled appointments: out of the way, one click to check or undo. */
function ClosedLane({ title, items, open, children }: LaneProps & { open?: boolean }) {
  if (items.length === 0) return null;
  return (
    <details className="rf-disclosure rf-collapsible" open={open}>
      <summary>
        {title} · {items.length}
      </summary>
      <ul className="rf-cards rf-cards--grid rf-disclosure__body">{items.map(children)}</ul>
    </details>
  );
}

// React Router loads a lazy route's component from this export.
export { ReceptionBoardPage as Component };
