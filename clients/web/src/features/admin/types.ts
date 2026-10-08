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

/** What an admin can change about another account: one status or role change at a time. */
export type UserChange = { status: "active" | "blocked" } | { role: "admin" | "user" }
