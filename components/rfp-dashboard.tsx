'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Clipboard,
  Download,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react'
import {
  API_BASE_URL,
  csvEscape,
  formatRoute,
  formatStatus,
  resultKeys,
  type Health,
  type HitlDecision,
  type RfpResult,
} from '@/lib/rfp-types'

type Filter = 'all' | 'auto' | 'escalated'
type DataSourceMode = 'live' | 'offline'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-teal-400 dark:focus-visible:ring-offset-slate-950'

const Q01_EXAMPLE = {
  question_id: 'Q-01',
  category: 'Security & Encryption',
  question: 'How is customer data encrypted both at rest and in transit, and how often are encryption keys rotated?',
  answer:
    'Customer data and pgvector embeddings are encrypted at rest using AES-256 with AWS KMS keys rotated every 365 days, and encrypted in transit via TLS 1.2/1.3.',
  source_document: '01_Security_and_SOC2_Compliance_Policy.md',
  section_reference: '2. Data Encryption Standards',
  verbatim_quote:
    'encrypted at rest using AES-256 encryption with AWS KMS-managed keys rotated every 365 days... enforce TLS 1.2 or TLS 1.3',
}

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Load',
    description: 'Reads your policy documents and organizes them so they can be searched.',
  },
  {
    step: '02',
    title: 'Find',
    description: 'Finds the parts of your policies that answer each question.',
  },
  {
    step: '03',
    title: 'Write',
    description: 'Writes an answer and checks it against the policy text it came from.',
  },
  {
    step: '04',
    title: 'Decide',
    description: 'Sends answers the system is sure about on. Sends the rest to a person.',
  },
]

const WHAT_IT_DOES_NOT_DO = [
  'It does not replace your security team’s judgment.',
  'It does not answer when the policy documents do not support the answer. It flags those for review.',
  'It works only on the documents you provide.',
]

const QUICK_FILL_PROMPTS: { label: string; question: string }[] = [
  {
    label: 'Test SOC 2 and encryption',
    question: 'Is customer data encrypted at rest and in transit?',
  },
  {
    label: 'Test FedRAMP trap',
    question: 'Is the platform FedRAMP High authorized and available as an air-gapped on-premise binary?',
  },
  {
    label: 'Test blockchain trap',
    question: 'Does the platform use blockchain for audit logging and Ethereum billing?',
  },
]

function scrollToSection(e: React.MouseEvent<HTMLAnchorElement>, targetId: string) {
  const el = document.getElementById(targetId)
  if (!el) return
  e.preventDefault()
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' })
}

function OfflineBanner({ visible }: { visible: boolean }) {
  return visible ? (
    <div
      role="alert"
      className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-6 py-3 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
    >
      <AlertTriangle className="size-4 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden="true" />
      <span>Offline demo data. The live review service is not running. Showing saved demo results.</span>
    </div>
  ) : null
}

function HeroSection({ source, dataReady }: { source: DataSourceMode; dataReady: boolean }) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="border-b border-slate-200 bg-gradient-to-b from-teal-50/50 to-slate-50 py-10 lg:py-12 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950"
    >
      <div className="mx-auto grid max-w-[1440px] items-center gap-8 px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:px-10">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-400">
            Security questionnaire automation
          </p>
          <h2
            id="hero-heading"
            className="mt-3 text-[36px] font-bold leading-[1.12] tracking-tight text-slate-900 sm:text-[42px] lg:text-5xl dark:text-slate-100"
          >
            Answer client security questionnaires in minutes, with the source for every answer.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400">
            Drafts answers from your policy documents, shows the exact sentence it used, and sends low-confidence
            answers to a person for review.
          </p>
          {dataReady && (
            <p data-testid="first-screen-status" className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-400">
              {source === 'live'
                ? 'Connected to the live review service.'
                : 'Showing saved demo results. The live review service is not running.'}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="#try-it"
              onClick={e => scrollToSection(e, 'try-it')}
              className={`inline-flex h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 ${FOCUS_RING}`}
            >
              Try a question
            </a>
            <a
              href="#review-queue"
              onClick={e => scrollToSection(e, 'review-queue')}
              className={`inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 ${FOCUS_RING}`}
            >
              View the review queue
            </a>
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100/80 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
              <span className="size-2.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
              <span className="size-2.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
              <span className="ml-1 truncate text-xs font-medium text-slate-600 dark:text-slate-400">
                {Q01_EXAMPLE.source_document}
              </span>
            </div>
            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">Example from demo data</span>
          </div>
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                {Q01_EXAMPLE.question_id} · {Q01_EXAMPLE.category}
              </span>
            </div>
            <div className="mt-3.5 space-y-3.5">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Question</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-900 dark:text-slate-100">
                  {Q01_EXAMPLE.question}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Answer</p>
                <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">{Q01_EXAMPLE.answer}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Source document</p>
                <p className="mt-1 break-words text-xs font-semibold text-teal-700 dark:text-teal-400">
                  {Q01_EXAMPLE.source_document} ({Q01_EXAMPLE.section_reference})
                </p>
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Relevant policy text</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    {Q01_EXAMPLE.verbatim_quote}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HowItWorksSection() {
  return (
    <section aria-labelledby="how-it-works-heading" className="border-b border-slate-200 bg-slate-50 py-24 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        <div>
          <h2 id="how-it-works-heading" className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            How it works
          </h2>
          <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
            Four steps from your policy documents to a finished answer.
          </p>
        </div>

        <div className="relative mt-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-8 right-8 top-9 hidden border-t border-slate-300 lg:block dark:border-slate-800"
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS_STEPS.map(item => (
              <div
                key={item.step}
                className="relative rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="inline-flex rounded-md bg-teal-50 px-2.5 py-1 text-xs font-bold tracking-wider text-teal-700 dark:bg-teal-950/60 dark:text-teal-400">
                  {item.step}
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function WhatItDoesNotDoSection({ source, dataReady }: { source: DataSourceMode; dataReady: boolean }) {
  return (
    <section aria-labelledby="limitations-heading" className="border-b border-slate-200 bg-slate-50 py-24 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        <div>
          <h2 id="limitations-heading" className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            What it does not do
          </h2>
          <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
            Clear limits, so reviewers know when a person needs to decide.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {WHAT_IT_DOES_NOT_DO.map(statement => (
            <div
              key={statement}
              className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-sm leading-6 text-slate-800 dark:text-slate-200">{statement}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
          Answers marked as answered automatically still need a human check before anything is sent to a client.
        </p>
        <div className="mt-8 flex flex-col items-start gap-3">
          <a
            href="#try-it"
            onClick={e => scrollToSection(e, 'try-it')}
            className={`inline-flex h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 ${FOCUS_RING}`}
          >
            Try it now
          </a>
          {dataReady && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {source === 'live'
                ? 'Connected to the live review service.'
                : 'Showing saved demo results. The live review service is not running.'}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function TelemetryBar({ results, health }: { results: RfpResult[]; health: Health | null }) {
  const savedSet = useMemo(() => {
    const offlineOnly = results.filter(r => r.source !== 'live')
    return offlineOnly.length > 0 ? offlineOnly : results
  }, [results])

  const approved = results.filter(r => r.routing_action === 'AUTO_APPROVED').length
  const unresolvedEscalated = results.filter(
    r => r.routing_action === 'ESCALATED_TO_HUMAN_N8N' && !r.resolved_decision
  ).length
  const mean = savedSet.length
    ? savedSet.reduce((acc, r) => acc + r.confidence_score, 0) / savedSet.length
    : 0

  const cards = [
    {
      label: 'Policy sections loaded',
      value: `${health?.indexed_chunks ?? 30}`,
      detail: 'from 3 sample policy documents',
      accent: false,
    },
    {
      label: 'Answered automatically',
      value: `${results.length ? ((approved / results.length) * 100).toFixed(1) : '0.0'}%`,
      detail: `${approved} of ${results.length}`,
      accent: false,
    },
    {
      label: 'Sent to a person',
      value: `${unresolvedEscalated} of ${results.length}`,
      detail: 'waiting for review',
      accent: false,
    },
    {
      label: 'Average confidence (saved demo questions)',
      value: mean.toFixed(3),
      detail: 'across loaded results',
      accent: true,
    },
  ]

  return (
    <section aria-labelledby="telemetry-heading" className="py-24">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-400">
            Summary
          </p>
          <h2 id="telemetry-heading" className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Results at a glance
          </h2>
          <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
            Counts from your policy documents and the questions loaded here.
          </p>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">Sample policy documents written for this demo.</span>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <p
              className={`text-3xl font-bold tracking-tight ${
                card.accent ? 'text-teal-700 dark:text-teal-400' : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {card.value}
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{card.label}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function PipelineStepper({ active }: { active: number }) {
  const nodes = [
    'Find the matching policy text',
    'Write the answer',
    'Check the answer against the source',
    'Decide: answer or send to a person',
  ]
  return (
    <div
      aria-labelledby="pipeline-heading"
      className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="pipeline-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Under the hood
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Scores run from 0 to 1. Answers at 0.80 or higher are answered automatically.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 dark:border-slate-800 dark:bg-slate-950 dark:text-teal-400">
          {active > 0 ? 'Running live test' : 'Ready'}
        </span>
      </div>
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-8 right-8 top-1/2 hidden -translate-y-1/2 border-t border-slate-200 md:block dark:border-slate-800"
        />
        <div className="grid gap-4 md:grid-cols-4">
          {nodes.map((node, i) => (
            <div
              key={node}
              className="relative flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950"
            >
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  active >= i + 1
                    ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-400 dark:bg-teal-400 dark:text-slate-950'
                    : 'border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                {active > i + 1 ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{node}</p>
                {i === 3 && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Confident enough: answered. Not confident: a person checks it.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Sandbox({
  onResult,
  onStepChange,
}: {
  onResult: (r: RfpResult) => void
  onStepChange: (step: number) => void
}) {
  const [question, setQuestion] = useState('')
  const [category, setCategory] = useState('Security')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<number | null>(null)

  const clearStepTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const run = async () => {
    if (!question.trim() || loading) return
    setError('')
    setLoading(true)
    onStepChange(1)

    let currentStep = 1
    clearStepTimer()
    timerRef.current = window.setInterval(() => {
      currentStep = currentStep < 4 ? currentStep + 1 : 4
      onStepChange(currentStep)
    }, 180)

    try {
      const responsePromise = fetch(`${API_BASE_URL}/webhook/rfp-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: `LIVE-${Date.now()}`,
          category,
          question,
        }),
      })
      const minAnimPromise = new Promise(resolve => window.setTimeout(resolve, 750))
      const [response] = await Promise.all([responsePromise, minAnimPromise])

      if (!response.ok) throw new Error('Live endpoint unavailable')
      const data: RfpResult = await response.json()
      onStepChange(4)
      onResult({ ...data, source: 'live' })
    } catch {
      setError('Live test failed. The live review service may not be running.')
    } finally {
      clearStepTimer()
      setLoading(false)
      window.setTimeout(() => onStepChange(0), 400)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto]">
        <div>
          <label htmlFor="question" className="sr-only">
            Security question
          </label>
          <input
            id="question"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) run()
            }}
            placeholder="Type a security question…"
            className={`h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 ${FOCUS_RING}`}
          />
        </div>
        <div>
          <label htmlFor="category" className="sr-only">
            Topic
          </label>
          <select
            id="category"
            aria-label="Topic"
            value={category}
            onChange={e => setCategory(e.target.value)}
            className={`h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 ${FOCUS_RING}`}
          >
            <option>Security</option>
            <option>Encryption</option>
            <option>Compliance</option>
            <option>Access Control</option>
            <option>Privacy</option>
          </select>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className={`inline-flex h-11 items-center justify-center rounded-lg bg-teal-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-400 ${FOCUS_RING}`}
        >
          {loading ? 'Running…' : 'Run'}
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK_FILL_PROMPTS.map(item => (
          <button
            key={item.label}
            type="button"
            onClick={() => setQuestion(item.question)}
            className={`rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-teal-700 hover:bg-teal-50/50 hover:text-teal-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-teal-400 ${FOCUS_RING}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-3 text-xs text-slate-700 dark:text-slate-300" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function StatusChip({ value }: { value: RfpResult['compliance_status'] }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
      {formatStatus(value)}
    </span>
  )
}

function CitationDrawer({ result, onClose }: { result: RfpResult | null; onClose: () => void }) {
  useEffect(() => {
    if (!result) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [result, onClose])

  if (!result) return null
  return (
    <>
      <button
        aria-label="Close source details"
        onClick={onClose}
        className="fixed inset-0 z-30 cursor-default bg-slate-900/25 backdrop-blur-[1px]"
      />
      <aside
        aria-label="Source details"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-400">
              Source details
            </p>
            <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
              {result.question_id} source details
            </h2>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className={`rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 ${FOCUS_RING}`}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-wrap gap-2">
            <StatusChip value={result.compliance_status} />
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 dark:border-slate-800 dark:bg-slate-950 dark:text-teal-400">
              How sure the system is: {result.confidence_score.toFixed(2)}
            </span>
          </div>
          <dl className="mt-6 grid gap-5">
            <div>
              <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Source document</dt>
              <dd className="mt-1 break-words text-sm text-slate-900 dark:text-slate-100">{result.source_document}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Section reference</dt>
              <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">{result.section_reference}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Relevant policy text</dt>
              <dd className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                {result.verbatim_quote}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Why the system chose this answer
              </dt>
              <dd className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">{result.grader_reasoning}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
              <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Policy support</dt>
              <dd className="text-sm font-medium text-teal-700 dark:text-teal-400">
                {result.is_grounded ? 'Backed by policy' : 'Not backed by policy'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Policy sections checked</dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">{result.retrieved_chunks_count}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </>
  )
}

function HitlModal({
  result,
  reviewerName,
  setReviewerName,
  onClose,
  onResolve,
}: {
  result: RfpResult
  reviewerName: string
  setReviewerName: (v: string) => void
  onClose: () => void
  onResolve: (decision: HitlDecision, answer: string) => Promise<string | null>
}) {
  const [answer, setAnswer] = useState(result.answer)
  const [busy, setBusy] = useState(false)
  const [modalError, setModalError] = useState('')

  const submit = async (decision: HitlDecision) => {
    if (!reviewerName.trim()) return
    setModalError('')
    setBusy(true)
    const err = await onResolve(decision, answer)
    setBusy(false)
    if (err) {
      setModalError(err)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 p-6 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-400">
              Waiting for a person
            </p>
            <h2 id="review-title" className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
              Review {result.question_id}
            </h2>
          </div>
          <button
            aria-label="Cancel review"
            onClick={onClose}
            className={`rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 ${FOCUS_RING}`}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid gap-5 p-6">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Question</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-900 dark:text-slate-100">{result.question}</p>
          </div>
          <div>
            <label htmlFor="draft-answer" className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Answer
            </label>
            <textarea
              id="draft-answer"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              rows={4}
              className={`mt-2 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 ${FOCUS_RING}`}
            />
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Why the system chose this answer:</span>{' '}
            {result.grader_reasoning}
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              How sure the system is: {result.confidence_score.toFixed(2)}
            </div>
          </div>
          <div>
            <label htmlFor="reviewer-name" className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Reviewer name
            </label>
            <input
              id="reviewer-name"
              value={reviewerName}
              onChange={e => setReviewerName(e.target.value)}
              placeholder="Enter your name"
              className={`mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 ${FOCUS_RING}`}
            />
          </div>
          {modalError && (
            <p
              role="alert"
              className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              {modalError}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              onClick={onClose}
              className={`rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${FOCUS_RING}`}
            >
              Cancel
            </button>
            <button
              disabled={busy || !reviewerName.trim()}
              onClick={() => submit('REJECTED')}
              className={`rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-400 ${FOCUS_RING}`}
            >
              Reject
            </button>
            <button
              disabled={busy || !reviewerName.trim()}
              onClick={() => submit('APPROVED')}
              className={`rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-400 ${FOCUS_RING}`}
            >
              {busy ? 'Saving…' : 'Approve and resolve'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResponseMatrix({
  results,
  source,
  onSelect,
  onReview,
}: {
  results: RfpResult[]
  source: DataSourceMode
  onSelect: (r: RfpResult) => void
  onReview: (r: RfpResult) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [copied, setCopied] = useState('')

  const filtered = useMemo(
    () =>
      results.filter(
        r =>
          (filter === 'all' ||
            (filter === 'auto'
              ? r.routing_action === 'AUTO_APPROVED'
              : r.routing_action === 'ESCALATED_TO_HUMAN_N8N')) &&
          [r.question_id, r.category, r.question, r.answer].join(' ').toLowerCase().includes(query.toLowerCase())
      ),
    [results, query, filter]
  )

  const copy = async (r: RfpResult) => {
    await navigator.clipboard?.writeText(r.answer)
    setCopied(r.question_id)
    setTimeout(() => setCopied(''), 1500)
  }

  const count = (f: Filter) =>
    f === 'all'
      ? results.length
      : results.filter(r =>
          f === 'auto' ? r.routing_action === 'AUTO_APPROVED' : r.routing_action === 'ESCALATED_TO_HUMAN_N8N'
        ).length

  const exportCsv = () => {
    const csv = [
      resultKeys.join(','),
      ...filtered.map(r => resultKeys.map(k => csvEscape(r[k])).join(',')),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'rfp-response-matrix.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 p-6 dark:border-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Questions and sources</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Showing saved demo results. Live questions you test appear at the top.
            </p>
          </div>
          <button
            onClick={exportCsv}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 ${FOCUS_RING}`}
          >
            <Download className="size-4" aria-hidden="true" />
            Export CSV
          </button>
        </div>
        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <label htmlFor="matrix-search" className="sr-only">
              Search questions and answers
            </label>
            <input
              id="matrix-search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search questions and answers"
              className={`h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 ${FOCUS_RING}`}
            />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter responses">
            {(
              [
                ['all', `All (${count('all')})`],
                ['auto', `Answered automatically (${count('auto')})`],
                ['escalated', `Sent to a person (${count('escalated')})`],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${FOCUS_RING} ${
                  filter === key
                    ? 'border-teal-700 bg-teal-700 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
        Answers quote your policy documents. Technical terms come from those documents.
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {filtered.map(r => (
          <div
            key={r.question_id}
            className="group flex flex-col gap-4 p-6 transition hover:bg-slate-50/80 lg:grid lg:grid-cols-[110px_1fr_200px_160px] lg:items-center dark:hover:bg-slate-950/40"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold tracking-wide text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                {r.question_id}
              </span>
              {r.source === 'live' && (
                <span className="rounded-full border border-teal-700/30 bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:border-teal-400/30 dark:bg-teal-950/50 dark:text-teal-400">
                  Live
                </span>
              )}
              <span className="text-xs text-slate-500 lg:hidden dark:text-slate-400">{r.category}</span>
            </div>
            <button
              onClick={() => onSelect(r)}
              className={`rounded-lg text-left ${FOCUS_RING}`}
            >
              <span className="text-xs text-slate-500 dark:text-slate-400">{r.category}</span>
              <p className="mt-1 text-sm font-semibold leading-5 text-slate-900 dark:text-slate-100">{r.question}</p>
              <p className="mt-1.5 line-clamp-2 text-sm font-normal leading-6 text-slate-600 dark:text-slate-400">
                {r.answer}
              </p>
            </button>
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">How sure the system is</span>
                <span className="font-semibold text-teal-700 dark:text-teal-400">
                  {r.confidence_score.toFixed(2)}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-teal-700 transition-all duration-300 dark:bg-teal-400"
                  style={{ width: `${r.confidence_score * 100}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusChip value={r.compliance_status} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 lg:flex-col lg:items-end">
              {r.resolved_decision ? (
                <span className="rounded-full border border-teal-700/30 bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 dark:border-teal-400/30 dark:bg-teal-950/50 dark:text-teal-400">
                  {r.resolved_decision === 'APPROVED' ? 'Approved by reviewer' : 'Rejected by reviewer'}
                </span>
              ) : (
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {formatRoute(r.routing_action)}
                </span>
              )}
              {r.resolved_by && (
                <span className="text-xs text-slate-500 dark:text-slate-400">by {r.resolved_by}</span>
              )}
              <div className="flex gap-2">
                <button
                  aria-label={`Copy answer for ${r.question_id}`}
                  onClick={() => copy(r)}
                  className={`rounded-md border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 ${FOCUS_RING}`}
                >
                  <Clipboard className="size-4" />
                </button>
                {r.needs_human_review && !r.resolved_decision && (
                  <button
                    onClick={() => onReview(r)}
                    className={`rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-teal-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-teal-400 dark:hover:bg-slate-800 ${FOCUS_RING}`}
                  >
                    Review
                  </button>
                )}
              </div>
              {copied === r.question_id && (
                <span className="text-xs text-teal-700 dark:text-teal-400">Copied</span>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No responses match this filter.
          </div>
        )}
      </div>
    </div>
  )
}

function HitlQueue({ results, onReview }: { results: RfpResult[]; onReview: (r: RfpResult) => void }) {
  const escalated = results.filter(r => r.needs_human_review && !r.resolved_decision)
  return (
    <section
      id="review-queue"
      aria-labelledby="queue-heading"
      className="scroll-mt-8 rounded-xl border border-amber-200/90 bg-amber-50/70 p-6 dark:border-amber-900/50 dark:bg-amber-950/20"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 id="queue-heading" className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Waiting for a person
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            These answers need a person to check them before they go out.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-amber-300/80 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 dark:border-amber-800 dark:bg-slate-900 dark:text-slate-200">
          {escalated.length} waiting
        </span>
      </div>
      <div className="mt-5 grid gap-3">
        {escalated.map(r => (
          <div
            key={r.question_id}
            className="rounded-xl border border-amber-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{r.question_id}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{r.category}</span>
                </div>
                <p className="mt-2 text-sm font-semibold leading-5 text-slate-900 dark:text-slate-100">{r.question}</p>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  How sure the system is: {r.confidence_score.toFixed(2)} · {formatRoute(r.routing_action)}
                </p>
              </div>
              <button
                onClick={() => onReview(r)}
                className={`shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-teal-400 dark:hover:bg-slate-800 ${FOCUS_RING}`}
              >
                Review
              </button>
            </div>
          </div>
        ))}
        {escalated.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            No answers waiting for a person.
          </p>
        )}
      </div>
    </section>
  )
}

export default function RfpDashboard() {
  const [results, setResults] = useState<RfpResult[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [source, setSource] = useState<DataSourceMode>('offline')
  const [fileFailed, setFileFailed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const [active, setActive] = useState(0)
  const [drawer, setDrawer] = useState<RfpResult | null>(null)
  const [review, setReview] = useState<RfpResult | null>(null)
  const [reviewerName, setReviewerName] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [mounted, theme])

  useEffect(() => {
    let activeMount = true
    const loadResults = fetch('/offline_demo_results.json')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('Failed to load offline_demo_results.json'))))
      .then((data: RfpResult[]) => {
        if (!activeMount) return
        if (Array.isArray(data) && data.length > 0) {
          setResults(data)
          setFileFailed(false)
        } else {
          setResults([])
          setFileFailed(true)
        }
      })
      .catch(() => {
        if (!activeMount) return
        setResults([])
        setFileFailed(true)
      })

    const loadHealth = fetch(`${API_BASE_URL}/health`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('Health check failed'))))
      .then((data: Health) => {
        if (!activeMount) return
        setHealth(data)
        setSource('live')
      })
      .catch(() => {
        if (!activeMount) return
        setHealth(null)
        setSource('offline')
      })

    Promise.allSettled([loadResults, loadHealth]).finally(() => {
      if (activeMount) setDataReady(true)
    })

    return () => {
      activeMount = false
    }
  }, [])

  const resolve = async (decision: HitlDecision, answer: string): Promise<string | null> => {
    if (!review) return null
    try {
      const response = await fetch(`${API_BASE_URL}/webhook/hitl-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: review.question_id,
          decision,
          edited_answer: answer,
          reviewer_name: reviewerName.trim(),
        }),
      })
      if (!response.ok) throw new Error('Decision endpoint failed')
      setResults(current =>
        current.map(r =>
          r.question_id === review.question_id
            ? {
                ...r,
                answer,
                needs_human_review: false,
                resolved_decision: decision,
                resolved_by: reviewerName.trim(),
              }
            : r
        )
      )
      setReview(null)
      return null
    } catch {
      return 'Failed to save review decision. The live review service may not be running.'
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-teal-700 text-white">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                RFP Auto-Responder
              </h1>
              <p className="mt-0.5 hidden text-xs text-slate-500 sm:block dark:text-slate-400">
                Security questionnaire review tool
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <a
              href="#try-it"
              onClick={e => scrollToSection(e, 'try-it')}
              className={`inline-flex h-9 items-center justify-center rounded-lg bg-teal-700 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-teal-800 ${FOCUS_RING}`}
            >
              Try it now
            </a>
            {dataReady ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                <span
                  className={`size-2 rounded-full ${source === 'live' ? 'bg-teal-700 dark:bg-teal-400' : 'bg-slate-400'}`}
                  aria-hidden="true"
                />
                {source === 'live' ? 'Live service connected' : 'Offline demo data'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <span className="size-2 rounded-full bg-slate-400" aria-hidden="true" />
                Checking status…
              </span>
            )}
            <button
              aria-label="Toggle dark mode"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className={`rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 ${FOCUS_RING}`}
            >
              {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
          </div>
        </div>
      </header>

      <OfflineBanner visible={dataReady && (source === 'offline' || fileFailed)} />

      <HeroSection source={source} dataReady={dataReady} />
      <HowItWorksSection />
      <WhatItDoesNotDoSection source={source} dataReady={dataReady} />

      {!dataReady ? (
        <main className="mx-auto max-w-[1440px] px-6 py-24 text-center text-sm text-slate-500 lg:px-10 dark:text-slate-400">
          Loading saved demo questions…
        </main>
      ) : (
        <main className="mx-auto max-w-[1440px] divide-y divide-slate-200 px-6 lg:px-10 dark:divide-slate-800">
          <TelemetryBar results={results} health={health} />

          <section id="try-it" aria-labelledby="try-it-heading" className="scroll-mt-8 py-24">
            <div className="mb-8">
              <h2 id="try-it-heading" className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Try a question
              </h2>
              <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
                Type a security question, or pick an example below.
              </p>
            </div>
            <Sandbox onResult={r => setResults(current => [r, ...current])} onStepChange={setActive} />
            <PipelineStepper active={active} />
          </section>

          <section id="all-results" aria-labelledby="all-results-heading" className="scroll-mt-8 py-24">
            <div className="mb-8">
              <h2
                id="all-results-heading"
                className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"
              >
                All results
              </h2>
              <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
                Review each answer, where it came from, and how confident the system is.
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Scores run from 0 to 1. Answers at 0.80 or higher are answered automatically.
              </p>
            </div>
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <ResponseMatrix results={results} source={source} onSelect={setDrawer} onReview={setReview} />
              <HitlQueue results={results} onReview={setReview} />
            </div>
          </section>
        </main>
      )}

      {drawer && <CitationDrawer result={drawer} onClose={() => setDrawer(null)} />}
      {review && (
        <HitlModal
          result={review}
          reviewerName={reviewerName}
          setReviewerName={setReviewerName}
          onClose={() => setReview(null)}
          onResolve={resolve}
        />
      )}
    </div>
  )
}
