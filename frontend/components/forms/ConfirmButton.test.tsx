import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmButton } from "./ConfirmButton";

describe("ConfirmButton", () => {
  it("acts only after the second, explicit confirmation", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmButton question="Annuler ce rendez-vous ?" confirmLabel="Annuler le rendez-vous" onConfirm={onConfirm}>
        Annuler
      </ConfirmButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Annuler le rendez-vous" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("can be backed out of", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmButton question="Retirer ?" confirmLabel="Retirer" onConfirm={onConfirm}>
        Retirer de l’équipe
      </ConfirmButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Retirer de l’équipe" }));
    await userEvent.click(screen.getByRole("button", { name: "Retour" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Retirer de l’équipe" })).toBeInTheDocument();
  });
});
