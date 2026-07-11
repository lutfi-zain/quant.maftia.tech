import { Hono } from 'hono'
import { executeQuery } from '../db.js'

export const componentsRouter = new Hono()

function normalizeSystemSource(rawInput?: string): string | null {
  if (!rawInput) return null
  const s = rawInput.trim().toUpperCase()
  if (s.includes('VALUATION')) return 'VALUATION'
  if (s.includes('LTTD') && !s.includes('ICHIMOKU')) return 'LTTD'
  if (s.includes('MTTD')) return 'MTTD'
  if (s.includes('ICHIMOKU')) return 'ICHIMOKU'
  return s
}

componentsRouter.get('/', (c) => {
  const query = c.req.query()
  const today = new Date().toISOString().split('T')[0]
  
  let effectiveEndDate = today
  if (query.end_date) {
    const requestedEnd = query.end_date.split('T')[0]
    effectiveEndDate = requestedEnd > today ? today : requestedEnd
  }

  let effectiveStartDate = query.start_date ? query.start_date.split('T')[0] : '2010-01-01'
  let limit = parseInt(query.limit || '500', 10)
  if (isNaN(limit) || limit <= 0) limit = 500
  if (limit > 5000) limit = 5000

  const conditions: string[] = []
  const params: any[] = []

  // If exact date requested
  if (query.date) {
    const exactDate = query.date.split('T')[0]
    if (exactDate <= today) {
      conditions.push(`date LIKE ?`)
      params.push(`${exactDate}%`)
    } else {
      // Future date requested -> causal filter blocks
      conditions.push(`1 = 0`)
    }
  } else {
    conditions.push(`date >= ?`)
    params.push(effectiveStartDate)
    conditions.push(`(date <= ? OR date LIKE ?)`)
    params.push(effectiveEndDate, `${effectiveEndDate}%`)
  }

  const systemSource = query.system || query.system_source
  const normalizedSystem = normalizeSystemSource(systemSource)
  if (normalizedSystem) {
    conditions.push(`system_source = ?`)
    params.push(normalizedSystem)
  }

  const componentName = query.component || query.component_name
  if (componentName) {
    conditions.push(`component_name = ?`)
    params.push(componentName)
  }

  params.push(limit)

  const sql = `
    SELECT date, system_source, component_name, raw_value, normalized_score, signal_direction
    FROM unified_component_signals
    WHERE ${conditions.join(' AND ')}
    ORDER BY date DESC, system_source ASC, component_name ASC
    LIMIT ?
  `

  const rows = executeQuery(sql, params)

  const data = rows.map((row: any) => ({
    date: row.date.split('T')[0],
    system_source: row.system_source,
    component_name: row.component_name,
    raw_value: row.raw_value,
    normalized_score: row.normalized_score,
    signal_direction: row.signal_direction
  }))

  return c.json({
    status: 'success',
    causal_filter: {
      applied: true,
      max_allowed_date: today,
      requested_end_date: query.end_date || query.date || null,
      effective_end_date: query.date ? (query.date.split('T')[0] <= today ? query.date.split('T')[0] : today) : effectiveEndDate
    },
    count: data.length,
    data
  })
})
