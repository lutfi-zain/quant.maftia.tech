/**
 * Map a raw metric value to the [-2.0, +2.0] oscillator range using
 * 5 piecewise-linear threshold points.
 *
 * Auto-detects whether the metric is inverted (higher raw = more overvalued,
 * output near -2) or normal (higher raw = more undervalued, output near +2).
 */
export interface ThresholdConfig {
  t_minus_2: number;
  t_minus_1: number;
  t_zero: number;
  t_plus_1: number;
  t_plus_2: number;
}

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  t_minus_2: 2.0,
  t_minus_1: 1.0,
  t_zero: 0.0,
  t_plus_1: -1.0,
  t_plus_2: -2.0,
};

export function mapToOscillator(
  rawValue: number,
  t: ThresholdConfig,
): number {
  if (rawValue === null || isNaN(rawValue) || !isFinite(rawValue)) return NaN;

  const { t_minus_2, t_minus_1, t_zero, t_plus_1, t_plus_2 } = t;

  const tMinus2 = t_minus_2 ?? null;
  const tMinus1 = t_minus_1 ?? null;
  const tPlus1 = t_plus_1 ?? null;
  const tPlus2 = t_plus_2 ?? null;

  if (tPlus2 === null && tPlus1 === null && tMinus1 === null && tMinus2 === null) {
    return 0.0;
  }

  // Auto-detect direction: inverted if t_plus_2 > t_minus_2
  let inverted = false;
  if (tPlus2 !== null && tMinus2 !== null) {
    inverted = tPlus2 > tMinus2;
  } else if (tPlus2 !== null && tPlus1 !== null) {
    inverted = tPlus2 > tPlus1;
  } else if (tMinus1 !== null && tMinus2 !== null) {
    inverted = tMinus1 > tMinus2;
  }

  const isBottomOnly = tMinus1 === null && tMinus2 === null;
  const isTopOnly = tPlus1 === null && tPlus2 === null;

  const safeDiv = (num: number, denom: number) =>
    Math.abs(denom) > 1e-9 ? num / denom : 0.0;

  if (isBottomOnly) {
    if (tPlus2 === null || tPlus1 === null) return 0.0;
    if (!inverted) {
      if (rawValue <= tPlus2) return 2.0;
      if (rawValue >= tPlus1) return 0.0;
      return 2.0 - safeDiv(rawValue - tPlus2, tPlus1 - tPlus2);
    } else {
      if (rawValue >= tPlus2) return 2.0;
      if (rawValue <= tPlus1) return 0.0;
      return 1.0 + safeDiv(rawValue - tPlus1, tPlus2 - tPlus1);
    }
  } else if (isTopOnly) {
    if (tMinus1 === null || tMinus2 === null) return 0.0;
    if (!inverted) {
      if (rawValue >= tMinus2) return -2.0;
      if (rawValue <= tMinus1) return 0.0;
      return -1.0 - safeDiv(rawValue - tMinus1, tMinus2 - tMinus1);
    } else {
      if (rawValue <= tMinus2) return -2.0;
      if (rawValue >= tMinus1) return 0.0;
      return -2.0 + safeDiv(rawValue - tMinus2, tMinus1 - tMinus2);
    }
  } else {
    if (tPlus2 === null || tPlus1 === null || tMinus1 === null || tMinus2 === null) {
      return 0.0;
    }
    if (!inverted) {
      if (rawValue <= tPlus2) return 2.0;
      if (rawValue >= tMinus2) return -2.0;
      if (tPlus2 <= rawValue && rawValue < tPlus1) {
        return 2.0 - safeDiv(rawValue - tPlus2, tPlus1 - tPlus2);
      }
      if (tPlus1 <= rawValue && rawValue < tMinus1) {
        return 1.0 - 2.0 * safeDiv(rawValue - tPlus1, tMinus1 - tPlus1);
      }
      return -1.0 - safeDiv(rawValue - tMinus1, tMinus2 - tMinus1);
    } else {
      if (rawValue >= tPlus2) return 2.0;
      if (rawValue <= tMinus2) return -2.0;
      if (tPlus1 < rawValue && rawValue <= tPlus2) {
        return 1.0 + safeDiv(rawValue - tPlus1, tPlus2 - tPlus1);
      }
      if (tMinus1 < rawValue && rawValue <= tPlus1) {
        return -1.0 + 2.0 * safeDiv(rawValue - tMinus1, tPlus1 - tMinus1);
      }
      return -2.0 + safeDiv(rawValue - tMinus2, tMinus1 - tMinus2);
    }
  }
}
