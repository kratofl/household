export type AuditEvent = {
  id: string
  occurredAt: string
  actorUserId?: string
  actorRole: string
  action: string
  module: string
  targetType: string
  targetId: string
  outcome: string
  ip: string
  userAgent: string
  errorCode: string
}

/** What an admin enters to create an account; it starts active with the user role. */
export type NewUser = { name: string; email: string; password: string }
/** What creating an account did; a failure carries the message for the form that asked. */
export type CreateUserResult = { ok: true } | { ok: false; message: string }

/** What an admin can change about another account: one status or role change at a time. */
export type UserChange = { status: "active" | "blocked" } | { role: "admin" | "user" }
