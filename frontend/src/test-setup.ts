import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import { i18n } from "./i18n";

// Tests read the French texts, whatever language the machine running them uses.
void i18n.changeLanguage("fr");

// Unmount what each test rendered, so tests never see each other's pages.
afterEach(cleanup);
