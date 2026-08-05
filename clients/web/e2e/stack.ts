import { execSync, spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

const here = __dirname
export const repoRoot = join(here, "..", "..", "..")
export const apiBase = "http://127.0.0.1:8091"
export const adminUser = { username: "admin", password: "e2e-admin-password" }

const containerName = "household-e2e-db"
const databasePort = "55432"
const stateDir = join(here, ".state")
const pidFile = join(stateDir, "api.pid")

export async function startStack() {
  mkdirSync(stateDir, { recursive: true })
  stopStack()
  run(
    `docker run --detach --rm --name ${containerName} ` +
      "--env POSTGRES_DB=household --env POSTGRES_USER=household --env POSTGRES_PASSWORD=household " +
      `--publish 127.0.0.1:${databasePort}:5432 postgres:18.4-alpine3.23`,
  )
  await waitFor(
    () => run(`docker exec ${containerName} pg_isready --username household`, { allowFailure: true }),
    60_000,
    "PostgreSQL container",
  )

  const backend = join(repoRoot, "backend")
  run("dotnet build Household.slnx --configuration Release --nologo -v q", { cwd: backend })
  const apiDll = join(backend, "src", "Household.Api", "bin", "Release", "net10.0", "Household.Api.dll")
  const api = spawn("dotnet", [apiDll], {
    cwd: dirname(apiDll),
    env: {
      ...process.env,
      HOUSEHOLD_API_SERVER_PORT: "8091",
      ASPNETCORE_ENVIRONMENT: "Development",
      HOUSEHOLD_API_DB_HOST: "127.0.0.1",
      HOUSEHOLD_API_DB_PORT: databasePort,
      HOUSEHOLD_SEED_DEMO_USER: "true",
      HOUSEHOLD_SEED_DEMO_USER_NAME: adminUser.username,
      HOUSEHOLD_SEED_DEMO_USER_EMAIL: "admin@household.local",
      HOUSEHOLD_SEED_DEMO_USER_PASSWORD: adminUser.password,
    },
    stdio: ["ignore", "ignore", "pipe"],
    detached: false,
  })
  let apiErrors = ""
  api.stderr?.on("data", (chunk: Buffer) => {
    apiErrors = (apiErrors + chunk.toString()).slice(-4000)
  })
  api.unref()
  writeFileSync(pidFile, String(api.pid))

  await waitFor(async () => {
    if (api.exitCode !== null) throw new Error(`API exited with code ${api.exitCode}: ${apiErrors}`)
    try {
      const response = await fetch(`${apiBase}/healthz`)
      return response.ok || response.status === 204
    } catch {
      return false
    }
  }, 120_000, "Household API")
}

export function stopStack() {
  if (existsSync(pidFile)) {
    const pid = readFileSync(pidFile, "utf8").trim()
    if (pid) {
      if (process.platform === "win32") run(`taskkill /PID ${pid} /T /F`, { allowFailure: true })
      else run(`kill ${pid}`, { allowFailure: true })
    }
    rmSync(pidFile, { force: true })
  }
  run(`docker rm -f ${containerName}`, { allowFailure: true })
}

export async function apiLogin(username = adminUser.username, password = adminUser.password) {
  const response = await fetch(`${apiBase}/api/v1/auth/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
  if (!response.ok) throw new Error(`Login failed with ${response.status}`)
  return (await response.json()) as {
    accessToken: string
    refreshToken: string
    accessExpiresAt: string
    refreshExpiresAt: string
  }
}

export async function activateBudgetModule() {
  const tokens = await apiLogin()
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokens.accessToken}`,
  }
  const modules = (await (await fetch(`${apiBase}/api/v1/modules`, { headers })).json()) as Array<{
    id: string
    key: string
    enabled: boolean
    active: boolean
  }>
  const activeIds = modules.filter((module) => module.active || module.key === "budget").map((module) => module.id)
  const response = await fetch(`${apiBase}/api/v1/modules/active`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ moduleIds: activeIds }),
  })
  if (!response.ok) throw new Error(`Module activation failed with ${response.status}`)
}

function run(command: string, options: { cwd?: string; allowFailure?: boolean } = {}) {
  try {
    execSync(command, { cwd: options.cwd, stdio: "pipe" })
    return true
  } catch (error) {
    if (options.allowFailure) return false
    throw error
  }
}

async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs: number, what: string) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`${what} did not become ready within ${timeoutMs / 1000}s`)
}
