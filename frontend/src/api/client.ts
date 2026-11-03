let csrfToken = "";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function errorMessage(data: unknown): string {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.map(errorMessage).join(" ");
  if (data && typeof data === "object")
    return Object.values(data).map(errorMessage).join(" ");
  return "Не удалось выполнить запрос. Попробуйте ещё раз.";
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (options.method && !["GET", "HEAD"].includes(options.method))
    headers.set("X-CSRFToken", csrfToken);
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(
      "Сервер недоступен. Проверьте подключение и попробуйте ещё раз.",
      0,
    );
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(errorMessage(data), response.status);
  if (
    data &&
    typeof data === "object" &&
    "csrf_token" in data &&
    typeof data.csrf_token === "string"
  )
    csrfToken = data.csrf_token;
  return data as T;
}

export const post = <T>(path: string, data: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(data) });
