import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { i18n } from "../../i18n";
import { NotAllowedState } from "../feedback/states";
import { LanguageSwitcher } from "./LanguageSwitcher";

describe("LanguageSwitcher", () => {
  afterEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage("fr");
  });

  it("switches the interface to English and remembers the choice", async () => {
    render(
      <>
        <LanguageSwitcher />
        <NotAllowedState />
      </>,
    );
    expect(screen.getByText("Vous n’avez pas accès à cette page.")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Langue"), "en");

    expect(screen.getByText("You don’t have access to this page.")).toBeInTheDocument();
    expect(screen.getByLabelText("Language")).toHaveValue("en");
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem("rafael.language")).toBe("en");
  });
});
