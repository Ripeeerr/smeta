import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { post } from "../api/client";
import type { Session } from "../api/types";
import { useSession } from "../app/session";
import { ThemeToggle } from "../components/Layout";
import { ErrorNotice } from "../components/UI";

export function Login() {
  const session = useSession();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  if (session.data?.user) return <Navigate to="/" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const result = await post<Session>("auth/login/", {
        username: data.get("username"),
        password: data.get("password"),
      });
      client.setQueryData(["session"], result);
      navigate("/", { replace: true });
    } catch (reason) {
      setError(reason);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-brand brand">
        смета<span>.</span>
      </div>
      <div className="login-theme">
        <ThemeToggle />
      </div>
      <section className="login-story">
        <span className="eyebrow">Финансовый порядок начинается здесь</span>
        <h1>
          У каждой закупки
          <br />
          есть своё место<span>.</span>
        </h1>
        <p>
          Заявки, согласования и бюджет вашей команды — в одном рабочем
          пространстве.
        </p>
        <div className="login-ledger">
          <div>
            <span>01</span>
            <b>Заявка</b>
            <small>Что нужно вашей команде</small>
          </div>
          <div>
            <span>02</span>
            <b>Решение</b>
            <small>В пределах согласованного бюджета</small>
          </div>
          <div>
            <span>03</span>
            <b>Поставка</b>
            <small>Всё получено и учтено</small>
          </div>
        </div>
        <span className="login-signature">
          Меньше переписок. Больше ясности.
        </span>
      </section>
      <section className="login-form-wrap">
        <div className="login-form">
          <span className="login-lock">
            <LockKeyhole size={22} />
          </span>
          <h2>Войти в пространство</h2>
          <p>Используйте учётную запись вашей компании.</p>
          <form onSubmit={submit}>
            <label>
              Логин
              <input
                name="username"
                autoComplete="username"
                required
                maxLength={150}
                placeholder="Ваш логин"
                autoFocus
              />
            </label>
            <label>
              Пароль
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                maxLength={256}
                placeholder="Введите пароль"
              />
            </label>
            <ErrorNotice error={error || session.error} />
            <button
              className="button primary"
              disabled={pending || !session.data}
            >
              {pending ? "Входим…" : "Войти"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="login-help">
            Нет доступа? Обратитесь к администратору вашей компании.
          </p>
        </div>
        <div className="login-company">
          Студия Форма <span>Защищённое рабочее пространство</span>
        </div>
      </section>
    </div>
  );
}
