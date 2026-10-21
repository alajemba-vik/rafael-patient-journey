import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ApiError } from "../../api/client";
import { EmptyState, ErrorState, LoadingState, NotAllowedState } from "./states";

type Props<T> = {
  query: UseQueryResult<T>;
  /** Shown instead of the content when `isEmpty(data)` is true. */
  empty?: { isEmpty: (data: T) => boolean; title: string; children?: ReactNode };
  loading?: ReactNode;
  children: (data: T) => ReactNode;
};

/** One place that turns a query's status into the loading, error, not-allowed, empty or data view. */
export function QueryState<T>({ query, empty, loading, children }: Props<T>) {
  if (query.isPending) return loading ?? <LoadingState />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 403) return <NotAllowedState />;
    return <ErrorState onRetry={() => void query.refetch()} />;
  }
  if (empty?.isEmpty(query.data)) {
    return <EmptyState title={empty.title}>{empty.children}</EmptyState>;
  }
  return <>{children(query.data)}</>;
}
