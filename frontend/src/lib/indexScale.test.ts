import { describe, expect, it } from 'vitest'
import { INDEX_BINS, NO_VALUE_FILL, binFor, fillFor, weightedAverage } from './indexScale'

describe('index scale', () => {
  it('puts each value in exactly one bin', () => {
    expect(binFor(33.2)?.label).toBe(INDEX_BINS[0].label)
    expect(binFor(34)?.label).toBe(INDEX_BINS[1].label)
    expect(binFor(36.99)?.label).toBe(INDEX_BINS[3].label)
    expect(binFor(37)?.label).toBe(INDEX_BINS[4].label)
  })

  it('uses the empty fill for a missing value', () => {
    expect(binFor(null)).toBeNull()
    expect(fillFor(undefined)).toBe(NO_VALUE_FILL)
  })

  it('weights by population and skips missing values', () => {
    expect(weightedAverage([{ value: 30, weight: 1 }, { value: 40, weight: 3 }, { value: null, weight: 100 }])).toBe(37.5)
    expect(weightedAverage([{ value: null, weight: 1 }])).toBeNull()
  })
})
