import type { UseQueryResult } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/client";
import { QueryState } from "./QueryState";

function query<T>(state: Partial<UseQueryResult<T>>): UseQueryResult<T> {
  return { isPending: false, isError: false, refetch: vi.fn(), ...state } as UseQueryResult<T>;
}

describe("QueryState", () => {
  it("shows the data once loaded", () => {
    render(<QueryState query={query({ data: ["Alex"] })}>{(names) => <p>{names[0]}</p>}</QueryState>);

    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("shows the empty state when there is nothing to show", () => {
    render(
      <QueryState query={query<string[]>({ data: [] })} empty={{ isEmpty: (d) => d.length === 0, title: "Rien ici." }}>
        {() => <p>contenu</p>}
      </QueryState>,
    );

    expect(screen.getByText("Rien ici.")).toBeInTheDocument();
  });

  it("offers a retry when loading fails", async () => {
    const refetch = vi.fn();
    render(
      <QueryState query={query({ isError: true, error: new Error("network"), refetch })}>
        {() => <p>contenu</p>}
      </QueryState>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(refetch).toHaveBeenCalled();
  });

  it("explains a refused access instead of offering a retry", () => {
    render(
      <QueryState query={query({ isError: true, error: new ApiError(403, "Forbidden") })}>
        {() => <p>contenu</p>}
      </QueryState>,
    );

    expect(screen.getByText("Vous n’avez pas accès à cette page.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
