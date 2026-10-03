export type DashTask = { id: string; kind: string; label: string; startedAt: number }

export type DashPeer = {
  id: string
  cwd: string
  prompt: string
  tool: string
  file: string
  at: number
  isEnded: boolean
}

export type DashLimit = { kind: string; percentUsed: number; resetsAt?: string }
