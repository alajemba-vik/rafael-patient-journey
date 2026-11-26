import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { Goal } from "../../../lib/carePlan";
import { CarePlanFields } from "./CarePlanFields";

function Harness() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [disciplines, setDisciplines] = useState<string[]>([]);
  return (
    <CarePlanFields
      goals={goals}
      disciplines={disciplines}
      onGoalsChange={setGoals}
      onDisciplinesChange={setDisciplines}
    />
  );
}

describe("CarePlanFields", () => {
  it("allows three goals at most", async () => {
    render(<Harness />);

    for (const goal of ["Douleurs", "Estime de soi", "Bien-être"]) {
      await userEvent.click(screen.getByLabelText(goal));
    }

    expect(screen.getByLabelText("Troubles du sommeil")).toBeDisabled();
    expect(screen.getByLabelText("Douleurs")).toBeEnabled();
  });

  it("finds disciplines by name and allows five at most", async () => {
    render(<Harness />);

    await userEvent.type(screen.getByLabelText("Chercher une discipline"), "sophro");
    expect(screen.getByLabelText("Sophrologie")).toBeInTheDocument();
    expect(screen.queryByLabelText("Yoga")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Chercher une discipline"));
    for (const name of ["Yoga", "Pilates", "Reiki", "Massage", "Tuina"]) {
      await userEvent.click(screen.getByLabelText(name));
    }
    expect(screen.getByText("5 sur 5 choisies")).toBeInTheDocument();
    expect(screen.getByLabelText("Hypnose")).toBeDisabled();
  });
});
