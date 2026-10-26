import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RegionBackground } from '../components/report/ReportSections'
import type { AnalysisReport } from '../api/types'
import { displayScore, provinceDisplayScore } from './indexScale'

describe('I5 display score', () => {
  it('uses the model score and never substitutes a raw score', () => {
    expect(displayScore({ i5_display_score: 4.08 })).toBe(4.08)
    expect(displayScore({ i5_display_score: null })).toBeNull()
    expect(displayScore({})).toBeNull()
    expect(displayScore({ i5_display_score: 34.44 })).toBeNull()
  })

  it('weights raw scores by adult population before clipping the province score', () => {
    // Values equidistant around the reference mean: adult weights 1:3 -> z=2.5.
    expect(provinceDisplayScore([
      { i5_reference: 30.918084243310748, population_20plus: 1 },
      { i5_reference: 39.54128544883993, population_20plus: 3 },
      { i5_reference: null, population_20plus: 100 },
    ])).toBeCloseTo(7.5, 10)
    expect(provinceDisplayScore([])).toBeNull()
  })

  it('shows a ten-point total and retains the domain hundred-point unit', () => {
    const report = { scope: {}, context: { i5: { record: { i5_reference: 34.44, i5_display_score: 4.08,
      domain_scores: { E: 54.3 } } } } } as unknown as AnalysisReport
    const markup = renderToStaticMarkup(createElement(RegionBackground, { report }))
    expect(markup).toContain('4.08')
    expect(markup).toContain('/10')
    expect(markup).not.toContain('34.44')
    expect(markup).toContain('54.30')
    expect(markup).toContain('0~100')
  })
})
