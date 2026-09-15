

export type UpdateCandidate = {
  version: string
  channel: "stable" | "unstable"
  name: string
  prerelease: boolean
  publishedAt: string
  htmlUrl: string
  releaseNotes: string
  manifestUrl?: string
}

export type UpdateStatus = {
  state: "disabled" | "idle" | "running" | "succeeded" | "failed"
  version?: string
  channel?: string
  message?: string
}

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
