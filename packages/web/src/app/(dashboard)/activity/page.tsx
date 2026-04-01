"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getRuns, getCompanies, type Run, type Company } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { relativeTime, formatDuration, formatCost, cleanLogExcerpt } from "@/lib/utils"
import {
  Activity,
  CheckCircle,
  XCircle,
  Play,
  Clock,
  AlertTriangle,
  Filter,
  Ban,
} from "lucide-react"
import Link from "next/link"

const STATUS_ICON: Record<string, { icon: typeof CheckCircle; color: string }> = {
  completed: { icon: CheckCircle, color: "text-emerald-400" },
  failed: { icon: XCircle, color: "text-red-400" },
  running: { icon: Play, color: "text-blue-400" },
  queued: { icon: Clock, color: "text-slate-400" },
  timeout: { icon: AlertTriangle, color: "text-orange-400" },
  cancelled: { icon: Ban, color: "text-slate-400" },
}

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  running: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  queued: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  timeout: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  cancelled: "bg-slate-500/15 text-slate-400 border-slate-500/30",
}

function ActivityItem({ run }: { run: Run }) {
  const statusInfo = STATUS_ICON[run.status] ?? STATUS_ICON.queued
  const StatusIcon = statusInfo.icon
  const logPreview = cleanLogExcerpt(run.logExcerpt, 500)

  return (
    <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
      <CardContent className="p-4">
        {/* Header: Agent + Status + Time */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${statusInfo.color} shrink-0 mt-0.5`} />
            <div>
              <Link
                href={`/runs/${run.id}`}
                className="font-medium text-slate-100 hover:text-blue-400 transition-colors text-sm"
              >
                {run.agentName || "Unknown Agent"}
              </Link>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${STATUS_BADGE[run.status] ?? ""}`}
                >
                  {run.status}
                </Badge>
                {run.source && run.source !== "manual" && (
                  <span className="text-[10px] text-slate-600">via {run.source}</span>
                )}
                {run.companyName && (
                  <span className="text-[10px] text-slate-600">{run.companyName}</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0 ml-4">
            <span className="text-xs text-slate-500">
              {relativeTime(run.finishedAt ?? run.startedAt ?? run.createdAt)}
            </span>
            <div className="flex items-center gap-2 mt-0.5 justify-end">
              {run.durationMs && run.durationMs > 0 && (
                <span className="text-[10px] text-slate-600 font-mono">
                  {formatDuration(run.durationMs)}
                </span>
              )}
              {run.costCents > 0 && (
                <span className="text-[10px] text-slate-500 font-mono">
                  {formatCost(run.costCents)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Error message */}
        {run.error && (
          <div className="mt-2 p-2 bg-red-950/30 border border-red-900/30 rounded text-[11px] text-red-400 font-mono">
            {run.error.slice(0, 200)}
          </div>
        )}

        {/* Log excerpt preview */}
        {logPreview && !run.error && (
          <pre className="mt-2 p-2 bg-slate-950 border border-slate-800 rounded text-[11px] text-slate-400 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
            {logPreview.slice(0, 500)}
          </pre>
        )}

        {/* Token usage */}
        {(run.tokenInput > 0 || run.tokenOutput > 0) && (
          <div className="mt-2 flex gap-3 text-[10px] text-slate-600 font-mono">
            <span>{run.tokenInput.toLocaleString()} in</span>
            <span>{run.tokenOutput.toLocaleString()} out</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function ActivityPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [companyFilter, setCompanyFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const limit = 30

  const { data: companiesData } = useQuery({
    queryKey: ["companies"],
    queryFn: () => getCompanies({ limit: 100 }),
  })
  const companies: Company[] = companiesData?.companies ?? []

  const { data: runsData, isLoading } = useQuery({
    queryKey: ["activity-runs", statusFilter, page],
    queryFn: () =>
      getRuns({
        limit,
        page,
        status: statusFilter !== "all" ? (statusFilter as Run["status"]) : undefined,
        sort: "startedAt",
      }),
  })

  let runs = runsData?.runs ?? []
  if (companyFilter !== "all") {
    runs = runs.filter((r) => r.companyId === companyFilter)
  }

  const pagination = runsData?.pagination

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Activity className="h-6 w-6 text-emerald-400" />
          Activity Feed
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Chronological timeline of all agent actions, outputs, and events
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-slate-500" />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[140px] bg-slate-900 border-slate-700 text-sm text-slate-300">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all" className="text-slate-300">All statuses</SelectItem>
            <SelectItem value="completed" className="text-slate-300">Completed</SelectItem>
            <SelectItem value="failed" className="text-slate-300">Failed</SelectItem>
            <SelectItem value="running" className="text-slate-300">Running</SelectItem>
            <SelectItem value="timeout" className="text-slate-300">Timeout</SelectItem>
          </SelectContent>
        </Select>

        <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[200px] bg-slate-900 border-slate-700 text-sm text-slate-300">
            <SelectValue placeholder="Company" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all" className="text-slate-300">All companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-slate-300">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(statusFilter !== "all" || companyFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all")
              setCompanyFilter("all")
              setPage(1)
            }}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="bg-slate-900 border-slate-800 animate-pulse">
              <CardContent className="p-4 h-24" />
            </Card>
          ))}
        </div>
      ) : runs.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-8 text-center">
            <Activity className="h-8 w-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No activity found</p>
            <p className="text-sm text-slate-600 mt-1">
              Agent runs will appear here as they execute
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <ActivityItem key={run.id} run={run} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <span className="text-xs text-slate-500">
            {pagination.total} total runs — page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="text-xs"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
