import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "../../../api/client";
import { QueryState } from "../../../components/feedback/QueryState";
import { PageHeader } from "../../../components/layout/PageHeader";

export function FaqPage() {
  const faq = useQuery({ queryKey: ["faq"], queryFn: () => unwrap(api.GET("/api/v1/faq")) });

  return (
    <div className="rf-narrow">
      <PageHeader title="Questions fréquentes" />
      <QueryState
        query={faq}
        empty={{ isEmpty: (categories) => categories.length === 0, title: "Aucune question publiée pour le moment." }}
      >
        {(categories) =>
          categories.map((category) => (
            <section key={category.id} className="rf-section" aria-labelledby={`faq-${category.id}`}>
              <h2 id={`faq-${category.id}`} className="rf-title">
                {category.name}
              </h2>
              {category.entries.map((entry) => (
                <details key={entry.id} className="rf-disclosure">
                  <summary>{entry.question}</summary>
                  <p className="rf-disclosure__body">{entry.answer}</p>
                </details>
              ))}
            </section>
          ))
        }
      </QueryState>
    </div>
  );
}
