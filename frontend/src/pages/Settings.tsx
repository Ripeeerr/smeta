import { Moon, Sun } from "lucide-react";
import { useUser } from "../app/session";
import { Avatar } from "../components/UI";
import { setTheme, useTheme } from "../lib/theme";

export function Settings() {
  const user = useUser();
  const theme = useTheme();
  const change = setTheme;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Ваше рабочее пространство</span>
          <h1>Настройки</h1>
          <p>Профиль, права доступа и внешний вид приложения.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel settings-panel">
          <h2>Профиль</h2>
          <div className="settings-user">
            <Avatar name={user.name} />
            <div>
              <strong>{user.name}</strong>
              <span>{user.role_label}</span>
            </div>
          </div>
          <dl>
            <div>
              <dt>Логин</dt>
              <dd>{user.username}</dd>
            </div>
            <div>
              <dt>Отдел</dt>
              <dd>{user.department_name || "Все отделы"}</dd>
            </div>
            <div>
              <dt>Организация</dt>
              <dd>Студия Форма</dd>
            </div>
          </dl>
          <p className="muted small-text">
            Изменить данные учётной записи может администратор компании.
          </p>
        </section>
        <section className="panel settings-panel">
          <h2>Оформление</h2>
          <p className="muted">
            Выбранная тема сохраняется на этом устройстве.
          </p>
          <div className="theme-options">
            <button
              aria-pressed={theme === "dark"}
              className={theme === "dark" ? "selected" : ""}
              onClick={() => change("dark")}
            >
              <div className="theme-preview dark-preview">
                <i />
                <span />
                <span />
                <span />
              </div>
              <span>
                <Moon size={16} />
                Тёмная
              </span>
            </button>
            <button
              aria-pressed={theme === "light"}
              className={theme === "light" ? "selected" : ""}
              onClick={() => change("light")}
            >
              <div className="theme-preview light-preview">
                <i />
                <span />
                <span />
                <span />
              </div>
              <span>
                <Sun size={16} />
                Светлая
              </span>
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

export function Help() {
  const steps = [
    [
      "Создайте заявку",
      "Опишите потребность, выберите отдел, укажите позиции и срок. Черновик можно редактировать и дополнять вложениями.",
    ],
    [
      "Отправьте на согласование",
      "Руководитель проверит заявку и свободный бюджет отдела. При необходимости вернёт её с комментарием. Собственные заявки согласовать нельзя.",
    ],
    [
      "Выберите поставщика",
      "Закупщик добавляет предложения и оформляет заказ. Его цена не должна превышать согласованную сумму. Разница возвращается в свободный бюджет.",
    ],
    [
      "Примите товары",
      "Автор заявки или закупщик фиксирует фактическое количество. Частичное получение поддерживается: заказ закроется, когда поступят все позиции.",
    ],
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Коротко о работе в системе</span>
          <h1>Как устроены закупки</h1>
          <p>Понятный процесс — от потребности до получения.</p>
        </div>
      </div>
      <div className="help-grid">
        {steps.map(([title, text], index) => (
          <section className="panel help-card" key={title}>
            <span className="help-number">0{index + 1}</span>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
      </div>
      <section className="panel help-roles">
        <h2>Роли в рабочем пространстве</h2>
        <div>
          <p>
            <b>Сотрудник</b> создаёт и отслеживает собственные заявки.
          </p>
          <p>
            <b>Руководитель отдела</b> принимает решения по заявкам своего
            отдела.
          </p>
          <p>
            <b>Закупщик</b> работает с поставщиками, заказами и приёмкой.
          </p>
          <p>
            <b>Руководитель компании</b> управляет бюджетами и видит закупки
            всех отделов.
          </p>
        </div>
      </section>
    </>
  );
}
