import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, post } from "../api/client";
import type { Department, Requisition } from "../api/types";
import { useUser } from "../app/session";
import { ErrorNotice, Loading } from "../components/UI";
import { localDate, money } from "../lib/format";

interface DraftItem {
  key: string;
  name: string;
  quantity: number;
  unit_price: string;
}
const blankItem = (): DraftItem => ({
  key: crypto.randomUUID(),
  name: "",
  quantity: 1,
  unit_price: "",
});

export function RequestForm() {
  const { id } = useParams();
  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: () => api<Department[]>("departments/"),
  });
  const request = useQuery({
    queryKey: ["requisition", id],
    queryFn: () => api<Requisition>(`requisitions/${id}/`),
    enabled: Boolean(id),
  });
  if (departments.isPending || (id && request.isPending)) return <Loading />;
  if (departments.error || request.error)
    return <ErrorNotice error={departments.error || request.error} />;
  return (
    <Editor departments={departments.data || []} existing={request.data} />
  );
}

function Editor({
  departments,
  existing,
}: {
  departments: Department[];
  existing?: Requisition;
}) {
  const user = useUser();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [items, setItems] = useState<DraftItem[]>(
    existing?.items.map((i) => ({ ...i, key: String(i.id) })) || [blankItem()],
  );
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const total =
    items.reduce(
      (sum, item) =>
        sum + Math.round(Number(item.unit_price || 0) * 100) * item.quantity,
      0,
    ) / 100;
  function update(key: string, data: Partial<DraftItem>) {
    setItems((old) =>
      old.map((item) => (item.key === key ? { ...item, ...data } : item)),
    );
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const payload = {
      title: data.get("title"),
      description: data.get("description"),
      department: Number(data.get("department")),
      needed_by: data.get("needed_by"),
      items: items.map(({ name, quantity, unit_price }) => ({
        name,
        quantity,
        unit_price,
      })),
    };
    try {
      const result = existing
        ? await api<Requisition>(`requisitions/${existing.id}/`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await post<Requisition>("requisitions/", payload);
      await client.invalidateQueries({ queryKey: ["requisitions"] });
      await client.invalidateQueries({ queryKey: ["requisition"] });
      navigate(`/requests/${result.id}`);
    } catch (reason) {
      setError(reason);
    } finally {
      setPending(false);
    }
  }
  if (
    existing &&
    (existing.author !== user.id ||
      !["draft", "returned"].includes(existing.status))
  )
    return (
      <ErrorNotice
        error={new Error("Эту заявку сейчас нельзя редактировать.")}
      />
    );
  return (
    <>
      <Link
        className="back-link"
        to={existing ? `/requests/${existing.id}` : "/requests"}
      >
        <ArrowLeft size={16} />К заявкам
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            Сначала — потребность, затем — решение
          </span>
          <h1>{existing ? "Редактировать заявку" : "Новая заявка"}</h1>
          <p>
            Сохраните черновик, проверьте детали и отправьте на согласование.
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="request-form-grid">
        <section className="panel form-panel">
          <div className="panel-heading">
            <h2>Основная информация</h2>
            <span className="muted">Шаг 1 из 2</span>
          </div>
          <label>
            Что нужно закупить
            <input
              name="title"
              required
              maxLength={180}
              defaultValue={existing?.title}
              placeholder="Например, мониторы для отдела продаж"
            />
          </label>
          <div className="form-two-col">
            <label>
              Отдел
              <select
                name="department"
                required
                defaultValue={
                  existing?.department || user.department || departments[0]?.id
                }
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Нужно получить к
              <input
                type="date"
                name="needed_by"
                required
                min={localDate()}
                defaultValue={existing?.needed_by}
              />
            </label>
          </div>
          <label>
            Обоснование
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={4000}
              rows={4}
              defaultValue={existing?.description}
              placeholder="Для чего нужна закупка и какие требования важно учесть"
            />
          </label>
          <div className="form-section-heading">
            <h2>Состав закупки</h2>
            <span className="muted">До 50 позиций</span>
          </div>
          <div className="item-editor">
            {items.map((item, index) => (
              <div key={item.key} className="item-editor-row">
                <label>
                  Позиция {index + 1}
                  <input
                    required
                    maxLength={180}
                    value={item.name}
                    placeholder="Наименование"
                    onChange={(e) => update(item.key, { name: e.target.value })}
                  />
                </label>
                <label>
                  Кол-во
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    required
                    value={item.quantity}
                    onChange={(e) =>
                      update(item.key, { quantity: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Цена, ₽
                  <input
                    type="number"
                    min="0.01"
                    max="9999999999.99"
                    step="0.01"
                    required
                    value={item.unit_price}
                    placeholder="0,00"
                    onChange={(e) =>
                      update(item.key, { unit_price: e.target.value })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="icon-button remove-item"
                  disabled={items.length === 1}
                  aria-label={`Удалить позицию ${index + 1}`}
                  onClick={() =>
                    setItems((old) => old.filter((i) => i.key !== item.key))
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="button secondary add-item"
            disabled={items.length >= 50}
            onClick={() => setItems((old) => [...old, blankItem()])}
          >
            <Plus size={16} />
            Добавить позицию
          </button>
          <ErrorNotice error={error} />
          <div className="form-actions">
            <Link to="/requests" className="button secondary">
              Отмена
            </Link>
            <button className="button primary" disabled={pending}>
              {pending
                ? "Сохраняем…"
                : existing
                  ? "Сохранить изменения"
                  : "Сохранить черновик"}
            </button>
          </div>
        </section>
        <aside className="form-aside">
          <div className="panel form-total">
            <span className="eyebrow">Ориентировочная стоимость</span>
            <strong>{money(total)}</strong>
            <p>{items.length} поз. · уточняется при выборе поставщика</p>
            <div className="info-rule" />
            <h3>Что будет дальше</h3>
            <ol className="next-steps">
              <li>
                <span>1</span>Проверьте сохранённый черновик
              </li>
              <li>
                <span>2</span>Приложите файлы с требованиями
              </li>
              <li>
                <span>3</span>Отправьте руководителю отдела
              </li>
            </ol>
          </div>
          <p className="aside-note">
            Средства резервируются только после согласования. Создание черновика
            не влияет на бюджет.
          </p>
        </aside>
      </form>
    </>
  );
}
