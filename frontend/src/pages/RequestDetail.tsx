import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Download,
  FileText,
  PackageCheck,
  Pencil,
  Plus,
  Send,
  Upload,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api, post } from "../api/client";
import type { Requisition, Supplier } from "../api/types";
import { useUser } from "../app/session";
import {
  Avatar,
  ErrorNotice,
  Loading,
  Modal,
  StatusBadge,
} from "../components/UI";
import { localDate, longDate, money, shortDate } from "../lib/format";

type DialogKind =
  "return" | "reject" | "quote" | "order" | "receive" | "cancel" | null;

export function RequestDetail() {
  const { id } = useParams();
  const client = useQueryClient();
  const user = useUser();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [comment, setComment] = useState("");
  const req = useQuery({
    queryKey: ["requisition", id],
    queryFn: () => api<Requisition>(`requisitions/${id}/`),
  });
  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api<Supplier[]>("suppliers/"),
  });
  const mutation = useMutation({
    mutationFn: ({ action, data }: { action: string; data?: unknown }) =>
      post(`requisitions/${id}/${action}/`, data),
    onSuccess: async () => {
      setDialog(null);
      setComment("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["requisition"] }),
        client.invalidateQueries({ queryKey: ["requisitions"] }),
        client.invalidateQueries({ queryKey: ["overview"] }),
        client.invalidateQueries({ queryKey: ["budgets"] }),
      ]);
    },
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.set("file", file);
      return api(`requisitions/${id}/attachments/`, { method: "POST", body });
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["requisition", id] }),
  });
  if (req.isPending) return <Loading />;
  if (!req.data) return <ErrorNotice error={req.error} />;
  const r = req.data;
  const editable =
    r.author === user.id && ["draft", "returned"].includes(r.status);
  const approver =
    ["admin", "manager"].includes(user.role) &&
    r.author !== user.id &&
    r.status === "pending";
  const buyer = ["admin", "buyer"].includes(user.role);
  const receiver = buyer || r.author === user.id;
  const cancellable =
    ["draft", "pending", "returned", "approved"].includes(r.status) &&
    (buyer || r.author === user.id);
  function open(kind: DialogKind) {
    mutation.reset();
    setDialog(kind);
  }
  function submitDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    if (dialog === "return" || dialog === "reject")
      mutation.mutate({
        action: "decision",
        data: { decision: dialog, comment: f.get("comment") },
      });
    if (dialog === "quote")
      mutation.mutate({
        action: "quotes",
        data: {
          supplier: Number(f.get("supplier")),
          amount: f.get("amount"),
          delivery_days: Number(f.get("delivery_days")),
          notes: f.get("notes"),
        },
      });
    if (dialog === "order")
      mutation.mutate({
        action: "order",
        data: {
          quote_id: Number(f.get("quote_id")),
          expected_on: f.get("expected_on"),
        },
      });
    if (dialog === "receive")
      mutation.mutate({
        action: "receive",
        data: {
          items: r.items
            .map((i) => ({ id: i.id, quantity: Number(f.get(`item-${i.id}`)) }))
            .filter((i) => i.quantity > 0),
        },
      });
    if (dialog === "cancel") mutation.mutate({ action: "cancel" });
  }
  const dialogTitles: Record<Exclude<DialogKind, null>, string> = {
    return: "Вернуть на доработку",
    reject: "Отклонить заявку",
    quote: "Предложение поставщика",
    order: "Оформить закупку",
    receive: "Получение товаров",
    cancel: "Отменить заявку",
  };
  return (
    <>
      <Link to="/requests" className="back-link">
        <ArrowLeft size={16} />
        Все заявки
      </Link>
      <div className="detail-heading">
        <div>
          <div className="detail-number">
            <span>{r.number}</span>
            <StatusBadge status={r.status} />
          </div>
          <h1>{r.title}</h1>
          <div className="detail-author">
            <Avatar name={r.author_name} />
            <span>
              {r.author_name}
              <small>{r.department_name}</small>
            </span>
            <span className="muted">Создана {shortDate(r.created_at)}</span>
          </div>
        </div>
        {editable && (
          <Link to={`/requests/${r.id}/edit`} className="button secondary">
            <Pencil size={16} />
            Редактировать
          </Link>
        )}
      </div>
      <ErrorNotice error={!dialog && mutation.error} />
      <div className="detail-grid">
        <div className="detail-primary">
          <section className="panel detail-content">
            <h2>Обоснование закупки</h2>
            <p className="description-text">{r.description}</p>
            <div className="detail-section">
              <div className="panel-heading">
                <h2>Состав закупки</h2>
                <span className="muted">{r.items.length} поз.</span>
              </div>
              <div className="table-scroll">
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>Наименование</th>
                      <th>Количество</th>
                      <th className="numeric">Цена</th>
                      <th className="numeric">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.name}
                          {r.status === "ordered" && (
                            <small className="table-author">
                              Получено {item.received_quantity} из{" "}
                              {item.quantity}
                            </small>
                          )}
                        </td>
                        <td>{item.quantity} шт.</td>
                        <td className="numeric nowrap">
                          {money(item.unit_price)}
                        </td>
                        <td className="numeric nowrap">{money(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="items-total">
                <span>Итого по заявке</span>
                <strong>{money(r.total)}</strong>
              </div>
            </div>
            <div className="detail-section">
              <div className="panel-heading">
                <h2>Предложения поставщиков</h2>
                {buyer && r.status === "approved" && (
                  <button
                    className="button secondary small-button"
                    onClick={() => open("quote")}
                  >
                    <Plus size={15} />
                    Добавить
                  </button>
                )}
              </div>
              {r.quotes.length ? (
                <div className="quote-list">
                  {r.quotes.map((q) => (
                    <div
                      key={q.id}
                      className={
                        r.purchase?.supplier_name === q.supplier_name
                          ? "chosen-quote"
                          : ""
                      }
                    >
                      <span className="supplier-monogram">
                        {q.supplier_name
                          .replace("ООО ", "")
                          .replace(/[«»]/g, "")
                          .slice(0, 1)}
                      </span>
                      <div>
                        <b>{q.supplier_name}</b>
                        <small>
                          Доставка: {q.delivery_days} дн.
                          {q.notes && ` · ${q.notes}`}
                        </small>
                      </div>
                      <strong>{money(q.amount)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="section-empty">
                  Предложения добавит закупщик после согласования заявки.
                </p>
              )}
            </div>
            <div className="detail-section">
              <div className="panel-heading">
                <h2>Вложения</h2>
                {editable && (
                  <label
                    className={`button secondary small-button upload-label ${upload.isPending ? "disabled" : ""}`}
                  >
                    <Upload size={15} />
                    {upload.isPending ? "Загрузка…" : "Прикрепить"}
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      disabled={upload.isPending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) upload.mutate(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              <div className="attachments">
                {r.attachments.map((file) => (
                  <a key={file.id} href={`/api/attachments/${file.id}/`}>
                    <FileText size={20} />
                    <span>
                      {file.original_name}
                      <small>{Math.ceil(file.size / 1024)} КБ</small>
                    </span>
                    <Download size={16} />
                  </a>
                ))}
              </div>
              {!r.attachments.length && (
                <p className="section-empty">
                  Файлы не прикреплены. Поддерживаются PDF, PNG и JPEG до 10 МБ.
                </p>
              )}
              <ErrorNotice error={upload.error} />
            </div>
          </section>
          <section className="panel timeline-panel">
            <h2>История и обсуждение</h2>
            <form
              className="comment-form"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate({ action: "comments", data: { comment } });
              }}
            >
              <label className="sr-only" htmlFor="comment">
                Комментарий
              </label>
              <input
                id="comment"
                value={comment}
                maxLength={2000}
                placeholder="Добавить комментарий к заявке"
                onChange={(e) => setComment(e.target.value)}
              />
              <button
                className="icon-button"
                disabled={mutation.isPending || !comment.trim()}
                aria-label="Отправить комментарий"
              >
                <Send size={18} />
              </button>
            </form>
            <div className="timeline">
              {r.events.map((event) => (
                <div className="timeline-event" key={event.id}>
                  <Avatar name={event.actor_name} />
                  <div>
                    <b>{event.action}</b>
                    <span>
                      {event.actor_name} ·{" "}
                      {new Intl.DateTimeFormat("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(event.created_at))}
                    </span>
                    {event.comment && <p>{event.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="detail-aside">
          <section className="panel request-summary">
            <span className="eyebrow">Стоимость закупки</span>
            <strong>{money(r.purchase?.amount || r.total)}</strong>
            <dl>
              <div>
                <dt>Отдел</dt>
                <dd>{r.department_name}</dd>
              </div>
              <div>
                <dt>Нужно к</dt>
                <dd>{longDate(r.needed_by)}</dd>
              </div>
              {Number(r.approved_amount) > 0 && (
                <div>
                  <dt>Согласовано</dt>
                  <dd>{money(r.approved_amount)}</dd>
                </div>
              )}
              {r.purchase && (
                <>
                  <div>
                    <dt>Поставщик</dt>
                    <dd>{r.purchase.supplier_name}</dd>
                  </div>
                  <div>
                    <dt>Ожидается</dt>
                    <dd>{longDate(r.purchase.expected_on)}</dd>
                  </div>
                </>
              )}
            </dl>
            <div className="request-actions">
              {editable && (
                <button
                  className="button primary"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ action: "submit" })}
                >
                  <Send size={16} />
                  На согласование
                </button>
              )}
              {approver && (
                <>
                  <button
                    className="button primary"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        action: "decision",
                        data: { decision: "approve" },
                      })
                    }
                  >
                    <Check size={17} />
                    Согласовать
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => open("return")}
                  >
                    На доработку
                  </button>
                  <button
                    className="text-button danger-text"
                    onClick={() => open("reject")}
                  >
                    Отклонить
                  </button>
                </>
              )}
              {buyer && r.status === "approved" && (
                <button
                  className="button primary"
                  disabled={!r.quotes.length}
                  onClick={() => open("order")}
                >
                  Оформить закупку
                </button>
              )}
              {receiver && r.status === "ordered" && (
                <button
                  className="button primary"
                  onClick={() => open("receive")}
                >
                  <PackageCheck size={17} />
                  Принять товары
                </button>
              )}
              {cancellable && (
                <button
                  className="text-button muted"
                  onClick={() => open("cancel")}
                >
                  Отменить заявку
                </button>
              )}
            </div>
          </section>
          <p className="aside-note">
            Все изменения сохраняются в истории. Согласование резервирует
            средства в бюджете отдела.
          </p>
        </aside>
      </div>
      {dialog && (
        <Modal title={dialogTitles[dialog]} onClose={() => setDialog(null)}>
          <form onSubmit={submitDialog}>
            {(dialog === "return" || dialog === "reject") && (
              <label>
                Причина решения
                <textarea
                  name="comment"
                  rows={4}
                  minLength={1}
                  maxLength={2000}
                  required
                  placeholder="Что важно знать инициатору"
                  autoFocus
                />
              </label>
            )}
            {dialog === "quote" && (
              <>
                <label>
                  Поставщик
                    <select name="supplier" required aria-label="Поставщик">
                    <option value="">Выберите поставщика</option>
                    {suppliers.data
                      ?.filter(
                        (s) => !r.quotes.some((q) => q.supplier === s.id),
                      )
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="form-two-col">
                  <label>
                    Общая сумма, ₽
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="999999999999.99"
                      name="amount"
                      required
                    />
                  </label>
                  <label>
                    Доставка, дней
                    <input
                      type="number"
                      min={1}
                      max={365}
                      name="delivery_days"
                      required
                    />
                  </label>
                </div>
                <label>
                  Условия
                  <textarea name="notes" rows={3} maxLength={2000} />
                </label>
                <Link className="text-link" to="/suppliers">
                  Добавить нового поставщика
                </Link>
              </>
            )}
            {dialog === "order" && (
              <>
                <p className="muted">
                  Стоимость не может превышать согласованные{" "}
                  {money(r.approved_amount)}. Неиспользованный резерв будет
                  освобождён.
                </p>
                <label>
                  Предложение
                    <select name="quote_id" required aria-label="Предложение">
                    <option value="">Выберите предложение</option>
                    {r.quotes.map((q) => (
                      <option
                        key={q.id}
                        value={q.id}
                        disabled={Number(q.amount) > Number(r.approved_amount)}
                      >
                        {q.supplier_name} · {money(q.amount)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ожидаемая дата поставки
                  <input
                    type="date"
                    name="expected_on"
                    required
                    min={localDate()}
                  />
                </label>
              </>
            )}
            {dialog === "receive" && (
              <>
                <p className="muted">
                  Укажите количество в этой поставке. Частичное получение
                  оставит закупку в статусе «В пути».
                </p>
                {r.items
                  .filter((i) => i.received_quantity < i.quantity)
                  .map((i) => (
                    <label key={i.id}>
                      {i.name}
                      <small>
                        Осталось получить: {i.quantity - i.received_quantity}{" "}
                        шт.
                      </small>
                      <input
                        type="number"
                        name={`item-${i.id}`}
                        min={0}
                        max={i.quantity - i.received_quantity}
                        defaultValue={i.quantity - i.received_quantity}
                      />
                    </label>
                  ))}
              </>
            )}
            {dialog === "cancel" && (
              <p>
                Отменить заявку «{r.title}»? Зарезервированные средства будут
                возвращены в доступный бюджет.
              </p>
            )}
            <ErrorNotice error={mutation.error} />
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setDialog(null)}
              >
                Назад
              </button>
              <button className="button primary" disabled={mutation.isPending}>
                {mutation.isPending
                  ? "Сохраняем…"
                  : dialog === "cancel"
                    ? "Отменить заявку"
                    : "Подтвердить"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
