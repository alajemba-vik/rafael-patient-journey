import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router";

import { useLogin } from "../../../api/auth";
import { ApiError } from "../../../api/client";
import { session } from "../../../api/session";
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

  const error =
    login.error instanceof ApiError && login.error.status === 401
      ? "E-mail ou mot de passe incorrect."
      : login.isError
        ? "Connexion impossible pour le moment. Réessayez dans un instant."
        : undefined;

  return (
    <div className="rf-narrow">
      <PageHeader title="Connexion" />
      {params.get("session") === "expiree" && (
        <p className="rf-banner" role="status">
          Votre session a expiré. Reconnectez-vous pour continuer.
        </p>
      )}
      <form className="rf-form" onSubmit={submit}>
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
        <Button type="submit" pending={login.isPending}>
          Se connecter
        </Button>
      </form>
    </div>
  );
}
