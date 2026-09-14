// Home page entry.
import { gsap, ScrollTrigger, $, $$, reduceMotion, listen, onCleanup, scrollToY, offsetOf, splitWords, boot } from "./shared.js";
import "./styles/sections.css";
import "./styles/home.css";

const VIMEO_ORIGIN = "https://player.vimeo.com";

/* ---------------- film: a night at the Casita ---------------- */
// The restaurant's own Vimeo film is the hero. Scroll moves through five scenes; each scene seeks the
// film to that moment through Vimeo's postMessage API. The poster stays until the player reports playback.
function initFilm() {
  const section = $("[data-film]");
  if (!section) return;
  const pinEl = $("[data-film-pin]", section);
  const stage = $("[data-film-stage]", section);
  const media = $("[data-film-media]", section);
  const shade = $("[data-film-shade]", section);
  const holder = $("[data-film-video]", section);
  const intro = $("[data-film-intro]", section);
  const beatsWrap = $("[data-film-beats]", section);
  const beats = $$("[data-beat]", section);
  const index = $("[data-film-index]", section);
  const stills = $$("[data-beat-go]", section);
  const toggle = $("[data-film-toggle]", section);
  const toggleLabel = $("[data-film-toggle-label]", section);
  const sceneStills = $$("[data-film-still]", section);
  const beatStart = 0.16;

  let iframe = null;
  let ready = false;
  let playing = !reduceMotion;
  let inView = true;
  let active = 0;
  let pendingSeek = null;
  let pin = null;

  const post = (method, value) => {
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(JSON.stringify(value === undefined ? { method } : { method, value }), VIMEO_ORIGIN);
  };

  const syncToggle = () => {
    toggle.classList.toggle("is-paused", !playing);
    toggle.setAttribute("aria-pressed", String(!playing));
    toggleLabel.textContent = playing ? "Pause film" : "Play film";
  };

  const loadVideo = ({ controls = false } = {}) => {
    if (iframe) return;
    const src = new URL(holder.dataset.src);
    if (controls) {
      src.searchParams.set("background", "0");
      section.classList.add("has-controls");
    }
    iframe = document.createElement("iframe");
    iframe.src = src.toString();
    iframe.title = holder.dataset.title;
    iframe.allow = "autoplay; fullscreen; picture-in-picture";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    if (!controls) iframe.tabIndex = -1;
    listen(iframe, "load", () => {
      post("addEventListener", "play");
      post("addEventListener", "timeupdate");
    });
    holder.appendChild(iframe);
  };

  listen(window, "message", (event) => {
    if (event.origin !== VIMEO_ORIGIN || !iframe || event.source !== iframe.contentWindow || ready) return;
    let data = event.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }
    if (!["ready", "play", "playing", "timeupdate", "playProgress"].includes(data?.event)) return;
    ready = true;
    section.classList.add("has-video");
    if (pendingSeek !== null) {
      post("setCurrentTime", pendingSeek);
      pendingSeek = null;
    }
    if (!playing || !inView) post("pause");
  });

  const seekTo = (i) => {
    const time = Number(beats[i].dataset.time);
    if (!ready) {
      pendingSeek = time;
      return;
    }
    post("setCurrentTime", time);
    if (playing && inView) post("play");
  };

  const setActive = (i) => {
    if (i === active) return;
    active = i;
    beats.forEach((beat, n) => beat.classList.toggle("is-active", n === i));
    sceneStills.forEach((img, n) => img.classList.toggle("is-active", n === i));
    stills.forEach((still, n) => {
      still.classList.toggle("is-active", n === i);
      if (n === i) still.setAttribute("aria-current", "true");
      else still.removeAttribute("aria-current");
    });
    const still = stills[i];
    if (still && index.scrollWidth > index.clientWidth + 2) {
      index.scrollTo({ left: still.offsetLeft - index.offsetLeft - (index.clientWidth - still.offsetWidth) / 2, behavior: reduceMotion ? "auto" : "smooth" });
    }
    seekTo(i);
  };
  stills[0]?.setAttribute("aria-current", "true");

  const startFilm = () => {
    playing = true;
    loadVideo({ controls: reduceMotion });
    syncToggle();
  };

  listen(toggle, "click", () => {
    if (!iframe) return startFilm();
    playing = !playing;
    post(playing ? "play" : "pause");
    syncToggle();
  });

  stills.forEach((still, i) =>
    listen(still, "click", () => {
      if (pin) {
        const progress = beatStart + ((i + 0.5) / beats.length) * (1 - beatStart);
        scrollToY(pin.start + progress * (pin.end - pin.start));
      } else if (section.classList.contains("is-sticky")) {
        scrollToY(offsetOf(beats[i]) - stage.offsetHeight - 16);
      } else {
        if (!iframe) startFilm();
        section.classList.add("is-story");
        setActive(i);
      }
    })
  );

  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (ready) post(inView && playing ? "play" : "pause");
  });
  observer.observe(section);
  onCleanup(() => observer.disconnect());

  const mm = gsap.matchMedia();
  mm.add(
    {
      desktop: "(min-width: 900px) and (prefers-reduced-motion: no-preference)",
      phone: "(max-width: 899px) and (prefers-reduced-motion: no-preference)",
    },
    (context) => {
      if (context.conditions.desktop) {
        section.classList.add("is-pinned");
        gsap.set([beatsWrap, index], { autoAlpha: 0 });
        const timeline = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: section,
            pin: pinEl,
            start: "top top",
            end: () => `+=${Math.round(window.innerHeight * 4.4)}`,
            scrub: 0.6,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const p = self.progress;
              section.classList.toggle("is-story", p >= beatStart - 0.02);
              setActive(p < beatStart ? 0 : Math.min(beats.length - 1, Math.floor(((p - beatStart) / (1 - beatStart)) * beats.length)));
            },
          },
        });
        timeline
          .to(intro, { autoAlpha: 0, y: -48, duration: 0.08 }, 0)
          .to(stage, { scale: 0.56, x: () => -window.innerWidth * 0.035, borderRadius: 28, duration: 0.12 }, 0.02)
          .to(shade, { opacity: 0.15, duration: 0.12 }, 0.02)
          .to([beatsWrap, index], { autoAlpha: 1, duration: 0.05 }, beatStart - 0.04)
          .to({}, { duration: 1 - beatStart }, beatStart);
        pin = timeline.scrollTrigger;
        return () => {
          section.classList.remove("is-pinned", "is-story");
          pin = null;
        };
      }
      section.classList.add("is-sticky");
      beats.forEach((beat, i) =>
        ScrollTrigger.create({
          trigger: beat,
          start: "top 70%",
          end: "bottom 70%",
          onToggle: (self) => {
            if (!self.isActive) return;
            section.classList.add("is-story");
            setActive(i);
          },
          onLeaveBack: i === 0 ? () => section.classList.remove("is-story") : undefined,
        })
      );
      return () => section.classList.remove("is-sticky", "is-story");
    }
  );
  onCleanup(() => mm.revert());

  if (!reduceMotion) {
    // Intro: the film settles in while the headline rises. Actions stay visible from the first frame.
    const words = $$("[data-film-split]", section).flatMap(splitWords);
    gsap.set(words, { yPercent: 115 });
    gsap
      .timeline({ delay: 0.1, defaults: { ease: "expo.out" } })
      .fromTo(media, { scale: 1.12 }, { scale: 1, duration: 2.4 }, 0)
      .to(words, { yPercent: 0, duration: 1.1, stagger: 0.06 }, 0.15);

    if (!navigator.connection?.saveData) {
      const start = () => setTimeout(() => loadVideo(), 300);
      if (document.readyState === "complete") start();
      else listen(window, "load", start, { once: true });
    }
  }
  syncToggle();
}

/* ---------------- plate tour ---------------- */
function initCounter() {
  const section = $("[data-counter]");
  const items = $$("[data-plate]", section);
  const figures = $$(".counter__img", section);
  const indexEl = $("[data-plate-index]", section);
  const count = figures.length;
  const glProgress = { value: 0 };
  let active = 0;
  let gl = null;
  let pin = null;
  let tween = null;

  const setActive = (index) => {
    if (index === active) return;
    active = index;
    items.forEach((item, n) => {
      const on = n === index;
      item.classList.toggle("is-active", on);
      const button = $("button", item);
      if (on) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    figures.forEach((figure, n) => figure.classList.toggle("is-active", n === index));
    indexEl.textContent = String(index + 1).padStart(2, "0");
  };

  const renderFromPin = (progress) => {
    const x = progress * (count - 1);
    const from = Math.min(Math.floor(x), count - 2);
    const t = gsap.utils.clamp(0, 1, (x - from - 0.3) / 0.4);
    gl?.set(from, from + 1, t);
    setActive(Math.round(x));
  };

  const go = (index) => {
    const next = (index + count) % count;
    if (pin) {
      scrollToY(pin.start + (next / (count - 1)) * (pin.end - pin.start));
      return;
    }
    if (next === active) return;
    const from = active;
    setActive(next);
    if (!gl) return;
    tween?.kill();
    glProgress.value = 0;
    tween = gsap.to(glProgress, {
      value: 1,
      duration: 1.3,
      ease: "power2.inOut",
      onUpdate: () => gl?.set(from, next, glProgress.value),
    });
  };

  items.forEach((item, n) => listen($("button", item), "click", () => go(n)));
  listen($("[data-plate-prev]", section), "click", () => go(active - 1));
  listen($("[data-plate-next]", section), "click", () => go(active + 1));
  listen($("[data-plates]", section), "keydown", (event) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (!step || !event.target.closest(".plate__btn")) return;
    event.preventDefault();
    const next = (active + step + count) % count;
    go(next);
    $("button", items[next]).focus({ preventScroll: true });
  });

  const mm = gsap.matchMedia();
  mm.add("(min-width: 961px) and (prefers-reduced-motion: no-preference)", () => {
    section.classList.add("is-pinned");
    pin = ScrollTrigger.create({
      trigger: section,
      pin: $("[data-counter-pin]", section),
      start: "top top",
      end: () => `+=${(count - 1) * window.innerHeight * 0.7}`,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => renderFromPin(self.progress),
    });
    return () => {
      section.classList.remove("is-pinned");
      pin = null;
      gl?.set(active, active, 0);
    };
  });
  onCleanup(() => {
    tween?.kill();
    mm.revert();
    gl?.destroy();
    gl = null;
  });

  // WebGL is an enhancement: lazy-loaded near the section, never under reduced motion.
  if (reduceMotion || !hasWebGL()) return;
  const observer = new IntersectionObserver(
    async ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const { createCounterGL } = await import("./counter-gl.js");
      gl = await createCounterGL({
        mount: $("[data-counter-gl]", section),
        frame: $(".counter__frame", section),
        images: figures.map((figure) => $("img", figure)),
        onLost: () => {
          section.classList.remove("gl-ready");
          gl = null;
        },
      });
      if (!gl) return;
      if (pin) renderFromPin(pin.progress);
      else gl.set(active, active, 0);
      section.classList.add("gl-ready");
    },
    { rootMargin: "800px 0px" }
  );
  observer.observe(section);
  onCleanup(() => observer.disconnect());
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/* ---------------- after dark: the sign drifts apart ---------------- */
function initBarDrift() {
  if (reduceMotion) return;
  const intro = $(".pours__intro");
  if (!intro) return;
  const drift = { trigger: intro, start: "top bottom", end: "bottom top", scrub: 0.8 };
  gsap.fromTo($(".bar__sign:not(.bar__sign--end)", intro), { xPercent: 5 }, { xPercent: -5, ease: "none", scrollTrigger: { ...drift } });
  gsap.fromTo($(".bar__sign--end", intro), { xPercent: -5 }, { xPercent: 5, ease: "none", scrollTrigger: { ...drift } });
}

/* ---------------- after dark: one pour at a time ---------------- */
function initPours() {
  const section = $("[data-pours]");
  if (!section) return;
  const stage = $("[data-pours-stage]", section);
  const pours = $$("[data-pour]", section);
  const indexEl = $("[data-pour-index]", section);
  const bar = $("[data-pour-progress]", section);
  const partsOf = (pour) => ({ photo: $(".pour__photo", pour), copy: $$(".pour__copy > *", pour) });
  let active = -1;

  const show = (i, immediate = false) => {
    if (i === active) return;
    const previous = pours[active];
    active = i;
    const next = pours[i];
    pours.forEach((pour, n) => pour.classList.toggle("is-active", n === i));
    indexEl.textContent = String(i + 1).padStart(2, "0");
    gsap.to(stage, { backgroundColor: next.dataset.color, duration: immediate ? 0 : 0.9, ease: "power2.out", overwrite: "auto" });
    if (previous) {
      const out = partsOf(previous);
      gsap.to([out.photo, ...out.copy], { opacity: 0, y: -20, duration: 0.3, ease: "power2.in", overwrite: true });
    }
    const into = partsOf(next);
    gsap.fromTo(
      into.photo,
      { opacity: 1, y: 0, clipPath: "inset(100% 0% 0% 0% round 20px)" },
      { clipPath: "inset(0% 0% 0% 0% round 20px)", duration: immediate ? 0 : 1, ease: "expo.out", overwrite: true }
    );
    gsap.fromTo(
      into.copy,
      { opacity: 0, y: 34 },
      { opacity: 1, y: 0, duration: immediate ? 0 : 0.85, ease: "expo.out", stagger: immediate ? 0 : 0.06, delay: immediate ? 0 : 0.1, overwrite: true }
    );
  };

  const mm = gsap.matchMedia();
  mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
    section.classList.add("is-pinned");
    active = -1;
    show(0, true);
    ScrollTrigger.create({
      trigger: stage,
      pin: true,
      start: "top top",
      end: () => `+=${Math.round(pours.length * window.innerHeight * 0.7)}`,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        show(Math.min(pours.length - 1, Math.floor(self.progress * pours.length)));
        bar.style.transform = `scaleX(${self.progress.toFixed(4)})`;
      },
    });
    return () => {
      section.classList.remove("is-pinned");
      pours.forEach((pour) => pour.classList.remove("is-active"));
      gsap.set([stage, ...pours.flatMap((pour) => [partsOf(pour).photo, ...partsOf(pour).copy])], { clearProps: "all" });
      active = -1;
    };
  });
  mm.add("(max-width: 899px) and (prefers-reduced-motion: no-preference)", () => {
    pours.forEach((pour) =>
      gsap.from(pour, { opacity: 0, y: 32, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: pour, start: "top 88%", once: true } })
    );
  });
  onCleanup(() => mm.revert());
}

boot(() => {
  initFilm();
  initCounter();
  initBarDrift();
  initPours();
});
