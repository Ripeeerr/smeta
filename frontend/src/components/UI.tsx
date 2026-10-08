import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertCircle, ArrowRight, LoaderCircle, X } from "lucide-react";
import type { Status } from "../api/types";
import { initials, statusLabels } from "../lib/format";

export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {initials(name)}
    </span>
  );
}
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge badge-${status}`}>
      <span />
      {statusLabels[status]}
    </span>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={24} className="spin" />
      <span>Загружаем рабочее пространство…</span>
    </div>
  );
}
export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={18} />
      <span>
        {error instanceof Error
          ? error.message
          : "Не удалось загрузить данные."}
      </span>
    </div>
  );
}
export function Empty({
  title = "Здесь пока нет заявок",
  text = "Создайте первую заявку или измените условия поиска.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">—</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function PanelHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
export function TextLink({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ArrowRight size={15} />
    </>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = dialog.current;
    const trigger = document.activeElement;
    el?.showModal();
    return () => { el?.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, []);
  return (
    <dialog
      aria-labelledby={titleId}
      ref={dialog}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Закрыть окно"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
