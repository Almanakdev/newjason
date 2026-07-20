/**
 * Shared world raster for MapUI (full map) and MiniMap (HUD corner).
 *
 * The terrain is analytic, so the map is just terrainHeight() sampled per
 * pixel. That's ~1M samples, so it's built once, memoised here, and both
 * consumers draw from the same bitmap.
 */

import { terrainHeight, POND, RIVER_POINTS, PATH_POINTS, CITY, CITY_ROADS } from '../world/Terrain';
import { distToPolyline } from '../utils/math';
import { POI } from '../utils/constants';

export interface MapMarker {
  x: number;
  z: number;
  icon: string;
  label: string;
}

export const MARKERS: MapMarker[] = [
  { x: POI.waylightTower.x, z: POI.waylightTower.z, icon: '✨', label: 'Signal Tower' },
  { x: POI.cafe.x, z: POI.cafe.z, icon: '🫖', label: 'Café' },
  { x: POI.craftingPavilion.x, z: POI.craftingPavilion.z, icon: '🔨', label: 'Pavilion' },
  { x: POI.homePlot.x, z: POI.homePlot.z, icon: '🏡', label: 'Your plot' },
  { x: POI.pond.x, z: POI.pond.z, icon: '🎣', label: 'Pond' },
  { x: POI.valleyMeadow.x, z: POI.valleyMeadow.z, icon: '🌾', label: 'Whispergrass' },
  { x: POI.orinCamp.x, z: POI.orinCamp.z, icon: '⛺', label: 'Ranger camp' },
  { x: POI.valleyShrine.x, z: POI.valleyShrine.z, icon: '⛩', label: 'Shrine' },
  { x: POI.cityCrossing.x, z: POI.cityCrossing.z, icon: '🏙', label: 'Neon Ward' },
];

// Widened west (minX) so the city district at x≈-100 falls inside the map.
export const VIEW = { minX: -150, maxX: 210, minZ: -70, maxZ: 150 };

/** Raster width in px. 4px per world metre across the 360m span. */
const RASTER_W = 1440;
const RASTER_H = Math.round((RASTER_W * (VIEW.maxZ - VIEW.minZ)) / (VIEW.maxX - VIEW.minX));

/** World metres -> raster pixels. */
export const PX_PER_UNIT = RASTER_W / (VIEW.maxX - VIEW.minX);

let cached: HTMLCanvasElement | null = null;

/** World X/Z -> raster pixel coords. */
export function worldToRaster(x: number, z: number): { px: number; py: number } {
  return {
    px: ((x - VIEW.minX) / (VIEW.maxX - VIEW.minX)) * RASTER_W,
    py: ((z - VIEW.minZ) / (VIEW.maxZ - VIEW.minZ)) * RASTER_H,
  };
}

/** Terrain colours only — no markers, so the minimap can label independently. */
export function worldRaster(): HTMLCanvasElement {
  if (cached) return cached;

  const c = document.createElement('canvas');
  c.width = RASTER_W;
  c.height = RASTER_H;
  const ctx = c.getContext('2d');
  if (!ctx) {
    cached = c;
    return c;
  }

  const img = ctx.createImageData(RASTER_W, RASTER_H);
  for (let py = 0; py < RASTER_H; py++) {
    const z = VIEW.minZ + (py / RASTER_H) * (VIEW.maxZ - VIEW.minZ);
    for (let px = 0; px < RASTER_W; px++) {
      const x = VIEW.minX + (px / RASTER_W) * (VIEW.maxX - VIEW.minX);
      const y = terrainHeight(x, z);
      let r = 120, g = 185, b = 110; // grass
      if (Math.hypot(x, z) < 19) { r = 205; g = 208; b = 210; } // plaza
      if (distToPolyline(x, z, PATH_POINTS) < 3) { r = 200; g = 168; b = 119; }
      if (Math.hypot(x - POND.x, z - POND.z) < POND.radius) { r = 90; g = 160; b = 200; }
      if (distToPolyline(x, z, RIVER_POINTS) < 4) { r = 95; g = 165; b = 205; }
      if (y > 13) { r = 150; g = 158; b = 168; }
      if (y > 24) { r = 235; g = 240; b = 245; }
      // City district: asphalt with pale avenue lines.
      const dCity = Math.hypot(x - CITY.x, z - CITY.z);
      if (dCity < CITY.r) {
        r = 109; g = 114; b = 124;
        const dRoad = Math.min(
          distToPolyline(x, z, CITY_ROADS[0]),
          distToPolyline(x, z, CITY_ROADS[1])
        );
        if (dRoad < 1.6) { r = 201; g = 205; b = 212; }
      }
      const idx = (py * RASTER_W + px) * 4;
      img.data[idx] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  cached = c;
  return c;
}

/** The full map's labelled copy — raster plus baked marker icons and text. */
export function labelledRaster(): HTMLCanvasElement {
  const base = worldRaster();
  const c = document.createElement('canvas');
  c.width = base.width;
  c.height = base.height;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.drawImage(base, 0, 0);
  ctx.textAlign = 'center';
  for (const m of MARKERS) {
    const { px, py } = worldToRaster(m.x, m.z);
    ctx.font = '30px sans-serif';
    ctx.fillText(m.icon, px, py + 10);
    ctx.font = 'bold 19px sans-serif';
    ctx.fillStyle = '#33415c';
    ctx.fillText(m.label, px, py + 34);
  }
  return c;
}
