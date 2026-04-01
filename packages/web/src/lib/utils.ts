import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function relativeTime(dateStr?: string): string {
  if (!dateStr) return "Never"
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return "Unknown"
  }
}

export function formatDuration(ms?: number): string {
  if (ms == null) return "-"
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00"
  if (cost < 0.001) return `<$0.001`
  return `$${cost.toFixed(4)}`
}

export function modelColor(model: string): string {
  switch (model?.toLowerCase()) {
    case "haiku":
      return "emerald"
    case "sonnet":
      return "blue"
    case "opus":
      return "violet"
    default:
      return "slate"
  }
}

/**
 * Clean raw log excerpt for display:
 * - Unescape \n to real newlines
 * - Strip JSON stream objects (Claude CLI output format)
 * - Strip base64 binary data blobs
 * - Collapse excessive whitespace
 */
export function cleanLogExcerpt(raw?: string | null, maxLen = 300): string {
  if (!raw) return ""
  let text = raw
    // Unescape literal \n
    .replace(/\\n/g, '\n')
    // Remove JSON stream objects like {"type":"assistant","message":{...}}
    .replace(/\{"type":"(?:assistant|human|system|tool_use|tool_result|content_block_(?:start|delta|stop)|message_(?:start|delta|stop))".+?\}(?:\n?)/g, '')
    // Remove base64 data blobs (40+ chars of base64)
    .replace(/[A-Za-z0-9+/=]{40,}/g, '[binary data]')
    // Remove [... truncated ...]
    .replace(/\[\.\.\.?\s*truncated\s*\.\.\.?\]/gi, '')
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (text.length > maxLen) text = text.slice(0, maxLen) + '...'
  return text
}

/**
 * Clean context capsule text for display:
 * - Unescape \n to real newlines
 */
export function cleanCapsuleText(raw?: string | null): string {
  if (!raw) return ""
  return raw.replace(/\\n/g, '\n').trim()
}

export function statusColor(status: string): string {
  switch (status) {
    case "idle":
      return "green"
    case "running":
      return "blue"
    case "error":
      return "red"
    case "paused":
      return "amber"
    case "success":
      return "green"
    case "cancelled":
      return "slate"
    default:
      return "slate"
  }
}
