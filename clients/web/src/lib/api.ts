export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type ApiOptions = {
  method?: string
  accessToken?: string
  body?: unknown
}

export async function apiRequest<T = unknown>(path: string, options: ApiOptions = {}) {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`
  }

  const response = await fetch(`/api/backend${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    throw new ApiError(response.status, await responseMessage(response))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function apiRequestText(path: string, options: ApiOptions = {}) {
  const headers: HeadersInit = {}
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`
  }

  const response = await fetch(`/api/backend${path}`, { method: options.method ?? "GET", headers })

  if (!response.ok) {
    throw new ApiError(response.status, await responseMessage(response))
  }

  return await response.text()
}

async function responseMessage(response: Response) {
  try {
    const data = await response.json()
    if (typeof data?.detail === "string") return data.detail
    if (typeof data?.title === "string") return data.title
  } catch {
    // Fall through to HTTP status text.
  }

  return response.statusText || `HTTP ${response.status}`
}
