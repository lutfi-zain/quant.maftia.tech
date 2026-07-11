/**
 * Maps a raw metric value to its corresponding oscillator score in [-2.0, +2.0]
 * based on 5 piecewise thresholds (t_minus_2 through t_plus_2).
 * Auto-detects whether the indicator is inverted or normal.
 */
export function mapToOscillator(
  rawValue: number | null,
  t_plus_2: number | null,
  t_plus_1: number | null,
  t_minus_1: number | null,
  t_minus_2: number | null
): number {
  if (rawValue === null || isNaN(rawValue)) {
    return 0.0
  }

  if (t_plus_2 === null && t_plus_1 === null && t_minus_1 === null && t_minus_2 === null) {
    return 0.0
  }

  // Auto-detect direction
  let inverted = false
  if (t_plus_2 !== null && t_minus_2 !== null) {
    inverted = t_plus_2 > t_minus_2
  } else if (t_plus_2 !== null && t_plus_1 !== null) {
    inverted = t_plus_2 > t_plus_1
  } else if (t_minus_1 !== null && t_minus_2 !== null) {
    inverted = t_minus_1 > t_minus_2
  }

  const is_bottom_only = t_minus_1 === null && t_minus_2 === null
  const is_top_only = t_plus_1 === null && t_plus_2 === null

  const safe_div = (num: number, denom: number) => {
    return Math.abs(denom) > 1e-9 ? num / denom : 0.0
  }

  if (is_bottom_only) {
    if (t_plus_2 === null || t_plus_1 === null) {
      return 0.0
    }
    if (!inverted) {
      // Normal direction (lower raw value = higher valuation/bottom = +2)
      if (rawValue <= t_plus_2) {
        return 2.0
      } else if (rawValue >= t_plus_1) {
        return 0.0
      } else {
        return 2.0 - safe_div(rawValue - t_plus_2, t_plus_1 - t_plus_2)
      }
    } else {
      // Inverted direction (higher raw value = higher valuation/bottom = +2)
      if (rawValue >= t_plus_2) {
        return 2.0
      } else if (rawValue <= t_plus_1) {
        return 0.0
      } else {
        return 1.0 + safe_div(rawValue - t_plus_1, t_plus_2 - t_plus_1)
      }
    }
  } else if (is_top_only) {
    if (t_minus_1 === null || t_minus_2 === null) {
      return 0.0
    }
    if (!inverted) {
      // Normal direction (higher raw value = lower valuation/top = -2)
      if (rawValue >= t_minus_2) {
        return -2.0
      } else if (rawValue <= t_minus_1) {
        return 0.0
      } else {
        return -1.0 - safe_div(rawValue - t_minus_1, t_minus_2 - t_minus_1)
      }
    } else {
      // Inverted direction (lower raw value = lower valuation/top = -2)
      if (rawValue <= t_minus_2) {
        return -2.0
      } else if (rawValue >= t_minus_1) {
        return 0.0
      } else {
        return -2.0 + safe_div(rawValue - t_minus_2, t_minus_1 - t_minus_2)
      }
    }
  } else {
    if (t_plus_2 === null || t_plus_1 === null || t_minus_1 === null || t_minus_2 === null) {
      return 0.0
    }
    if (!inverted) {
      // Normal direction
      if (rawValue <= t_plus_2) {
        return 2.0
      } else if (rawValue >= t_minus_2) {
        return -2.0
      } else if (rawValue >= t_plus_2 && rawValue < t_plus_1) {
        return 2.0 - safe_div(rawValue - t_plus_2, t_plus_1 - t_plus_2)
      } else if (rawValue >= t_plus_1 && rawValue < t_minus_1) {
        return 1.0 - 2.0 * safe_div(rawValue - t_plus_1, t_minus_1 - t_plus_1)
      } else {
        return -1.0 - safe_div(rawValue - t_minus_1, t_minus_2 - t_minus_1)
      }
    } else {
      // Inverted direction
      if (rawValue >= t_plus_2) {
        return 2.0
      } else if (rawValue <= t_minus_2) {
        return -2.0
      } else if (rawValue > t_plus_1 && rawValue <= t_plus_2) {
        return 1.0 + safe_div(rawValue - t_plus_1, t_plus_2 - t_plus_1)
      } else if (rawValue > t_minus_1 && rawValue <= t_plus_1) {
        return -1.0 + 2.0 * safe_div(rawValue - t_minus_1, t_plus_1 - t_minus_1)
      } else {
        return -2.0 + safe_div(rawValue - t_minus_2, t_minus_1 - t_minus_2)
      }
    }
  }
}
