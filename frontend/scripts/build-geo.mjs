import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { geoArea } from 'd3-geo'
import mapshaper from 'mapshaper'

const source = process.argv[2]
if (!source) {
  console.error('usage: npm run build:geo -- <HangJeongDong_ver20250701.geojson>')
  process.exit(1)
}

const outDir = path.resolve('public/geo')
const dongDir = path.join(outDir, 'dong')
await rm(outDir, { recursive: true, force: true })
await mkdir(dongDir, { recursive: true })

const base = `-i "${source}" snap -simplify 6% keep-shapes -filter-fields adm_cd2,adm_nm,sido,sidonm,sgg,sggnm`

await mapshaper.runCommands(
  `${base} -dissolve sido copy-fields=sidonm -o "${path.join(outDir, 'sido.json')}" format=geojson precision=0.0001`,
)
await mapshaper.runCommands(
  `${base} -split sido -o "${dongDir}/" format=geojson precision=0.0001 extension=json`,
)

for (const file of await readdir(dongDir)) {
  const code = file.match(/(\d{2})\.json$/)?.[1]
  if (code && file !== `${code}.json`) await rename(path.join(dongDir, file), path.join(dongDir, `${code}.json`))
}
const rewindForD3 = async (file) => {
  const data = JSON.parse(await readFile(file, 'utf8'))
  for (const feature of data.features) {
    if (geoArea(feature) <= 2 * Math.PI) continue
    const geometry = feature.geometry
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
    for (const polygon of polygons) for (const ring of polygon) ring.reverse()
  }
  await writeFile(file, JSON.stringify(data))
}

await rewindForD3(path.join(outDir, 'sido.json'))
for (const file of await readdir(dongDir)) {
  await rewindForD3(path.join(dongDir, file))
  const { size } = await stat(path.join(dongDir, file))
  console.log(file, Math.round(size / 1024), 'KB')
}
console.log('sido.json', Math.round((await stat(path.join(outDir, 'sido.json'))).size / 1024), 'KB')
