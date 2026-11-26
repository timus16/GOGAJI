export interface ApiResponse extends Response {
  error: string | null;
}

async function responseError(response: Response): Promise<string> {
  try {
    const body = await response.clone().json() as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim()) return body.error;
  } catch {
  }
  const status = response.statusText ? ` ${response.statusText}` : "";
  return `Request failed (${response.status}${status})`;
}

export const api = {
  async post(url: string, data: unknown): Promise<ApiResponse> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    const error = res.ok ? null : await responseError(res);
    return Object.assign(res, { error });
  },
};
