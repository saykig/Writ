import * as d3 from "d3";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FeatureCollection, Geometry } from "geojson";

const WEB_ROOT = resolve(import.meta.dir, "..");
const landPath = resolve(WEB_ROOT, "public/data/ne_110m_land.json");
const dotsPath = resolve(WEB_ROOT, "public/data/ne_110m_land_dots.json");
const land = JSON.parse(readFileSync(landPath, "utf8")) as FeatureCollection<Geometry>;
const dots: [number, number][] = [];

for (let latitude = -84; latitude <= 84; latitude += 1.75) {
  const longitudeStep = Math.max(1.75, 1.75 / Math.cos((latitude * Math.PI) / 180));
  for (let longitude = -180; longitude < 180; longitude += longitudeStep) {
    const point: [number, number] = [longitude, latitude];
    if (d3.geoContains(land, point)) dots.push(point);
  }
}

writeFileSync(dotsPath, `${JSON.stringify(dots)}\n`);
console.log(`Generated ${dots.length} globe dots at ${dotsPath}`);
