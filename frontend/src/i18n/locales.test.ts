import { describe, expect, it } from "vitest";

import { resources } from ".";

/** Every [key path, text] in a nested translation file. */
function leavesOf(tree: object, prefix = ""): [string, unknown][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "object" && value !== null ? leavesOf(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]],
  );
}

/** Key paths with plural forms folded into their base key: languages have different plural forms. */
function keysOf(tree: object): Set<string> {
  return new Set(leavesOf(tree).map(([key]) => key.replace(/_(zero|one|two|few|many|other)$/, "")));
}

const others = Object.keys(resources).filter((language) => language !== "fr") as (keyof typeof resources)[];

describe("translations", () => {
  const french = keysOf(resources.fr.translation);

  it.each(others)("%s has exactly the French keys", (language) => {
    const other = keysOf(resources[language].translation);

    expect([...french].filter((key) => !other.has(key))).toEqual([]);
    expect([...other].filter((key) => !french.has(key))).toEqual([]);
  });

  it("has no empty text", () => {
    const empty = Object.entries(resources).flatMap(([language, { translation }]) =>
      leavesOf(translation)
        .filter(([, text]) => typeof text !== "string" || text.trim() === "")
        .map(([key]) => `${language}:${key}`),
    );

    expect(empty).toEqual([]);
  });
});
