import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Requisition, Status } from "../api/types";
import { money, shortDate, statusLabels } from "../lib/format";
import { Empty, StatusBadge } from "./UI";

const statuses: (Status | "all")[] = [
  "all",
  "pending",
  "approved",
  "ordered",
  "received",
];

export function RequestTable({
  requests,
  initialSearch = "",
  initialStatus = "all",
  purchasing = false,
}: {
  requests: Requisition[];
  initialSearch?: string;
  initialStatus?: Status | "all";
  purchasing?: boolean;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState<Status | "all">(initialStatus);
  const [department, setDepartment] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(1);
  const departments = [
    ...new Map(
      requests.map((r) => [r.department, r.department_name]),
    ).entries(),
  ];
  const source = purchasing
    ? requests.filter((r) =>
        ["approved", "ordered", "received"].includes(r.status),
      )
    : requests;
  const filtered = useMemo(
    () =>
      source
        .filter(
          (r) =>
            (filter === "all" || r.status === filter) &&
            (department === "all" || String(r.department) === department) &&
            `${r.title} ${r.number} ${r.author_name}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          ascending ? a.needed_by.localeCompare(b.needed_by) : b.id - a.id,
        ),
    [source, filter, department, search, ascending],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 7));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * 7, currentPage * 7);
  function selectFilter(value: Status | "all") {
    setFilter(value);
    setPage(1);
  }
  return (
    <section className="panel table-panel">
      <div className="table-title">
        <h2>
          {purchasing ? "Закупки компании" : "Текущие заявки"}
          <span className="count-label">{source.length}</span>
        </h2>
        <span className="table-context">
          {purchasing
            ? "От согласования до получения"
            : "Вся история обращений"}
        </span>
      </div>
      <div className="table-toolbar">
        <div className="status-tabs" aria-label="Статус заявки">
          {statuses
            .filter((s) => !purchasing || s !== "pending")
            .map((s) => (
              <button
                key={s}
                aria-pressed={filter === s}
                className={filter === s ? "active" : ""}
                onClick={() => selectFilter(s)}
              >
                {s === "all" ? "Все" : statusLabels[s]}
                <small>
                  {s === "all"
                    ? source.length
                    : source.filter((r) => r.status === s).length}
                </small>
              </button>
            ))}
        </div>
        <div className="table-search">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Поиск по заявкам"
              placeholder="Поиск по заявкам"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <button
            className={`icon-button bordered ${showFilters ? "selected" : ""}`}
            aria-expanded={showFilters}
            aria-label="Фильтры заявок"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </div>
      {showFilters && (
        <div className="filter-row">
          <label>
            Отдел
            <select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Все доступные отделы</option>
              {departments.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Статус
            <select
              value={filter}
              onChange={(e) => selectFilter(e.target.value as Status | "all")}
            >
              <option value="all">Любой статус</option>
              {Object.entries(statusLabels).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button secondary"
            onClick={() => {
              setDepartment("all");
              selectFilter("all");
              setSearch("");
            }}
          >
            Сбросить
          </button>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>№ заявки</th>
              <th>Наименование</th>
              <th>Подразделение</th>
              <th className="numeric">Сумма</th>
              <th>Статус</th>
              <th>
                <button
                  className="sort-button"
                  onClick={() => setAscending(!ascending)}
                >
                  Нужно к
                  {ascending ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                </button>
              </th>
              <th>
                <span className="sr-only">Открыть</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={`/requests/${r.id}`} className="request-number">
                    {r.number}
                  </Link>
                </td>
                <td>
                  <Link className="request-title" to={`/requests/${r.id}`}>
                    {r.title}
                  </Link>
                  <span className="table-author">{r.author_name}</span>
                </td>
                <td>
                  <span className="department-cell">{r.department_name}</span>
                </td>
                <td className="numeric money-cell">
                  {money(r.purchase?.amount || r.total)}
                </td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td className="nowrap muted">{shortDate(r.needed_by)}</td>
                <td>
                  <Link
                    className="icon-button row-open"
                    to={`/requests/${r.id}`}
                    aria-label={`Открыть заявку ${r.number}`}
                  >
                    <ArrowUpRight size={17} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <Empty />}
      <div className="table-footer">
        <span>
          {filtered.length
            ? `${(currentPage - 1) * 7 + 1}–${Math.min(currentPage * 7, filtered.length)} из ${filtered.length} заявок`
            : "Заявок не найдено"}
        </span>
        <div className="pagination">
          <button
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Назад
          </button>
          <span>
            {currentPage} / {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Далее
          </button>
        </div>
      </div>
    </section>
  );
}
