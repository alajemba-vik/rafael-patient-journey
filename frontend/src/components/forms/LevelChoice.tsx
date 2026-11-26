import { useId } from "react";

import { LEVELS } from "../../lib/sessionLevels";

type Props = {
  legend: string;
  /** One label per level, 0 to 4. */
  labels: readonly string[];
  value: number | null;
  onChange: (value: number) => void;
};

/** A 0–4 scale as five labelled radio buttons, the way the Institute's grids are filled. */
export function LevelChoice({ legend, labels, value, onChange }: Props) {
  const name = useId();
  return (
    <fieldset className="rf-question">
      <legend>{legend}</legend>
      <div className="rf-choices">
        {LEVELS.map((level) => (
          <label key={level} className="rf-choice">
            <input type="radio" name={name} value={level} checked={value === level} onChange={() => onChange(level)} />
            <span>{labels[level]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
