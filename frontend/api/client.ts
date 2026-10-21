import createClient, { type Middleware } from "openapi-fetch";

import type { components, paths } from "./schema";
import { session } from "./session";

export type Schemas = components["schemas"];

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** An API error with the backend's own message (`detail`). */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = session.getToken();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
  onResponse({ response }) {
    // An expired or revoked token: drop it and send the person back to the login page.
    if (response.status === 401 && session.getToken()) {
      session.end();
      window.location.assign("/connexion?session=expiree");
    }
    return response;
  },
};

// `fetch` is looked up on each call (not captured once), so tests can replace it.
export const api = createClient<paths>({ baseUrl: API_URL, fetch: (request) => fetch(request) });
api.use(authMiddleware);

/** Return the response data, or throw an ApiError carrying the backend's message. */
export async function unwrap<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await request;
  if (!response.ok) {
    const detail =
      typeof error === "object" && error !== null && "detail" in error && typeof error.detail === "string"
        ? error.detail
        : response.statusText;
    throw new ApiError(response.status, detail);
  }
  return data as T;
}
