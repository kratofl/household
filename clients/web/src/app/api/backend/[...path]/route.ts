import { NextRequest } from "next/server"

const API_BASE_URL =
  process.env.HOUSEHOLD_API_URL ??
  process.env.NEXT_PUBLIC_HOUSEHOLD_API_URL ??
  "http://localhost:8090/api/v1"

export async function GET(request: NextRequest, context: RouteContext<"/api/backend/[...path]">) {
  return proxy(request, context)
}

export async function POST(request: NextRequest, context: RouteContext<"/api/backend/[...path]">) {
  return proxy(request, context)
}

export async function PUT(request: NextRequest, context: RouteContext<"/api/backend/[...path]">) {
  return proxy(request, context)
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/backend/[...path]">) {
  return proxy(request, context)
}

export async function DELETE(request: NextRequest, context: RouteContext<"/api/backend/[...path]">) {
  return proxy(request, context)
}

async function proxy(request: NextRequest, context: RouteContext<"/api/backend/[...path]">) {
  const { path } = await context.params
  const target = `${API_BASE_URL}/${path.join("/")}${request.nextUrl.search}`
  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await request.text()

  const response = await fetch(target, {
    method: request.method,
    headers: forwardedHeaders(request),
    body,
  })

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
    },
  })
}

function forwardedHeaders(request: NextRequest) {
  const headers = new Headers()
  const contentType = request.headers.get("Content-Type")
  const authorization = request.headers.get("Authorization")

  if (contentType) headers.set("Content-Type", contentType)
  if (authorization) headers.set("Authorization", authorization)

  return headers
}
