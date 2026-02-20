import type { LineType } from './screenplay'

export interface AgentReviewContextLine {
  lineIndex: number
  assignedType: LineType
  text: string
}

export interface AgentSuspiciousLinePayload {
  itemIndex: number
  lineIndex: number
  text: string
  assignedType: LineType
  totalSuspicion: number
  reasons: string[]
  contextLines: AgentReviewContextLine[]
}

export interface AgentReviewRequestPayload {
  sessionId: string
  totalReviewed: number
  suspiciousLines: AgentSuspiciousLinePayload[]
}

export interface AgentReviewDecision {
  itemIndex: number
  finalType: LineType
  confidence: number
  reason: string
}

export interface AgentReviewResponsePayload {
  status: 'applied' | 'skipped' | 'warning' | 'error'
  model: string
  decisions: AgentReviewDecision[]
  message: string
  latencyMs: number
}
