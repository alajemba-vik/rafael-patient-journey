import { usePublishedFaq } from "../../../api/faq";
import { QueryState } from "../../../components/feedback/QueryState";
import { PageHeader } from "../../../components/layout/PageHeader";

export function FaqPage() {
  const faq = usePublishedFaq();

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <PageHeader title="Questions fréquentes" />

      <p className="rf-lead" style={{ color: "var(--ink-muted)", marginBottom: "var(--space-6)" }}>
        Retrouvez ici les réponses aux questions les plus courantes. Cliquez sur une question pour afficher la réponse.
      </p>

      <QueryState
        query={faq}
        empty={{ isEmpty: (categories) => categories.length === 0, title: "Aucune question publiée pour le moment." }}
      >
        {(categories) =>
          categories.map((category) => (
            <section key={category.id} className="rf-section" aria-labelledby={`faq-${category.id}`}>
              <h2
                id={`faq-${category.id}`}
                className="rf-title"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  marginBottom: "var(--space-4)",
                  fontSize: "22px",
                }}
              >
                <span aria-hidden="true">💡</span> {category.name}
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {category.entries.map((entry) => (
                  <details key={entry.id} className="rf-disclosure">
                    <summary>{entry.question}</summary>
                    <div className="rf-disclosure__body">{entry.answer}</div>
                  </details>
                ))}
              </div>
            </section>
          ))
        }
      </QueryState>
    </div>
  );
}
