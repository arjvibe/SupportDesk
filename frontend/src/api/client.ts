import { getApiBase } from "../utils/api";

const API_BASE = getApiBase();

export class ApiError extends Error {
  status: number;
  info?: any;

  constructor(message: string, status: number, info?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.info = info;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const config: RequestInit = {
    credentials: "include",
    ...options,
    headers,
  };

  const response = await fetch(url, config);

  let data: any;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = (data && typeof data === "object" && data.error) || response.statusText || "Request failed";
    throw new ApiError(errorMsg, response.status, data);
  }

  return data as T;
}

export const apiClient = {
  get<T>(path: string, options?: RequestInit): Promise<T> {
    return request<T>(path, { ...options, method: "GET" });
  },

  post<T>(path: string, body?: any, options?: RequestInit): Promise<T> {
    const requestOptions: RequestInit = { ...options, method: "POST" };
    if (body !== undefined) {
      requestOptions.body = body instanceof FormData ? body : JSON.stringify(body);
    }
    return request<T>(path, requestOptions);
  },

  put<T>(path: string, body?: any, options?: RequestInit): Promise<T> {
    const requestOptions: RequestInit = { ...options, method: "PUT" };
    if (body !== undefined) {
      requestOptions.body = body instanceof FormData ? body : JSON.stringify(body);
    }
    return request<T>(path, requestOptions);
  },

  delete<T>(path: string, options?: RequestInit): Promise<T> {
    return request<T>(path, { ...options, method: "DELETE" });
  },
};
