import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import {
  useClinicalProfile,
  useSaveClinicalProfile,
  type ClinicalProfile,
  type ClinicalProfileInput,
} from "../../../api/patients";
import { QueryState } from "../../../components/feedback/QueryState";
import { Button } from "../../../components/forms/Button";
import { SelectField } from "../../../components/forms/SelectField";
import { TextArea } from "../../../components/forms/TextArea";
import { TextField } from "../../../components/forms/TextField";
import {
  CANCER_SITES,
  TREATMENT_KINDS,
  TREATMENT_STATUSES,
  WORK_SITUATIONS,
  bodyMassIndex,
  type CancerSite,
  type TreatmentKind,
  type WorkSituation,
} from "../../../lib/clinicalProfile";
import { formatDate, formatNumber } from "../../../lib/format";

type Treatment = ClinicalProfileInput["treatments"] extends (infer T)[] | undefined ? T : never;

function YesNo({ value }: { value: boolean | null | undefined }) {
  const { t } = useTranslation();
  if (value === true) return <>{t("clinical.yes")}</>;
  if (value === false) return <>{t("clinical.no")}</>;
  return <>—</>;
}

function Summary({ profile }: { profile: ClinicalProfile }) {
  const { t } = useTranslation();
  const bmi = bodyMassIndex(profile.height_cm, profile.weight_kg);
  const site = profile.cancer_site ? t(`clinical.sites.${profile.cancer_site as CancerSite}`) : "—";
  const drinks =
    profile.drinks_alcohol && profile.drinks_per_week != null ? (
      `${t("clinical.yes")} (${t("clinical.perWeek", { count: profile.drinks_per_week })})`
    ) : (
      <YesNo value={profile.drinks_alcohol} />
    );

  return (
    <div className="rf-stack">
      <div className="rf-grid">
        <div>
          <h3 className="rf-subtitle">{t("clinical.disease")}</h3>
          <dl className="rf-dl">
            <dt>{t("clinical.site")}</dt>
            <dd>{site}</dd>
            <dt>{t("clinical.diagnosedOn")}</dt>
            <dd>{profile.diagnosed_on ? formatDate(profile.diagnosed_on) : "—"}</dd>
            <dt>{t("clinical.metastatic")}</dt>
            <dd>
              <YesNo value={profile.metastatic} />
            </dd>
            <dt>{t("clinical.allergies")}</dt>
            <dd>{profile.allergies ?? "—"}</dd>
            <dt>{t("clinical.body")}</dt>
            <dd>
              {profile.height_cm ? `${profile.height_cm} cm` : "—"} ·{" "}
              {profile.weight_kg ? `${profile.weight_kg} kg` : "—"}
              {bmi !== null && ` · ${t("clinical.bmi")} ${formatNumber(bmi)}`}
            </dd>
          </dl>
        </div>
        <div>
          <h3 className="rf-subtitle">{t("clinical.social")}</h3>
          <dl className="rf-dl">
            <dt>{t("clinical.occupation")}</dt>
            <dd>{profile.occupation ?? "—"}</dd>
            <dt>{t("clinical.workSituation")}</dt>
            <dd>{profile.work_situation ? t(`clinical.work.${profile.work_situation as WorkSituation}`) : "—"}</dd>
            <dt>{t("clinical.livesAlone")}</dt>
            <dd>
              <YesNo value={profile.lives_alone} />
            </dd>
            <dt>{t("clinical.hasDependants")}</dt>
            <dd>
              <YesNo value={profile.has_dependants} />
            </dd>
            <dt>{t("clinical.hasCaregivers")}</dt>
            <dd>
              <YesNo value={profile.has_caregivers} />
              {profile.caregivers && ` (${profile.caregivers})`}
            </dd>
          </dl>
        </div>
        <div>
          <h3 className="rf-subtitle">{t("clinical.habits")}</h3>
          <dl className="rf-dl">
            <dt>{t("clinical.smoker")}</dt>
            <dd>
              <YesNo value={profile.smoker} />
            </dd>
            <dt>{t("clinical.drinksAlcohol")}</dt>
            <dd>{drinks}</dd>
            <dt>{t("clinical.takesSupplements")}</dt>
            <dd>
              <YesNo value={profile.takes_supplements} />
            </dd>
          </dl>
        </div>
      </div>
      <div>
        <h3 className="rf-subtitle">{t("clinical.treatments")}</h3>
        {profile.treatments && profile.treatments.length > 0 ? (
          <ul className="rf-plain-list">
            {profile.treatments.map((treatment) => (
              <li key={treatment.id}>
                <strong>{t(`clinical.kinds.${treatment.kind as TreatmentKind}`)}</strong> ·{" "}
                {t(`clinical.statuses.${treatment.status}`)}
                {treatment.started_on && ` · ${t("clinical.from")} ${formatDate(treatment.started_on)}`}
                {treatment.ended_on && ` ${t("clinical.to")} ${formatDate(treatment.ended_on)}`}
                {treatment.details && <span className="rf-muted"> · {treatment.details}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rf-muted">{t("clinical.noTreatment")}</p>
        )}
      </div>
      {profile.notes && (
        <div>
          <h3 className="rf-subtitle">{t("clinical.notes")}</h3>
          <p>{profile.notes}</p>
        </div>
      )}
    </div>
  );
}

const NO_ANSWER = "";

/** What the form edits: the saved profile without its bookkeeping fields and treatment ids. */
function toInput(profile: ClinicalProfile): ClinicalProfileInput {
  const fields = Object.fromEntries(
    Object.entries(profile).filter(([key]) => !["updated_at", "updated_by", "treatments"].includes(key)),
  ) as ClinicalProfileInput;
  const treatments = (profile.treatments ?? []).map((tr) => ({
    kind: tr.kind,
    status: tr.status,
    started_on: tr.started_on,
    ended_on: tr.ended_on,
    details: tr.details,
  }));
  return { ...fields, treatments };
}

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null | undefined;
  onChange: (value: boolean | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <SelectField
      label={label}
      value={value == null ? NO_ANSWER : String(value)}
      onChange={(event) => onChange(event.target.value === NO_ANSWER ? null : event.target.value === "true")}
    >
      <option value={NO_ANSWER}>{t("clinical.unknown")}</option>
      <option value="true">{t("clinical.yes")}</option>
      <option value="false">{t("clinical.no")}</option>
    </SelectField>
  );
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const number = Number(trimmed);
  return Number.isInteger(number) ? number : Number.NaN;
}

function ProfileForm({
  patientId,
  profile,
  onDone,
}: {
  patientId: string;
  profile: ClinicalProfile;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const save = useSaveClinicalProfile(patientId);
  const [draft, setDraft] = useState<ClinicalProfileInput>(() => {
    return toInput(profile);
  });
  const [height, setHeight] = useState(profile.height_cm?.toString() ?? "");
  const [weight, setWeight] = useState(profile.weight_kg?.toString() ?? "");
  const [drinks, setDrinks] = useState(profile.drinks_per_week?.toString() ?? "");
  const treatments = draft.treatments ?? [];

  const numbers = { height_cm: toNumber(height), weight_kg: toNumber(weight), drinks_per_week: toNumber(drinks) };
  const invalid = Object.values(numbers).some((n) => Number.isNaN(n));
  const badDates = treatments.some((tr) => tr.started_on && tr.ended_on && tr.ended_on < tr.started_on);

  function set<K extends keyof ClinicalProfileInput>(field: K, value: ClinicalProfileInput[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function setTreatment(index: number, changes: Partial<Treatment>) {
    set(
      "treatments",
      treatments.map((tr, i) => (i === index ? { ...tr, ...changes } : tr)),
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (invalid || badDates) return;
    save.mutate({ ...draft, ...numbers }, { onSuccess: onDone });
  }

  return (
    <form className="rf-stack" onSubmit={submit} aria-label={t("clinical.edit")}>
      <h3 className="rf-subtitle">{t("clinical.disease")}</h3>
      <div className="rf-row">
        <SelectField
          label={t("clinical.site")}
          value={draft.cancer_site ?? NO_ANSWER}
          onChange={(event) => set("cancer_site", (event.target.value || null) as CancerSite | null)}
        >
          <option value={NO_ANSWER}>{t("clinical.unknown")}</option>
          {CANCER_SITES.map((site) => (
            <option key={site} value={site}>
              {t(`clinical.sites.${site}`)}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t("clinical.diagnosedOn")}
          type="date"
          value={draft.diagnosed_on ?? ""}
          onChange={(event) => set("diagnosed_on", event.target.value || null)}
        />
        <YesNoField label={t("clinical.metastatic")} value={draft.metastatic} onChange={(v) => set("metastatic", v)} />
      </div>
      <div className="rf-row">
        <TextField
          label={t("clinical.height")}
          inputMode="numeric"
          value={height}
          onChange={(event) => setHeight(event.target.value)}
          error={Number.isNaN(numbers.height_cm) ? t("clinical.wholeNumber") : undefined}
        />
        <TextField
          label={t("clinical.weight")}
          inputMode="numeric"
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
          error={Number.isNaN(numbers.weight_kg) ? t("clinical.wholeNumber") : undefined}
        />
        <TextField
          label={t("clinical.allergies")}
          value={draft.allergies ?? ""}
          maxLength={255}
          onChange={(event) => set("allergies", event.target.value)}
        />
      </div>

      <h3 className="rf-subtitle">{t("clinical.treatments")}</h3>
      {treatments.map((treatment, index) => (
        <fieldset key={index} className="rf-fieldset">
          <legend>{t("clinical.treatmentN", { n: index + 1 })}</legend>
          <div className="rf-row">
            <SelectField
              label={t("clinical.kind")}
              value={treatment.kind}
              onChange={(event) => setTreatment(index, { kind: event.target.value as TreatmentKind })}
            >
              {TREATMENT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`clinical.kinds.${kind}`)}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={t("clinical.status")}
              value={treatment.status}
              onChange={(event) =>
                setTreatment(index, { status: event.target.value as (typeof TREATMENT_STATUSES)[number] })
              }
            >
              {TREATMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`clinical.statuses.${status}`)}
                </option>
              ))}
            </SelectField>
            <TextField
              label={t("clinical.startedOn")}
              type="date"
              value={treatment.started_on ?? ""}
              onChange={(event) => setTreatment(index, { started_on: event.target.value || null })}
            />
            <TextField
              label={t("clinical.endedOn")}
              type="date"
              value={treatment.ended_on ?? ""}
              onChange={(event) => setTreatment(index, { ended_on: event.target.value || null })}
              error={
                treatment.started_on && treatment.ended_on && treatment.ended_on < treatment.started_on
                  ? t("clinical.endBeforeStart")
                  : undefined
              }
            />
          </div>
          <TextField
            label={t("clinical.details")}
            hint={t("clinical.detailsHint")}
            value={treatment.details ?? ""}
            maxLength={255}
            onChange={(event) => setTreatment(index, { details: event.target.value })}
          />
          <div>
            <Button
              variant="secondary"
              onClick={() =>
                set(
                  "treatments",
                  treatments.filter((_, i) => i !== index),
                )
              }
            >
              {t("clinical.removeTreatment")}
            </Button>
          </div>
        </fieldset>
      ))}
      <div>
        <Button
          variant="secondary"
          disabled={treatments.length >= 20}
          onClick={() => set("treatments", [...treatments, { kind: "chemotherapy", status: "ongoing" }])}
        >
          {t("clinical.addTreatment")}
        </Button>
      </div>

      <h3 className="rf-subtitle">{t("clinical.social")}</h3>
      <div className="rf-row">
        <TextField
          label={t("clinical.occupation")}
          value={draft.occupation ?? ""}
          maxLength={255}
          onChange={(event) => set("occupation", event.target.value)}
        />
        <SelectField
          label={t("clinical.workSituation")}
          value={draft.work_situation ?? NO_ANSWER}
          onChange={(event) => set("work_situation", (event.target.value || null) as WorkSituation | null)}
        >
          <option value={NO_ANSWER}>{t("clinical.unknown")}</option>
          {WORK_SITUATIONS.map((work) => (
            <option key={work} value={work}>
              {t(`clinical.work.${work}`)}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="rf-row">
        <YesNoField
          label={t("clinical.livesAlone")}
          value={draft.lives_alone}
          onChange={(v) => set("lives_alone", v)}
        />
        <YesNoField
          label={t("clinical.hasDependants")}
          value={draft.has_dependants}
          onChange={(v) => set("has_dependants", v)}
        />
        <YesNoField
          label={t("clinical.hasCaregivers")}
          value={draft.has_caregivers}
          onChange={(v) => set("has_caregivers", v)}
        />
      </div>
      {draft.has_caregivers && (
        <TextField
          label={t("clinical.caregivers")}
          value={draft.caregivers ?? ""}
          maxLength={255}
          onChange={(event) => set("caregivers", event.target.value)}
        />
      )}

      <h3 className="rf-subtitle">{t("clinical.habits")}</h3>
      <div className="rf-row">
        <YesNoField label={t("clinical.smoker")} value={draft.smoker} onChange={(v) => set("smoker", v)} />
        <YesNoField
          label={t("clinical.drinksAlcohol")}
          value={draft.drinks_alcohol}
          onChange={(v) => set("drinks_alcohol", v)}
        />
        {draft.drinks_alcohol && (
          <TextField
            label={t("clinical.drinksPerWeek")}
            inputMode="numeric"
            value={drinks}
            onChange={(event) => setDrinks(event.target.value)}
            error={Number.isNaN(numbers.drinks_per_week) ? t("clinical.wholeNumber") : undefined}
          />
        )}
        <YesNoField
          label={t("clinical.takesSupplements")}
          value={draft.takes_supplements}
          onChange={(v) => set("takes_supplements", v)}
        />
      </div>
      <TextArea
        label={t("clinical.notes")}
        value={draft.notes ?? ""}
        maxLength={1000}
        onChange={(event) => set("notes", event.target.value)}
      />

      {save.isError && (
        <p className="rf-field__error" role="alert">
          {t("clinical.failed")}
        </p>
      )}
      <div className="rf-row">
        <Button type="submit" pending={save.isPending} disabled={invalid || badDates}>
          {t("clinical.save")}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          {t("clinical.cancel")}
        </Button>
      </div>
    </form>
  );
}

/** The structured patient file: disease and treatments, social life, habits. Care team only. */
export function ClinicalProfileSection({ patientId }: { patientId: string }) {
  const { t } = useTranslation();
  const profile = useClinicalProfile(patientId);
  const [editing, setEditing] = useState(false);

  return (
    <section className="rf-panel rf-section" aria-labelledby="clinical-title">
      <div className="rf-section-head">
        <h2 id="clinical-title" className="rf-title">
          {t("clinical.title")}
        </h2>
        {!editing && profile.data && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {profile.data.updated_at ? t("clinical.edit") : t("clinical.fill")}
          </Button>
        )}
      </div>
      <QueryState query={profile}>
        {(data) =>
          editing ? (
            <ProfileForm patientId={patientId} profile={data} onDone={() => setEditing(false)} />
          ) : data.updated_at ? (
            <>
              <Summary profile={data} />
              <p className="rf-muted">{t("clinical.updatedAt", { date: formatDate(data.updated_at) })}</p>
            </>
          ) : (
            <p className="rf-muted">{t("clinical.empty")}</p>
          )
        }
      </QueryState>
    </section>
  );
}
