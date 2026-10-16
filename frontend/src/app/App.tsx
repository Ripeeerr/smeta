import { Component, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { SessionProvider, useSession } from "./session";
import { Layout } from "../components/Layout";
import { ErrorNotice, Loading } from "../components/UI";
import { Overview } from "../pages/Overview";
import { Login } from "../pages/Login";
import { Requests } from "../pages/Requests";
import { RequestForm } from "../pages/RequestForm";
import { RequestDetail } from "../pages/RequestDetail";
import { Suppliers } from "../pages/Suppliers";
import { Budgets } from "../pages/Budgets";
import { Help, Settings } from "../pages/Settings";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="fatal-error">
        <h1>Не удалось открыть страницу</h1>
        <p>Обновите приложение. Ваши сохранённые данные останутся на месте.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Обновить страницу
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

function Workspace() {
  const session = useSession();
  if (session.isPending) return <Loading />;
  if (session.error)
    return (
      <div className="fatal-error">
        <ErrorNotice error={session.error} />
        <button className="button primary" onClick={() => session.refetch()}>
          Попробовать снова
        </button>
      </div>
    );
  if (!session.data?.user) return <Navigate to="/login" replace />;
  return (
    <SessionProvider user={session.data.user}>
      <Layout />
    </SessionProvider>
  );
}

export function App() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Смета — закупки под контролем";
    const target = document.querySelector<HTMLElement>("h1, main");
    if (target && !document.querySelector("dialog[open]")) {
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
  }, [location.pathname]);
  return (
    <ErrorBoundary key={location.pathname}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Workspace />}>
          <Route index element={<Overview />} />
          <Route path="requests" element={<Requests />} />
          <Route path="requests/new" element={<RequestForm />} />
          <Route path="requests/:id" element={<RequestDetail />} />
          <Route path="requests/:id/edit" element={<RequestForm />} />
          <Route path="purchases" element={<Requests purchasing />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="budgets" element={<Budgets />} />
          <Route path="settings" element={<Settings />} />
          <Route path="help" element={<Help />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
