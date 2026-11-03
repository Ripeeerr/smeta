import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  ChartPie,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Sun,
  Users,
} from "lucide-react";
import { api, post } from "../api/client";
import type { Overview, Session } from "../api/types";
import { useUser } from "../app/session";
import { Avatar, ErrorNotice, Modal } from "./UI";
import { shortDate } from "../lib/format";
import { setTheme, useTheme } from "../lib/theme";

export function ThemeToggle() {
  const theme = useTheme();
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  }
  return (
    <button
      className="icon-button"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"
      }
      title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
    >
      {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}

const links = [
  { to: "/", label: "Обзор", icon: LayoutDashboard },
  { to: "/requests", label: "Заявки", icon: ClipboardList },
  { to: "/purchases", label: "Закупки", icon: ShoppingCart },
  { to: "/suppliers", label: "Поставщики", icon: Users },
  { to: "/budgets", label: "Бюджеты", icon: ChartPie },
];

export function Layout() {
  const user = useUser();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [logoutError, setLogoutError] = useState<unknown>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const { data } = useQuery({
    queryKey: ["overview", "sidebar"],
    queryFn: () => api<Overview>("overview/"),
  });
  async function logout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const session = await post<Session>("auth/logout/");
      await client.cancelQueries();
      client.clear();
      client.setQueryData(["session"], session);
      navigate("/login", { replace: true });
    } catch (error) {
      setLogoutError(error);
    } finally {
      setLoggingOut(false);
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        К содержимому
      </a>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Закрыть меню"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <NavLink to="/" className="brand" onClick={() => setMobile(false)}>
          смета<span>.</span>
        </NavLink>
        <div className="workspace">
          <Building2 size={18} />
          <span>Студия Форма</span>
          <ChevronDown size={15} />
        </div>
        <nav className="main-nav" aria-label="Основная навигация">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              end={to === "/"}
              key={to}
              to={to}
              onClick={() => setMobile(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {to === "/requests" && data && data.counts.pending > 0 && (
                <small>{data.counts.pending}</small>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <NavLink to="/settings" onClick={() => setMobile(false)}>
            <Settings size={18} />
            Настройки
          </NavLink>
          <NavLink to="/help" onClick={() => setMobile(false)}>
            <CircleHelp size={18} />
            Помощь
          </NavLink>
          <button
            className="sidebar-user"
            onClick={() => navigate("/settings")}
          >
            <Avatar name={user.name} />
            <span>
              {user.name}
              <small>{user.role_label}</small>
            </span>
          </button>
          <button
            className="logout-button"
            disabled={loggingOut}
            onClick={logout}
          >
            <LogOut size={16} />
            {loggingOut ? "Выходим…" : "Выйти из профиля"}
          </button>
          <ErrorNotice error={logoutError} />
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="topbar-leading">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Открыть меню"
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              Рабочее пространство<span>/</span>
              <b>{user.department_name || "Все отделы"}</b>
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              onClick={() => navigate("/requests?search=")}
              aria-label="Поиск заявок"
            >
              <Search size={19} />
            </button>
            <ThemeToggle />
            <button
              className="icon-button notification-button"
              onClick={() => setNotifications(true)}
              aria-label="Последние события"
            >
              <Bell size={19} />
              {data && data.events.length > 0 && <i />}
            </button>
            <div className="topbar-divider" />
            <button
              className="profile-button"
              onClick={() => navigate("/settings")}
            >
              <Avatar name={user.name} />
              <span>{user.name}</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        <main id="main-content" className="page">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>
            смета. <i /> Закупки под контролем
          </span>
          <span>Студия Форма · {new Date().getFullYear()}</span>
        </footer>
      </div>
      {notifications && (
        <Modal
          title="Последние события"
          onClose={() => setNotifications(false)}
        >
          <div className="activity-list">
            {data?.events.length ? (
              data.events.map((event) => (
                <div key={event.id}>
                  <Avatar name={event.actor_name} />
                  <p>
                    <b>{event.actor_name}</b>
                    <span>{event.action}</span>
                    <small>{shortDate(event.created_at)}</small>
                  </p>
                </div>
              ))
            ) : (
              <p className="muted">Пока нет событий.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export function CreateLink() {
  return (
    <NavLink className="button primary" to="/requests/new">
      <Plus size={18} />
      Создать заявку
    </NavLink>
  );
}
