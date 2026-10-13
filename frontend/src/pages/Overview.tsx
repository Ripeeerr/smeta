import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Overview as OverviewData, Requisition } from "../api/types";
import { useUser } from "../app/session";
import { CreateLink } from "../components/Layout";
import { RequestTable } from "../components/RequestTable";
import { Avatar, Empty, ErrorNotice, Loading } from "../components/UI";
import { money, monthKey, shortDate } from "../lib/format";

export function Overview() {
  const user = useUser();
  const [month, setMonth] = useState(monthKey());
  const { data, error, isPending } = useQuery({
    queryKey: ["overview", month],
    queryFn: () => api<OverviewData>(`overview/?month=${month}`),
  });
  const requests = useQuery({
    queryKey: ["requisitions"],
    queryFn: () => api<Requisition[]>("requisitions/"),
  });
  if (isPending || requests.isPending) return <Loading />;
  if (!data || !requests.data)
    return <ErrorNotice error={error || requests.error} />;
  const { totals } = data;
  const percent = (value: number) =>
    totals.limit ? Math.round((value / totals.limit) * 100) : 0;
  const spent = percent(Number(totals.spent));
  const reserved = percent(Number(totals.reserved));
  return (
    <>
      <div className="page-heading">
        <div className="heading-with-month">
          <h1>Обзор</h1>
          <label className="month-picker">
            <CalendarDays size={17} />
            <input
              type="month"
              aria-label="Месяц бюджета"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
          </label>
        </div>
        <CreateLink />
      </div>
      <div className="overview-grid">
        <section className="panel budget-overview">
          <div className="section-kicker">
            <h2>Бюджет на закупки</h2>
            <span>{user.department_name || "Все отделы"}</span>
          </div>
          <div className="budget-body">
            <div className="budget-details">
              <strong className="budget-total">{money(totals.limit)}</strong>
              <p className="muted">
                {new Intl.DateTimeFormat("ru-RU", {
                  month: "long",
                  year: "numeric",
                }).format(new Date(`${month}-15T12:00:00`))}{" "}
                · Студия Форма
              </p>
              <div className="budget-legend">
                <div>
                  <span className="legend-dot spent" />
                  <span>Потрачено</span>
                  <b>{money(totals.spent)}</b>
                  <small>{spent}%</small>
                </div>
                <div>
                  <span className="legend-dot reserved" />
                  <span>Зарезервировано</span>
                  <b>{money(totals.reserved)}</b>
                  <small>{reserved}%</small>
                </div>
                <div>
                  <span className="legend-dot available" />
                  <span>Доступно</span>
                  <b>{money(totals.available)}</b>
                  <small>{percent(Number(totals.available))}%</small>
                </div>
              </div>
            </div>
            <div className="donut-wrap">
              <div
                className="budget-donut"
                role="img"
                aria-label={`Потрачено ${spent}%, зарезервировано ${reserved}%, доступно ${percent(Number(totals.available))}%`}
                style={{
                  background: `conic-gradient(var(--chart-spent) 0 ${spent}%, var(--chart-reserved) ${spent}% ${spent + reserved}%, var(--chart-available) ${spent + reserved}% 100%)`,
                }}
              >
                <div>
                  <strong>
                    {percent(Number(totals.available))}
                    <span>%</span>
                  </strong>
                  <small>бюджета доступно</small>
                </div>
              </div>
              <span className="donut-caption">Лимит под контролем</span>
            </div>
          </div>
        </section>
        <section className="panel approvals-panel">
          <div className="panel-heading">
            <h2>
              {["admin", "manager"].includes(user.role)
                ? "Согласования"
                : "Ожидают решения"}
            </h2>
            <Link to="/requests?status=pending" className="text-link">
              Все <span>{data.counts.pending}</span>
              <ChevronRight size={15} />
            </Link>
          </div>
          {data.pending.length ? (
            <div className="approvals">
              {data.pending.map((req) => (
                <Link to={`/requests/${req.id}`} key={req.id}>
                  <Avatar name={req.author_name} />
                  <span>
                    <strong>{req.title}</strong>
                    <small>
                      {req.number} · {money(req.total)}
                    </small>
                  </span>
                  <span className="approval-date">
                    до {shortDate(req.needed_by)}
                    <ArrowRight size={14} />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="Всё согласовано"
              text="Новые заявки появятся здесь."
            />
          )}
          <div className="approval-foot">
            <span className="live-dot" />
            Актуальные заявки ваших отделов
          </div>
        </section>
      </div>
      <RequestTable requests={requests.data} />
      <div className="overview-bottom">
        <span>
          <i className="live-dot" />
          Данные из рабочего пространства
        </span>
        <Link className="text-link" to="/budgets">
          Бюджеты отделов <ArrowRight size={14} />
        </Link>
      </div>
    </>
  );
}
