import { Hono } from 'hono'
import { executeQuerySingle } from '../db.js'

export const circuitBreakersRouter = new Hono()

circuitBreakersRouter.get('/', (c) => {
  const today = new Date().toISOString().split('T')[0]
  
  const sql = `
    SELECT date, valuation_composite, lttd_regime, lttd_prob_sideways
    FROM unified_daily_analytics
    WHERE date <= ?
    ORDER BY date DESC
    LIMIT 1
  `

  const row = executeQuerySingle<any>(sql, [today])

  if (!row) {
    return c.json({
      status: 'error',
      message: 'No daily analytics records found within valid causal bounds.'
    }, 404)
  }

  const valScore = row.valuation_composite ?? 0
  const lttdRegime = row.lttd_regime ?? 'UNKNOWN'
  const probSideways = row.lttd_prob_sideways ?? 0

  const bubbleWarning = valScore >= 1.50
  const deepDiscount = valScore <= -1.00
  const sidewaysLock = lttdRegime === 'SIDEWAYS' && probSideways > 0.60

  return c.json({
    status: 'success',
    as_of_date: row.date,
    circuit_breakers: {
      bubble_warning: {
        active: bubbleWarning,
        threshold: '>= +1.50',
        current_valuation_score: valScore,
        action: 'Trigger macro take-profit defense filter across all trend systems'
      },
      deep_discount_override: {
        active: deepDiscount,
        threshold: '<= -1.00',
        current_valuation_score: valScore,
        action: 'Trigger macro accumulation defense filter'
      },
      sideways_zero_exposure_lock: {
        active: sidewaysLock,
        threshold: "LTTDRegime == 'SIDEWAYS' AND prob_sideways > 0.60",
        current_regime: lttdRegime,
        current_prob_sideways: probSideways,
        action: 'Force 0.0 target exposure on mid-term trend systems (MTTD and Ichimoku Quant)'
      }
    },
    overall_defense_posture: sidewaysLock || bubbleWarning 
      ? 'RESTRICTIVE / DEFENSIVE' 
      : deepDiscount 
        ? 'AGGRESSIVE ACCUMULATION' 
        : 'NORMAL TREND TRACKING'
  })
})
