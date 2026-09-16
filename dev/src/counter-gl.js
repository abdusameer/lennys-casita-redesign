// One canvas, one job: flip the plate photos tile by tile, like the glazed wall they were shot against.
// Renders on demand only (no idle loop), pauses offscreen/hidden, and disposes everything on destroy().
import {
  WebGLRenderer,
  Scene,
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  Mesh,
  Texture,
  Vector2,
  Vector4,
  LinearFilter,
  LinearSRGBColorSpace,
} from "three";

const GRID = new Vector2(7, 4);
const OBJECT_POSITION = { x: 0.5, y: 0.72 }; // matches .counter__img img { object-position }

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform vec4 uCropA;
  uniform vec4 uCropB;
  uniform float uProgress;
  uniform vec2 uGrid;
  uniform vec2 uPointer;
  uniform float uGlint;
  uniform float uAspect;

  const vec3 GROUT = vec3(0.031, 0.145, 0.090);
  const float PI = 3.14159265;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  vec3 sampleCover(sampler2D tex, vec4 crop, vec2 uv) {
    vec2 st = vec2(crop.x + uv.x * crop.z, 1.0 - (crop.y + (1.0 - uv.y) * crop.w));
    return texture2D(tex, st).rgb;
  }

  void main() {
    vec2 cell = floor(vUv * uGrid);
    vec2 local = fract(vUv * uGrid);
    vec2 center = (cell + 0.5) / uGrid;

    // Diagonal wave from top-left, loosened with per-tile jitter.
    float delay = (center.x * 0.55 + (1.0 - center.y) * 0.45) * 0.72 + hash(cell) * 0.28;
    float p = smoothstep(0.0, 1.0, clamp(uProgress * 2.0 - delay, 0.0, 1.0));

    float angle = p * PI;
    float squash = max(abs(cos(angle)), 0.0001);
    float lx = (local.x - 0.5) / squash + 0.5;
    float lift = sin(angle);

    vec3 color;
    if (lx < 0.0 || lx > 1.0) {
      color = GROUT;
    } else {
      vec2 uv = (cell + vec2(lx, local.y)) / uGrid;
      color = p < 0.5 ? sampleCover(uTexA, uCropA, uv) : sampleCover(uTexB, uCropB, uv);
      // Edge-on tiles darken; a glaze highlight sweeps across while they turn.
      color *= mix(1.0, 0.45, lift);
      float sweep = 1.0 - abs(lx - (p < 0.5 ? 1.0 - p * 2.0 : (p - 0.5) * 2.0));
      color += pow(max(sweep, 0.0), 10.0) * lift * 0.35;
      // Grout gap opens only mid-flip, so resting images stay identical to the <img>.
      float gapX = lift * 0.045;
      float gapY = gapX * (uGrid.y / uGrid.x) * uAspect;
      if (local.x < gapX || local.x > 1.0 - gapX || local.y < gapY || local.y > 1.0 - gapY) color = GROUT;
    }

    // Pointer glint: a faint diagonal sheen on the tiles nearest the pointer.
    if (uGlint > 0.001) {
      vec2 d = (center - uPointer) * vec2(uAspect, 1.0);
      float near = smoothstep(0.32, 0.0, length(d));
      float streak = pow(max(1.0 - abs(local.x + local.y * 0.45 - 0.72) * 3.2, 0.0), 3.0);
      color += streak * near * uGlint * 0.14;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

// A cross-origin (or file://) image uploads as a black texture. Throwing here keeps the <img> fallback.
function assertReadable(img) {
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const context = probe.getContext("2d", { willReadFrequently: true });
  context.drawImage(img, 0, 0, 1, 1);
  context.getImageData(0, 0, 1, 1); // SecurityError when the image taints the canvas
}

// Textures come from a detached copy of the photo the page chose, so a responsive <img> swapping
// srcset candidates later can never change a texture's size after GPU storage is allocated.
function loadTexture(img) {
  const source = new Image();
  source.decoding = "async";
  source.src = img.currentSrc || img.src;
  return source.decode().then(() => {
    assertReadable(source);
    const texture = new Texture(source);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  });
}

function cropFor(texture, aspect) {
  const { naturalWidth: w, naturalHeight: h } = texture.image;
  const imageAspect = w / h;
  if (imageAspect > aspect) {
    const frac = aspect / imageAspect;
    return new Vector4((1 - frac) * OBJECT_POSITION.x, 0, frac, 1);
  }
  const frac = imageAspect / aspect;
  return new Vector4(0, (1 - frac) * OBJECT_POSITION.y, 1, frac);
}

export async function createCounterGL({ mount, frame, images, onLost }) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: false, alpha: false, powerPreference: "low-power" });
  } catch {
    return null;
  }
  // 1.5 is the point where more backing pixels stop being visible on this frame but keep costing fill rate.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(0x082517, 1);

  let textures;
  try {
    textures = await Promise.all(images.map(loadTexture));
  } catch {
    renderer.dispose();
    return null;
  }

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new PlaneGeometry(2, 2);
  const uniforms = {
    uTexA: { value: textures[0] },
    uTexB: { value: textures[1 % textures.length] },
    uCropA: { value: new Vector4(0, 0, 1, 1) },
    uCropB: { value: new Vector4(0, 0, 1, 1) },
    uProgress: { value: 0 },
    uGrid: { value: GRID },
    uPointer: { value: new Vector2(0.5, 0.5) },
    uGlint: { value: 0 },
    uAspect: { value: 0.8 },
  };
  const material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms });
  scene.add(new Mesh(geometry, material));

  const canvas = renderer.domElement;
  mount.appendChild(canvas);

  const state = { from: 0, to: 1, visible: true, lost: false, glintTarget: 0, raf: 0, aspect: 0.8 };

  function applyCrops() {
    uniforms.uCropA.value.copy(cropFor(textures[state.from], state.aspect));
    uniforms.uCropB.value.copy(cropFor(textures[state.to], state.aspect));
  }

  function draw() {
    state.raf = 0;
    if (state.lost) return;
    const g = uniforms.uGlint.value;
    uniforms.uGlint.value = g + (state.glintTarget - g) * 0.12;
    renderer.render(scene, camera);
    if (Math.abs(state.glintTarget - uniforms.uGlint.value) > 0.002) request();
  }

  function request() {
    if (state.raf || !state.visible || document.hidden || state.lost) return;
    state.raf = requestAnimationFrame(draw);
  }

  function resize() {
    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    state.aspect = rect.width / rect.height;
    uniforms.uAspect.value = state.aspect;
    applyCrops();
    request();
  }

  function set(from, to, progress) {
    if (from !== state.from || to !== state.to) {
      state.from = from;
      state.to = to;
      uniforms.uTexA.value = textures[from];
      uniforms.uTexB.value = textures[to];
      applyCrops();
    }
    uniforms.uProgress.value = progress;
    request();
  }

  let pointerQueued = false;
  let lastEvent = null;
  const onPointerMove = (event) => {
    if (event.pointerType === "touch") return;
    lastEvent = event;
    if (pointerQueued) return;
    pointerQueued = true;
    requestAnimationFrame(() => {
      pointerQueued = false;
      const rect = frame.getBoundingClientRect();
      uniforms.uPointer.value.set((lastEvent.clientX - rect.left) / rect.width, 1 - (lastEvent.clientY - rect.top) / rect.height);
      state.glintTarget = 1;
      request();
    });
  };
  const onPointerLeave = () => {
    state.glintTarget = 0;
    request();
  };
  const onVisibility = () => request();
  const onLostContext = (event) => {
    event.preventDefault();
    state.lost = true;
    onLost?.();
  };

  frame.addEventListener("pointermove", onPointerMove);
  frame.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("blur", onPointerLeave);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onLostContext);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(frame);
  const intersection = new IntersectionObserver(([entry]) => {
    state.visible = entry.isIntersecting;
    request();
  });
  intersection.observe(frame);

  resize();
  renderer.render(scene, camera);

  return {
    set,
    destroy() {
      cancelAnimationFrame(state.raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      frame.removeEventListener("pointermove", onPointerMove);
      frame.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLostContext);
      textures.forEach((t) => t.dispose());
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
