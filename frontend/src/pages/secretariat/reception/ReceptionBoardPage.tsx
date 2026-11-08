import { useId } from "react";
import { useSearchParams } from "react-router";

import { useDayBoard } from "../../../api/reception";
import type { Appointment } from "../../../api/scheduling";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatWeekday } from "../../../components/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { instituteDateTime, instituteToday } from "../../../components/time";
import { useNow } from "../../../components/useNow";
import { AppointmentCard } from "./AppointmentCard";
import { actionsFor, groupBoard, type DayKind } from "./board";
import { DayNavigator } from "./DayNavigator";

const DAY_PARAM = "jour";
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function ReceptionBoardPage() {
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
      <PageHeader title={isToday ? "Accueil du jour" : "Accueil"}>
        <DayNavigator day={day} today={today} onChange={goTo} />
      </PageHeader>
      <p className="rf-muted rf-section">
        <span className="rf-capitalize">{dayLabel}</span>
        {isToday && " · mis à jour automatiquement"}
      </p>
      <QueryState
        query={board}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: isToday ? "Aucun rendez-vous aujourd’hui." : "Aucun rendez-vous ce jour-là.",
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
              <ul className="rf-summary" aria-live="polite" aria-label="Résumé de la journée">
                {isToday && <Count value={lanes.waiting.length} label="en salle d’attente" />}
                {isToday && <Count value={lanes.inSession.length} label="en séance" />}
                {!isPast && <Count value={lanes.upcoming.length} label="à venir" />}
                {isPast && unresolved.length > 0 && <Count value={unresolved.length} label="sans suite" />}
                {!isFuture && <Count value={lanes.done.length} label="terminés" />}
                {!isFuture && <Count value={lanes.noShow.length} label="absents" />}
                <Count value={lanes.cancelled.length} label="annulés" />
              </ul>
              {isToday && (
                <div className="rf-board">
                  <Lane title="En salle d’attente" items={lanes.waiting} empty="Personne n’attend.">
                    {manage}
                  </Lane>
                  <Lane title="En séance" items={lanes.inSession} empty="Aucune séance en cours.">
                    {manage}
                  </Lane>
                  <Lane title="À venir" items={lanes.upcoming} empty="Plus rien de prévu.">
                    {manage}
                  </Lane>
                </div>
              )}
              {isFuture && (
                <Lane title="Rendez-vous prévus" items={lanes.upcoming} empty="Aucun rendez-vous prévu." wide>
                  {manage}
                </Lane>
              )}
              {isPast && unresolved.length > 0 && (
                <Lane title="Sans suite" items={unresolved} empty="" wide>
                  {manage}
                </Lane>
              )}
              <ClosedLane title="Terminés" items={lanes.done} open={isPast}>
                {show}
              </ClosedLane>
              <ClosedLane title="Absents" items={lanes.noShow} open={isPast}>
                {show}
              </ClosedLane>
              <ClosedLane title="Annulés" items={lanes.cancelled}>
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

function Lane({ title, items, empty, wide, children }: LaneProps & { empty: string; wide?: boolean }) {
  const id = useId();
  return (
    <section className={wide ? "rf-lane rf-section" : "rf-lane"} aria-labelledby={id}>
      <div className="rf-lane__header">
        <h2 id={id} className="rf-title">
          {title}
        </h2>
        <span className="rf-lane__count" aria-label={`${items.length} rendez-vous`}>
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
