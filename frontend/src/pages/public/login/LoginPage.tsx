import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router";

import { useLogin } from "../../../api/identity_access";
import { ApiError } from "../../../api/core/client";
import { session } from "../../../api/core/session";
import { Button } from "../../../components/forms/Button";
import { TextField } from "../../../components/forms/TextField";
import { PageHeader } from "../../../components/layout/PageHeader";
import { paths } from "../../../app/paths";

export function LoginPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const from = (location.state as { from?: string } | null)?.from ?? paths.home;
  const login = useLogin();

  if (session.getToken()) return <Navigate to={paths.home} replace />;

  function submit(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email, password }, { onSuccess: () => navigate(from, { replace: true }) });
  }

  const status = login.error instanceof ApiError ? login.error.status : undefined;
  const error =
    status === 401
      ? "E-mail ou mot de passe incorrect."
      : status === 429
        ? "Trop de tentatives. Patientez une minute, puis réessayez."
        : login.isError
          ? "Connexion impossible pour le moment. Réessayez dans un instant."
          : undefined;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
      }}
    >
      <div
        className="rf-panel"
        style={{
          maxWidth: "450px",
          width: "100%",
          padding: "var(--space-7)",
          borderTop: "6px solid var(--accent)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "32px",
            textAlign: "center",
            marginBottom: "var(--space-6)",
          }}
        >
          Connexion
        </h1>

        {params.get("session") === "expiree" && (
          <p className="rf-banner" role="status" style={{ background: "var(--accent-doux)" }}>
            Votre session a expiré. Reconnectez-vous.
          </p>
        )}

        <form className="rf-form" onSubmit={submit} style={{ width: "100%" }}>
          <TextField
            label="Adresse e-mail"
            type="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={error}
          />

          <div style={{ width: "100%", marginTop: "var(--space-4)" }}>
            <Button type="submit" pending={login.isPending} style={{ width: "100%" }}>
              Se connecter
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
