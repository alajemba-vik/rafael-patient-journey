import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";

export type FaqCategory = Schemas["CategoryOut"];
export type FaqEntry = Schemas["EntryOut"];

const FAQ = ["faq"] as const;

export function useFaqCategories() {
  return useQuery({ queryKey: [...FAQ, "categories"], queryFn: () => unwrap(api.GET("/api/v1/faq/categories")) });
}

export function useFaqEntries() {
  return useQuery({ queryKey: [...FAQ, "entries"], queryFn: () => unwrap(api.GET("/api/v1/faq/entries")) });
}

/** Every FAQ change refreshes the admin lists and the public FAQ. */
function useFaqMutation<T, R>(mutationFn: (input: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => void queryClient.invalidateQueries({ queryKey: FAQ }) });
}

export const useCreateCategory = () =>
  useFaqMutation((body: Schemas["CategoryCreate"]) => unwrap(api.POST("/api/v1/faq/categories", { body })));

export const useDeleteCategory = () =>
  useFaqMutation((id: string) =>
    unwrap(api.DELETE("/api/v1/faq/categories/{category_id}", { params: { path: { category_id: id } } })),
  );

export const useCreateEntry = () =>
  useFaqMutation((body: Schemas["EntryCreate"]) => unwrap(api.POST("/api/v1/faq/entries", { body })));

export const useUpdateEntry = () =>
  useFaqMutation(({ id, body }: { id: string; body: Schemas["EntryUpdate"] }) =>
    unwrap(api.PATCH("/api/v1/faq/entries/{entry_id}", { params: { path: { entry_id: id } }, body })),
  );

export const useDeleteEntry = () =>
  useFaqMutation((id: string) =>
    unwrap(api.DELETE("/api/v1/faq/entries/{entry_id}", { params: { path: { entry_id: id } } })),
  );
