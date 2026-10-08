import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Pencil, Plus } from "lucide-react";
import { api, post } from "../api/client";
import type { Budget, Department } from "../api/types";
import { useUser } from "../app/session";
import { Empty, ErrorNotice, Loading, Modal } from "../components/UI";
import { money, monthKey } from "../lib/format";

export function Budgets() {
  const user = useUser();
  const client = useQueryClient();
  const [month, setMonth] = useState(monthKey());
  const [editing, setEditing] = useState<Budget | "new" | null>(null);
  const { data, error, isPending } = useQuery({
    queryKey: ["budgets", month],
    queryFn: () => api<Budget[]>(`budgets/?month=${month}`),
  });
  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: () => api<Department[]>("departments/"),
  });
  const mutation = useMutation({
    mutationFn: (payload: unknown) => post("budgets/", payload),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["budgets"] }),
        client.invalidateQueries({ queryKey: ["overview"] }),
      ]);
      setEditing(null);
    },
  });
  const existing = editing && editing !== "new" ? editing : null;
  const totals = (data || []).reduce(
    (a, b) => ({
      limit: a.limit + Number(b.limit),
      spent: a.spent + Number(b.spent),
      reserved: a.reserved + Number(b.reserved),
      available: a.available + Number(b.available),
    }),
    { limit: 0, spent: 0, reserved: 0, available: 0 },
  );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    mutation.mutate({
      department: Number(f.get("department")),
      month: `${month}-01`,
      limit: f.get("limit"),
    });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Планирование и контроль расходов</span>
          <h1>Бюджеты</h1>
          <p>
            У каждого отдела — свой лимит. У каждой закупки — учтённая сумма.
          </p>
        </div>
        <div className="heading-actions">
          <label className="month-picker">
            <CalendarDays size={17} />
            <input
              aria-label="Месяц бюджета"
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
          </label>
          {user.role === "admin" && (
            <button
              className="button primary"
              onClick={() => {
                mutation.reset();
                setEditing("new");
              }}
            >
              <Plus size={16} />
              Настроить лимит
            </button>
          )}
        </div>
      </div>
      <div className="budget-summary-strip">
        {[
          ["Общий бюджет", totals.limit],
          ["Потрачено", totals.spent],
          ["В резерве", totals.reserved],
          ["Доступно", totals.available],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{money(value)}</strong>
          </div>
        ))}
      </div>
      {isPending ? (
        <Loading />
      ) : error ? (
        <ErrorNotice error={error} />
      ) : data?.length ? (
        <div className="budget-departments">
          {data.map((b) => {
            const spent = Number(b.limit)
              ? (Number(b.spent) / Number(b.limit)) * 100
              : 0;
            const reserved = Number(b.limit)
              ? (Number(b.reserved) / Number(b.limit)) * 100
              : 0;
            return (
              <section className="panel department-budget" key={b.id}>
                <div className="panel-heading">
                  <h2>{b.department_name}</h2>
                  {user.role === "admin" && (
                    <button
                      className="icon-button"
                      aria-label={`Изменить лимит: ${b.department_name}`}
                      onClick={() => {
                        mutation.reset();
                        setEditing(b);
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                </div>
                <div className="department-available">
                  <span>Доступно для закупок</span>
                  <strong>{money(b.available)}</strong>
                </div>
                <div className="allocation-bar">
                  <i style={{ width: `${spent}%` }} />
                  <i style={{ width: `${reserved}%` }} />
                </div>
                <div className="department-ledger">
                  <span>
                    Потрачено<b>{money(b.spent)}</b>
                  </span>
                  <span>
                    В резерве<b>{money(b.reserved)}</b>
                  </span>
                  <span>
                    Лимит месяца<b>{money(b.limit)}</b>
                  </span>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Бюджет на этот месяц не настроен"
          text="Руководитель компании может установить лимиты для отделов."
        />
      )}
      <div className="budget-explainer">
        <h3>Как учитываются средства</h3>
        <p>
          Согласование заявки создаёт резерв. При оформлении закупки резерв
          становится расходом по фактической цене предложения. Отмена
          освобождает резерв. Остаток автоматически возвращается в доступные
          средства.
        </p>
      </div>
      {editing && (
        <Modal title="Лимит бюджета" onClose={() => setEditing(null)}>
          <form onSubmit={submit}>
            <p className="muted">
              Месяц:{" "}
              {new Intl.DateTimeFormat("ru-RU", {
                month: "long",
                year: "numeric",
              }).format(new Date(`${month}-15T12:00:00`))}
            </p>
            <label>
              Отдел
              <select
                name="department"
                required
                defaultValue={existing?.department}
              >
                <option value="">Выберите отдел</option>
                {departments.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Месячный лимит, ₽
              <input
                type="number"
                name="limit"
                required
                min={
                  existing
                    ? Number(existing.spent) + Number(existing.reserved)
                    : 0
                }
                max="999999999999.99"
                step="0.01"
                defaultValue={existing?.limit}
              />
            </label>
            <p className="field-help">
              Лимит нельзя уменьшить ниже суммы расходов и резервов. Изменение
              существующего бюджета заменит его лимит.
            </p>
            <ErrorNotice error={mutation.error} />
            <button
              className="button primary full-width"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Сохраняем…" : "Сохранить лимит"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
