import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router";

import { useLogin } from "../../../api/identity_access";
import { ApiError } from "../../../api/core/client";
import { session } from "../../../api/core/session";
import { Button } from "../../../components/forms/Button";
import { TextField } from "../../../components/forms/TextField";
import { paths } from "../../../app/paths";

export function LoginPage() {
  const { t } = useTranslation();
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
      ? t("login.errorCredentials")
      : status === 429
        ? t("login.errorTooMany")
        : login.isError
          ? t("login.errorUnavailable")
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
          {t("login.title")}
        </h1>

        {params.get("session") === "expiree" && (
          <p className="rf-banner" role="status" style={{ background: "var(--accent-doux)" }}>
            {t("login.expired")}
          </p>
        )}

        <form className="rf-form" onSubmit={submit} style={{ width: "100%" }}>
          <TextField
            label={t("login.email")}
            type="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label={t("login.password")}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={error}
          />

          <div style={{ width: "100%", marginTop: "var(--space-4)" }}>
            <Button type="submit" pending={login.isPending} style={{ width: "100%" }}>
              {t("login.submit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
