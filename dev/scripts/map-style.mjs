// Builds the Visit section's light map style from OpenFreeMap's Positron (no API key, commercial use allowed;
// attribution: OpenFreeMap © OpenMapTiles, data © OpenStreetMap contributors). Tiles, glyphs and sprites stay on
// OpenFreeMap; only the style is re-coloured and trimmed, then hosted with the site as public/map/casita-light.json.
// Re-run when OpenFreeMap updates Positron:  node scripts/map-style.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SOURCE = "https://tiles.openfreemap.org/styles/positron";
const out = fileURLToPath(new URL("../public/map/casita-light.json", import.meta.url));

// Warm bone paper, sage streets, pale Kelly parks, deep agave labels.
const C = {
  paper: "#efe9dc",
  block: "#ebe4d5",
  building: "#e3dbca",
  buildingEdge: "#d6cdb9",
  park: "#d8e4cd",
  wood: "#d1dfc6",
  water: "#cbdad4",
  waterLine: "#bccfc7",
  minor: "#d9dfcd",
  path: "#e0e2d3",
  majorCase: "#c3cdb5",
  majorFill: "#f9f6ee",
  motorCase: "#b7c4aa",
  motorFill: "#f4f0e5",
  rail: "#d4cebf",
  label: "#1f3a2c",
  labelSoft: "#3f5a4b",
  waterLabel: "#557267",
};

const DROP = [
  /^boundary/, /^label_(country|state)/, /shield/, /^aeroway/, /^landcover_(ice|glacier)/, /^tunnel_/, /_subtle$/, /^airport$/,
];

const style = await (await fetch(SOURCE)).json();
delete style.sources.ne2_shaded;

const paint = {
  background: { "background-color": C.paper },
  park: { "fill-color": C.park },
  water: { "fill-color": C.water },
  landuse_residential: { "fill-color": C.block },
  landcover_wood: { "fill-color": C.wood },
  waterway: { "line-color": C.waterLine },
  building: { "fill-color": C.building, "fill-outline-color": C.buildingEdge },
  road_area_pier: { "fill-color": C.paper },
  road_pier: { "line-color": C.paper },
  highway_path: { "line-color": C.path },
  highway_minor: { "line-color": C.minor, "line-opacity": 1 },
  highway_major_casing: { "line-color": C.majorCase },
  highway_major_inner: { "line-color": C.majorFill },
  highway_motorway_casing: { "line-color": C.motorCase },
  highway_motorway_inner: { "line-color": C.motorFill },
  highway_motorway_bridge_casing: { "line-color": C.motorCase },
  highway_motorway_bridge_inner: { "line-color": C.motorFill },
  railway_transit: { "line-color": C.rail },
  railway_service: { "line-color": C.rail },
  railway: { "line-color": C.rail },
  railway_transit_dashline: { "line-color": C.paper },
  railway_service_dashline: { "line-color": C.paper },
  railway_dashline: { "line-color": C.paper },
};
const labelPaint = (color) => ({ "text-color": color, "text-halo-color": C.paper, "text-halo-width": 1.4, "text-halo-blur": 0.4 });

style.layers = style.layers
  .filter((layer) => layer.source !== "ne2_shaded" && !DROP.some((re) => re.test(layer.id)))
  .map((layer) => {
    if (paint[layer.id]) layer.paint = { ...layer.paint, ...paint[layer.id] };
    if (layer.type === "symbol") {
      const soft = /path|minor|waterway/.test(layer.id);
      const water = /^water_name/.test(layer.id);
      layer.paint = { ...layer.paint, ...labelPaint(water ? C.waterLabel : soft ? C.labelSoft : C.label) };
    }
    return layer;
  });

const unstyled = style.layers.filter((l) => l.type !== "symbol" && !paint[l.id]).map((l) => l.id);
if (unstyled.length) console.warn("left with Positron colours:", unstyled.join(", "));

style.name = "Lenny's Casita light";
style.metadata = { "casita:source": SOURCE, "casita:attribution": "OpenFreeMap © OpenMapTiles, data © OpenStreetMap contributors" };
mkdirSync(fileURLToPath(new URL("../public/map/", import.meta.url)), { recursive: true });
writeFileSync(out, JSON.stringify(style));
console.log(`wrote ${out} (${style.layers.length} layers)`);
