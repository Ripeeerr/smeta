import type { Status } from "../api/types";

const rubles = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});
const preciseRubles = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const money = (value: string | number) =>
  Number(value) % 1 === 0
    ? rubles.format(Number(value))
    : preciseRubles.format(Number(value));
export const shortDate = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(
    new Date(value.includes("T") ? value : `${value}T12:00:00`),
  );
export const longDate = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
export const initials = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((v) => v[0])
    .join("")
    .toUpperCase();
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const monthKey = () => localDate().slice(0, 7);
export const statusLabels: Record<Status, string> = {
  draft: "Черновик",
  pending: "На согласовании",
  returned: "На доработке",
  approved: "К закупке",
  ordered: "В пути",
  received: "Получено",
  rejected: "Отклонено",
  cancelled: "Отменено",
};
