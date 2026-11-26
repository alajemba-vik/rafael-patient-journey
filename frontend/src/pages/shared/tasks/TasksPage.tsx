import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { useMe } from "../../../api/identity_access";
import {
  useChangeTaskStatus,
  useCreateTask,
  useDeleteTask,
  useTaskAssignees,
  useTasks,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "../../../api/pathways";
import { usePatients } from "../../../api/patients";
import { QueryState } from "../../../components/feedback/QueryState";
import { Button } from "../../../components/forms/Button";
import { ConfirmButton } from "../../../components/forms/ConfirmButton";
import { SelectField } from "../../../components/forms/SelectField";
import { TextArea } from "../../../components/forms/TextArea";
import { TextField } from "../../../components/forms/TextField";
import { PageHeader } from "../../../components/layout/PageHeader";
import { formatDate } from "../../../lib/format";

const LANES: TaskStatus[] = ["todo", "in_progress", "done"];
const PRIORITIES: TaskPriority[] = ["high", "medium", "low"];
const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
// What each lane's main button moves the task to.
const NEXT: Record<TaskStatus, TaskStatus> = { todo: "in_progress", in_progress: "done", done: "todo" };

function NewTaskForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const me = useMe().data;
  const assignees = useTaskAssignees();
  const patients = usePatients("");
  const create = useCreateTask();
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [patientId, setPatientId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueOn, setDueOn] = useState("");
  const [note, setNote] = useState("");
  const assignee = assignedTo || me?.id || "";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !assignee) return;
    create.mutate(
      {
        title,
        note: note || null,
        assigned_to: assignee,
        patient_id: patientId || null,
        priority,
        due_on: dueOn || null,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form className="rf-panel rf-stack rf-section" onSubmit={submit} aria-label={t("tasks.new")}>
      <p className="rf-title">{t("tasks.new")}</p>
      <TextField
        label={t("tasks.titleField")}
        value={title}
        maxLength={120}
        required
        onChange={(event) => setTitle(event.target.value)}
      />
      <div className="rf-row">
        <SelectField label={t("tasks.assignedTo")} value={assignee} onChange={(e) => setAssignedTo(e.target.value)}>
          {assignees.data?.map((person) => (
            <option key={person.id} value={person.id}>
              {person.id === me?.id ? t("tasks.me") : person.full_name}
              {person.discipline ? ` · ${person.discipline}` : ""}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t("tasks.patient")}
          hint={t("tasks.patientHint")}
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
        >
          <option value="">{t("tasks.noPatient")}</option>
          {patients.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.last_name} {p.first_name}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="rf-row">
        <SelectField
          label={t("tasks.priority")}
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {t(`tasks.priorities.${p}`)}
            </option>
          ))}
        </SelectField>
        <TextField label={t("tasks.dueOn")} type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
      </div>
      <TextArea label={t("tasks.note")} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
      {create.isError && (
        <p className="rf-field__error" role="alert">
          {t("tasks.createFailed")}
        </p>
      )}
      <div className="rf-row">
        <Button type="submit" pending={create.isPending} disabled={!title.trim() || !assignee}>
          {t("tasks.create")}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          {t("tasks.cancel")}
        </Button>
      </div>
    </form>
  );
}

function TaskCard({ task, given }: { task: Task; given: boolean }) {
  const { t } = useTranslation();
  const me = useMe().data;
  const move = useChangeTaskStatus();
  const remove = useDeleteTask();
  const overdue = task.status !== "done" && task.due_on !== null && task.due_on < new Date().toISOString().slice(0, 10);

  return (
    <li className="rf-card">
      <div className="rf-section-head">
        <strong>{task.title}</strong>
        <span className={`rf-badge rf-badge--priority-${task.priority}`}>{t(`tasks.priorities.${task.priority}`)}</span>
      </div>
      <dl className="rf-dl">
        {task.patient_name && (
          <>
            <dt>{t("tasks.patient")}</dt>
            <dd>{task.patient_name}</dd>
          </>
        )}
        <dt>{given ? t("tasks.assignedTo") : t("tasks.givenBy")}</dt>
        <dd>{given ? task.assigned_to_name : task.created_by === me?.id ? t("tasks.me") : task.created_by_name}</dd>
        {task.due_on && (
          <>
            <dt>{t("tasks.dueOn")}</dt>
            <dd className={overdue ? "rf-overdue" : undefined}>
              {formatDate(task.due_on)}
              {overdue && ` · ${t("tasks.overdue")}`}
            </dd>
          </>
        )}
      </dl>
      {task.note && <p className="rf-muted">{task.note}</p>}
      <div className="rf-row">
        <Button
          variant={task.status === "done" ? "secondary" : "primary"}
          pending={move.isPending}
          onClick={() => move.mutate({ taskId: task.id, status: NEXT[task.status] })}
        >
          {t(`tasks.move.${task.status}`)}
        </Button>
        {task.created_by === me?.id && (
          <ConfirmButton
            question={t("tasks.deleteQuestion")}
            confirmLabel={t("tasks.deleteConfirm")}
            pending={remove.isPending}
            onConfirm={() => remove.mutate(task.id)}
          >
            {t("tasks.delete")}
          </ConfirmButton>
        )}
      </div>
    </li>
  );
}

/** A to-do board shared by reception and care staff: to do, in progress, done. */
export function TasksPage() {
  const { t } = useTranslation();
  const [given, setGiven] = useState(false);
  const [creating, setCreating] = useState(false);
  const tasks = useTasks(given);

  return (
    <>
      <PageHeader title={t("tasks.title")}>
        {!creating && <Button onClick={() => setCreating(true)}>{t("tasks.new")}</Button>}
      </PageHeader>
      {creating && <NewTaskForm onDone={() => setCreating(false)} />}
      <div className="rf-row rf-section" role="group" aria-label={t("tasks.whose")}>
        <Button variant={given ? "secondary" : "primary"} aria-pressed={!given} onClick={() => setGiven(false)}>
          {t("tasks.mine")}
        </Button>
        <Button variant={given ? "primary" : "secondary"} aria-pressed={given} onClick={() => setGiven(true)}>
          {t("tasks.given")}
        </Button>
      </div>
      <QueryState query={tasks}>
        {(list) => (
          <div className="rf-board">
            {LANES.map((lane) => {
              const items = list
                .filter((task) => task.status === lane)
                .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
              return (
                <section key={lane} className="rf-lane" aria-labelledby={`lane-${lane}`}>
                  <div className="rf-lane__header">
                    <h2 id={`lane-${lane}`} className="rf-title">
                      {t(`tasks.lanes.${lane}`)}
                    </h2>
                    <span className="rf-lane__count">{items.length}</span>
                  </div>
                  {items.length === 0 ? (
                    <p className="rf-lane__empty">{t(`tasks.empty.${lane}`)}</p>
                  ) : (
                    <ul className="rf-cards">
                      {items.map((task) => (
                        <TaskCard key={task.id} task={task} given={given} />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </QueryState>
    </>
  );
}

// React Router loads a lazy route's component from this export.
export { TasksPage as Component };
