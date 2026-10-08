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
