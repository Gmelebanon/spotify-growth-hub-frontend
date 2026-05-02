const RAW_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8000";

export const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status = 500, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

async function parseJsonSafe(response: Response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${normalizedPath}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body:
        options.body === undefined
          ? undefined
          : typeof options.body === "string"
            ? options.body
            : JSON.stringify(options.body),
      cache: "no-store",
    });

    const data = await parseJsonSafe(response);

    if (!response.ok) {
      const message =
        typeof data === "object" &&
        data !== null &&
        "detail" in data &&
        typeof (data as { detail?: unknown }).detail === "string"
          ? (data as { detail: string }).detail
          : `Request failed with status ${response.status}`;

      throw new ApiError(message, response.status, data);
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      `Network error while calling ${url}. Make sure FastAPI is running on port 8000 and CORS is enabled.`,
      0,
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Backward-compatible export for older API modules that still import:
 *   import { apiRequest } from "./client";
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return apiFetch<T>(path, options);
}

export function get<T = unknown>(path: string) {
  return apiFetch<T>(path, { method: "GET" });
}

export function post<T = unknown>(path: string, body?: unknown) {
  return apiFetch<T>(path, { method: "POST", body });
}

export function put<T = unknown>(path: string, body?: unknown) {
  return apiFetch<T>(path, { method: "PUT", body });
}

export function del<T = unknown>(path: string) {
  return apiFetch<T>(path, { method: "DELETE" });
}