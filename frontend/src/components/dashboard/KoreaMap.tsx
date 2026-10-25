import { geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { useEffect, useMemo, useState } from 'react'
import { fillFor } from '../../lib/indexScale'
import { Spinner } from '../ui'

interface SidoProps {
  sido: string
  sidonm: string
}

interface DongProps {
  adm_cd2: string
  adm_nm: string
  sido: string
  sgg: string
  sggnm: string
}

interface Feature<P> {
  type: 'Feature'
  properties: P
  geometry: GeoPermissibleObjects
}

interface Collection<P> {
  type: 'FeatureCollection'
  features: Feature<P>[]
}

const WIDTH = 560
const HEIGHT = 620
const geoCache = new Map<string, Promise<unknown>>()

function loadGeo<T>(path: string): Promise<T> {
  let cached = geoCache.get(path)
  if (!cached) {
    cached = fetch(`${import.meta.env.BASE_URL}geo/${path}`).then((response) => {
      if (!response.ok) throw new Error(`geo ${path} ${response.status}`)
      return response.json()
    })
    geoCache.set(path, cached)
    cached.catch(() => geoCache.delete(path))
  }
  return cached as Promise<T>
}

export const SIDO_SHORT: Record<string, string> = {
  '11': '서울',
  '26': '부산',
  '27': '대구',
  '28': '인천',
  '29': '광주',
  '30': '대전',
  '31': '울산',
  '36': '세종',
  '41': '경기도',
  '43': '충청북도',
  '44': '충청남도',
  '46': '전라남도',
  '47': '경상북도',
  '48': '경상남도',
  '50': '제주',
  '51': '강원',
  '52': '전북',
}

const LABEL_OFFSET: Record<string, [number, number]> = {
  '11': [-34, -26],
  '28': [-38, 4],
  '41': [18, 30],
  '36': [10, -28],
  '30': [6, 14],
  '44': [-26, 6],
}

export function KoreaMap({
  provinceCode,
  sidoValues,
  dongValues,
  selectedDong,
  onSelectProvince,
  onSelectDong,
}: {
  provinceCode: string | null
  sidoValues: Map<string, number | null>
  dongValues: Map<string, number | null>
  selectedDong: string | null
  onSelectProvince: (code: string) => void
  onSelectDong: (code: string) => void
}) {
  const [sido, setSido] = useState<Collection<SidoProps> | null>(null)
  const [dongs, setDongs] = useState<Collection<DongProps> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadGeo<Collection<SidoProps>>('sido.json')
      .then(setSido)
      .catch(() => setError('지도 경계 자료를 불러오지 못했습니다.'))
  }, [])

  useEffect(() => {
    setDongs(null)
    if (!provinceCode) return
    let alive = true
    loadGeo<Collection<DongProps>>(`dong/${provinceCode}.json`)
      .then((value) => alive && setDongs(value))
      .catch(() => alive && setError('행정동 경계 자료를 불러오지 못했습니다.'))
    return () => {
      alive = false
    }
  }, [provinceCode])

  const view = useMemo(() => {
    const collection = provinceCode ? dongs : sido
    if (!collection) return null
    const projection = geoMercator().fitExtent(
      [
        [16, 16],
        [WIDTH - 16, HEIGHT - 16],
      ],
      collection as unknown as GeoPermissibleObjects,
    )
    const path = geoPath(projection)
    return { collection, path }
  }, [provinceCode, dongs, sido])

  if (error) return <p className="py-20 text-center text-subhead text-danger">{error}</p>
  if (!view) return <div className="flex h-[420px] items-center justify-center"><Spinner label="지도를 그리는 중" /></div>

  if (!provinceCode) {
    const features = (view.collection as Collection<SidoProps>).features
    return (
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mx-auto h-auto w-full max-w-[560px]" role="img" aria-label="전국 시도 지도">
        {features.map((feature) => (
          <path
            key={feature.properties.sido}
            d={view.path(feature.geometry) ?? undefined}
            style={{ fill: fillFor(sidoValues.get(feature.properties.sido)) }}
            strokeWidth={1}
            className="cursor-pointer stroke-(--map-stroke) transition-opacity duration-200 ease-out hover:opacity-80"
            onClick={() => onSelectProvince(feature.properties.sido)}
          >
            <title>{feature.properties.sidonm}</title>
          </path>
        ))}
        {features.map((feature) => {
          const [cx, cy] = view.path.centroid(feature.geometry)
          const [dx, dy] = LABEL_OFFSET[feature.properties.sido] ?? [0, 0]
          const [x, y] = [cx + dx, cy + dy]
          const label = SIDO_SHORT[feature.properties.sido] ?? feature.properties.sidonm
          return (
            <g key={`label-${feature.properties.sido}`} transform={`translate(${x},${y})`} className="pointer-events-none">
              {(dx !== 0 || dy !== 0) && <line x1={0} y1={0} x2={-dx} y2={-dy} strokeWidth={0.8} className="stroke-label-tertiary" />}
              <rect x={-label.length * 6 - 6} y={-10} width={label.length * 12 + 12} height={20} rx={10} fillOpacity={0.92} className="fill-elevated" />
              <text textAnchor="middle" dy="0.35em" fontSize={11} fontWeight={600} className="fill-label">
                {label}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  const features = (view.collection as Collection<DongProps>).features
  const selected = features.find((feature) => feature.properties.adm_cd2 === selectedDong)
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mx-auto h-auto w-full max-w-[560px]" role="img" aria-label="행정동 지도">
      {features.map((feature) => (
        <path
          key={feature.properties.adm_cd2}
          d={view.path(feature.geometry) ?? undefined}
          style={{ fill: fillFor(dongValues.get(feature.properties.adm_cd2)) }}
          strokeWidth={0.4}
          className="cursor-pointer stroke-(--map-stroke) transition-opacity duration-200 ease-out hover:opacity-75"
          onClick={() => onSelectDong(feature.properties.adm_cd2)}
        >
          <title>{feature.properties.adm_nm}</title>
        </path>
      ))}
      {selected && (
        <path d={view.path(selected.geometry) ?? undefined} fill="none" strokeWidth={2.5} strokeLinejoin="round" className="pointer-events-none stroke-label" />
      )}
    </svg>
  )
}
