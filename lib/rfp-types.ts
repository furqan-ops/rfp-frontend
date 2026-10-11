export type ComplianceStatus =
  | 'FULLY_SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'NOT_SUPPORTED'
  | 'INSUFFICIENT_EVIDENCE'

export type RoutingAction = 'AUTO_APPROVED' | 'ESCALATED_TO_HUMAN_N8N'

export type HitlDecision = 'APPROVED' | 'REJECTED'

export interface RfpResult {
  question_id: string
  category: string
  question: string
  compliance_status: ComplianceStatus
  answer: string
  source_document: string
  section_reference: string
  verbatim_quote: string
  confidence_score: number
  is_grounded: boolean
  needs_human_review: boolean
  routing_action: RoutingAction
  grader_reasoning: string
  retrieved_chunks_count: number
  source?: 'offline_demo' | 'live'
  resolved_decision?: HitlDecision
  resolved_by?: string
}

export interface Health {
  status: string
  indexed_chunks: number
  confidence_threshold: number
  grader_confidence: number
  data_source: string
}

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010').replace(/\/+$/, '')

export const formatStatus = (value: ComplianceStatus) => {
  switch (value) {
    case 'FULLY_SUPPORTED':
      return 'Fully supported by policy'
    case 'PARTIALLY_SUPPORTED':
      return 'Partially supported by policy'
    case 'NOT_SUPPORTED':
      return 'Not supported by policy'
    case 'INSUFFICIENT_EVIDENCE':
      return 'Not enough evidence'
    default:
      return value
  }
}

export const formatRoute = (value: RoutingAction) =>
  value === 'AUTO_APPROVED' ? 'Answered automatically' : 'Sent to a person'

export const csvEscape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`

export const resultKeys: (keyof RfpResult)[] = [
  'question_id',
  'category',
  'question',
  'compliance_status',
  'answer',
  'source_document',
  'section_reference',
  'verbatim_quote',
  'confidence_score',
  'is_grounded',
  'needs_human_review',
  'routing_action',
  'grader_reasoning',
  'retrieved_chunks_count',
]
