// Visit map: a light, restrained MapLibre map of the blocks around the Casita. main.js imports this only when the
// Visit section approaches (never on Save-Data or without WebGL), so MapLibre stays out of the first load.
// Tiles come from OpenFreeMap (no key); the colours live in public/map/casita-light.json (scripts/map-style.mjs).
// The static map image underneath stays visible until the live map has fully rendered once, and remains if it can't.
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export function mountVisitMap(figure) {
  const container = figure.querySelector("[data-map-canvas]");
  const center = [Number(figure.dataset.lng), Number(figure.dataset.lat)];
  const fallback = (error) => {
    if (figure.dataset.mapState === "ready") return;
    figure.dataset.mapState = "fallback";
    console.warn("Lenny's Casita: live map unavailable, showing the static map.", error);
  };

  figure.dataset.mapState = "loading";
  figure.dataset.mapSize = `${container.clientWidth}x${container.clientHeight}`;
  let map;
  try {
    map = new maplibregl.Map({
      container,
      style: new URL(figure.dataset.mapStyle, document.baseURI).href,
      center,
      zoom: 15.3,
      minZoom: 13,
      maxZoom: 18,
      maxBounds: [[-118.45, 34.01], [-118.32, 34.1]],
      // Flat and north-up: no tilt, no rotation, no fly-ins.
      pitch: 0,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      // Page scroll stays page scroll: zoom with ⌘/Ctrl + scroll, pan with two fingers on touch.
      cooperativeGestures: true,
      attributionControl: false,
    });
  } catch (error) {
    fallback(error);
    return () => {};
  }
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.getCanvas().setAttribute("aria-label", "Map of the blocks around Lenny's Casita, 8823 W Pico Blvd, Los Angeles");

  // Custom marker: a Kelly dot with a soft halo; its label opens on hover, focus or tap.
  const pin = document.createElement("button");
  pin.type = "button";
  pin.className = "map-pin";
  pin.setAttribute("aria-expanded", "false");
  pin.innerHTML =
    '<span class="map-pin__dot" aria-hidden="true"></span>' +
    '<span class="map-pin__label"><strong>Lenny\'s Casita</strong><span>8823 W Pico Blvd</span><span>Los Angeles, CA 90035</span></span>';
  const setOpen = (open) => pin.setAttribute("aria-expanded", String(open));
  pin.addEventListener("click", () => setOpen(pin.getAttribute("aria-expanded") !== "true"));
  pin.addEventListener("keydown", (event) => event.key === "Escape" && setOpen(false));
  new maplibregl.Marker({ element: pin, anchor: "center" }).setLngLat(center).addTo(map);
  map.on("click", (event) => {
    if (!event.originalEvent.target.closest?.(".map-pin")) setOpen(false);
  });

  // ⌘/Ctrl + scroll belongs to the map; keep it from also scrolling the page underneath.
  const keepWheel = (event) => (event.metaKey || event.ctrlKey) && event.stopPropagation();
  figure.addEventListener("wheel", keepWheel, { passive: true });

  // The frame can still be settling when the map mounts; make sure the canvas matches it before the reveal.
  map.once("load", () => requestAnimationFrame(() => map.resize()));
  // Reveal only after the first complete render (style, tiles, labels), so it never flashes in half-drawn.
  map.once("idle", () => {
    map.resize();
    figure.dataset.mapSize = `${container.clientWidth}x${container.clientHeight}`;
    figure.dataset.mapState = "ready";
  });
  map.on("error", (event) => {
    if (figure.dataset.mapState !== "ready" && !event.sourceId) fallback(event.error);
  });

  return () => {
    figure.removeEventListener("wheel", keepWheel);
    map.remove();
  };
}
