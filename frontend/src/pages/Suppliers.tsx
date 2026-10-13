import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Building2, Mail, Plus, Search } from "lucide-react";
import { api, post } from "../api/client";
import type { Supplier } from "../api/types";
import { useUser } from "../app/session";
import { Empty, ErrorNotice, Loading, Modal } from "../components/UI";

export function Suppliers() {
  const user = useUser();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const { data, error, isPending } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api<Supplier[]>("suppliers/"),
  });
  const mutation = useMutation({
    mutationFn: (payload: unknown) =>
      editing && editing !== "new"
        ? api(`suppliers/${editing.id}/`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : post("suppliers/", payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["suppliers"] });
      setEditing(null);
    },
  });
  const canEdit = ["admin", "buyer"].includes(user.role);
  const existing = editing && editing !== "new" ? editing : null;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    mutation.mutate(Object.fromEntries(new FormData(e.currentTarget)));
  }
  const rows =
    data?.filter((s) =>
      `${s.name} ${s.tax_id} ${s.contact}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) || [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Контакты и условия сотрудничества</span>
          <h1>Поставщики</h1>
          <p>Единый справочник контрагентов вашей компании.</p>
        </div>
        {canEdit && (
          <button
            className="button primary"
            onClick={() => {
              mutation.reset();
              setEditing("new");
            }}
          >
            <Plus size={18} />
            Добавить поставщика
          </button>
        )}
      </div>
      <label className="search-field standalone-search">
        <Search size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Название, ИНН или контактное лицо"
          aria-label="Поиск поставщиков"
        />
      </label>
      {isPending ? (
        <Loading />
      ) : error ? (
        <ErrorNotice error={error} />
      ) : rows.length ? (
        <div className="supplier-grid">
          {rows.map((s) => (
            <section className="panel supplier-card" key={s.id}>
              <div className="supplier-top">
                <span className="supplier-symbol">
                  <Building2 size={23} />
                </span>
                {canEdit && (
                  <button
                    className="icon-button"
                    onClick={() => {
                      mutation.reset();
                      setEditing(s);
                    }}
                    aria-label={`Редактировать ${s.name}`}
                  >
                    <ArrowUpRight size={19} />
                  </button>
                )}
              </div>
              <h2>{s.name}</h2>
              <span className="muted small-text">ИНН {s.tax_id}</span>
              <div className="supplier-contact">
                <b>{s.contact || "Контакт не указан"}</b>
                {s.email && (
                  <a href={`mailto:${s.email}`}>
                    <Mail size={14} />
                    {s.email}
                  </a>
                )}
                {s.phone && <span>{s.phone}</span>}
              </div>
              {s.notes && <p className="supplier-notes">{s.notes}</p>}
            </section>
          ))}
        </div>
      ) : (
        <Empty
          title="Поставщиков не найдено"
          text="Добавьте контрагента или измените поисковый запрос."
        />
      )}
      {editing && (
        <Modal
          title={existing ? "Редактировать поставщика" : "Новый поставщик"}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={submit}>
            <label>
              Название
              <input
                name="name"
                required
                maxLength={160}
                defaultValue={existing?.name}
                placeholder="ООО «Название»"
                autoFocus
              />
            </label>
            <label>
              ИНН
              <input
                name="tax_id"
                inputMode="numeric"
                required
                pattern="[0-9]{10}|[0-9]{12}"
                maxLength={12}
                defaultValue={existing?.tax_id}
                placeholder="10 или 12 цифр"
              />
            </label>
            <label>
              Контактное лицо
              <input
                name="contact"
                maxLength={160}
                defaultValue={existing?.contact}
              />
            </label>
            <div className="form-two-col">
              <label>
                Электронная почта
                <input
                  type="email"
                  name="email"
                  defaultValue={existing?.email}
                />
              </label>
              <label>
                Телефон
                <input
                  name="phone"
                  maxLength={32}
                  defaultValue={existing?.phone}
                />
              </label>
            </div>
            <label>
              Условия и заметки
              <textarea
                name="notes"
                rows={3}
                maxLength={2000}
                defaultValue={existing?.notes}
              />
            </label>
            <ErrorNotice error={mutation.error} />
            <button
              className="button primary full-width"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Сохраняем…" : "Сохранить поставщика"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
