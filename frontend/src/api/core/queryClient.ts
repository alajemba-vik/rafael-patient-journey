import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Revisiting a page within this window shows cached data instantly, without a refetch.
      staleTime: 30_000,
      // Retry network and server errors once; a 4xx won't fix itself.
      retry: (failureCount, error) => failureCount < 1 && !(error instanceof ApiError && error.status < 500),
    },
  },
});
