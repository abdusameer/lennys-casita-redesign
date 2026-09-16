// Home page entry.
import { gsap, ScrollTrigger, $, $$, reduceMotion, listen, onCleanup, scrollToY, offsetOf, splitWords, boot } from "./shared.js";
import "./styles/sections.css";
import "./styles/home.css";

const VIMEO_ORIGIN = "https://player.vimeo.com";

// Waits for a gap between frames. The heavy optional pieces (three.js plate tour, MapLibre map) cost more to
// start up than to download, so starting them on an idle callback keeps that work out of a scrolling frame.
const whenIdle = (timeout = 800) =>
  new Promise((resolve) => (window.requestIdleCallback ? window.requestIdleCallback(() => resolve(), { timeout }) : setTimeout(resolve, 80)));

// Waits until the page has actually stopped moving. Starting a WebGL context or a map costs ~100ms of main
// thread whatever we do with it, and during a scroll there is no idle time to hide it in — an idle callback
// just fires on its timeout, mid-flick. Both features degrade gracefully while they wait: the plate tour shows
// its photographs, the Visit section shows the static map.
const whenCalm = (maxWait = 4000) =>
  new Promise((resolve) => {
    let timer = 0;
    const done = () => {
      clearTimeout(timer);
      clearTimeout(cap);
      window.removeEventListener("scroll", bump);
      whenIdle(600).then(resolve);
    };
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(done, 260);
    };
    const cap = setTimeout(done, maxWait);
    timer = setTimeout(done, 260);
    window.addEventListener("scroll", bump, { passive: true });
  });

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

  // One player for the whole visit. What the film should do lives in `intent`; everything else is observed:
  //   intent  "auto"    play whenever the hero is on screen and the tab is visible
  //           "paused"  the visitor pressed Pause; nothing restarts it but the visitor
  //           "off"     reduced motion or Save-Data: poster until the visitor presses Play
  //           "blocked" the player never started after a few requests: poster, and Play is offered
  // Every lifecycle event (player ready, pause, scroll into/out of view, tab visibility, back/forward restore)
  // calls reconcile(), which is the only place that asks the player to play or pause. The poster only gives way
  // once the film's clock is actually advancing, so a player that loads but never starts can't look frozen.
  const saveData = Boolean(navigator.connection?.saveData);
  let intent = reduceMotion || saveData ? "off" : "auto";
  let iframe = null;
  let ready = false;
  let progressing = false;
  let lastSeconds = -1;
  let retries = 0;
  let watchdog = 0;
  let seekTimer = 0;
  let warned = false;
  let inView = true;
  let active = 0;
  let pendingSeek = null;
  let pin = null;

  const post = (method, value) => {
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(JSON.stringify(value === undefined ? { method } : { method, value }), VIMEO_ORIGIN);
  };

  const wantsPlayback = () => intent === "auto" && inView && !document.hidden;

  // data-film-state is a non-visual marker for QA: poster | loading | playing | paused | offscreen | hidden | blocked
  const render = () => {
    const state =
      intent === "off" ? "poster" : intent === "blocked" ? "blocked" : intent === "paused" ? "paused"
        : !inView ? "offscreen" : document.hidden ? "hidden" : progressing ? "playing" : "loading";
    if (section.dataset.filmState !== state) section.dataset.filmState = state;
    const on = intent === "auto";
    toggle.classList.toggle("is-paused", !on);
    toggle.setAttribute("aria-pressed", String(!on));
    const label = on ? "Pause film" : "Play film";
    if (toggleLabel.textContent !== label) toggleLabel.textContent = label;
  };

  // If a play request doesn't produce a moving clock, ask again twice, then settle on the poster.
  const armWatchdog = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      if (progressing || !wantsPlayback()) return;
      if (retries < 2) {
        retries += 1;
        post("play");
        armWatchdog();
        return;
      }
      intent = "blocked";
      section.classList.remove("has-video");
      if (!warned) console.warn("Lenny's Casita: the hero film did not start, so the poster stays up.");
      warned = true;
      render();
    }, retries === 0 ? 4000 : 3000);
  };

  const reconcile = () => {
    if (iframe && ready) {
      if (wantsPlayback()) {
        if (!progressing) {
          post("play");
          armWatchdog();
        }
      } else {
        clearTimeout(watchdog);
        if (intent !== "blocked") post("pause");
        progressing = false;
      }
    }
    render();
  };

  const onProgress = () => {
    if (progressing) return;
    progressing = true;
    retries = 0;
    clearTimeout(watchdog);
    // A player that starts late still wins: drop back from "blocked" to normal playback.
    if (intent === "blocked") intent = "auto";
    section.classList.add("has-video");
    // Playback can begin just as the visitor pauses or scrolls away; honour that.
    if (!wantsPlayback()) reconcile();
    else render();
  };

  const loadVideo = ({ controls = false } = {}) => {
    if (iframe) return;
    const src = new URL(holder.dataset.src);
    // Cap the stream. Left to itself the player pulls 1080p — about 27MB per 15 seconds — for a film that sits
    // behind a heavy gradient and shrinks to little over half size once the story starts. 720p looks the same
    // here for a third fewer bytes and a lighter decode; phones, where the film is small, take 540p.
    src.searchParams.set("quality", window.innerWidth < 900 ? "540p" : "720p");
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
    holder.appendChild(iframe);
    render();
  };

  listen(window, "message", (event) => {
    if (event.origin !== VIMEO_ORIGIN || !iframe || event.source !== iframe.contentWindow) return;
    let data = event.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }
    switch (data?.event) {
      case "ready":
        // Listeners are registered only once the player says it can take them.
        ready = true;
        ["play", "pause", "timeupdate", "error"].forEach((name) => post("addEventListener", name));
        if (pendingSeek !== null) {
          post("setCurrentTime", pendingSeek);
          lastSeconds = -1;
          pendingSeek = null;
        }
        reconcile();
        break;
      case "timeupdate":
      case "playProgress": {
        // A seek also reports a time, so only two consecutive, slightly later readings count as playback.
        const seconds = Number(data.data?.seconds);
        if (!Number.isFinite(seconds)) break;
        if (lastSeconds >= 0 && seconds > lastSeconds && seconds - lastSeconds < 2) onProgress();
        lastSeconds = seconds;
        break;
      }
      case "pause":
        progressing = false;
        lastSeconds = -1;
        // The player paused on its own (power saving, autopause) while it should be playing: one bounded recovery.
        if (wantsPlayback()) armWatchdog();
        render();
        break;
      case "error":
        if (!progressing && intent === "auto") {
          retries = 2;
          armWatchdog();
        }
        break;
    }
  });

  // Chapters seek once each, after the scroll settles on one; the film keeps playing from there.
  const seekTo = (i) => {
    const time = Number(beats[i].dataset.time);
    clearTimeout(seekTimer);
    if (!ready) {
      pendingSeek = time;
      return;
    }
    seekTimer = setTimeout(() => {
      lastSeconds = -1;
      post("setCurrentTime", time);
    }, 160);
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
    intent = "auto";
    retries = 0;
    loadVideo({ controls: reduceMotion });
    reconcile();
  };

  listen(toggle, "click", () => {
    if (intent === "auto") {
      intent = "paused";
      reconcile();
    } else {
      startFilm();
    }
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

  // Pause only once the whole film section (pin spacing included) is well clear of the viewport.
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (inView === entry.isIntersecting) return;
      inView = entry.isIntersecting;
      reconcile();
    },
    { rootMargin: "25% 0px" }
  );
  observer.observe(section);
  listen(document, "visibilitychange", reconcile);
  // Back/forward cache restores the page with the player in an unknown state: re-check instead of trusting it.
  listen(window, "pageshow", (event) => {
    if (!event.persisted) return;
    progressing = false;
    lastSeconds = -1;
    retries = 0;
    reconcile();
  });
  onCleanup(() => {
    observer.disconnect();
    clearTimeout(watchdog);
    clearTimeout(seekTimer);
  });

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
      .to(words, { yPercent: 0, duration: 1.1, stagger: 0.06 }, 0.15)
      // The script line's glow resolves once the words have settled, then never moves again.
      .call(() => section.classList.add("is-lit"), null, 1.2);
  }
  if (reduceMotion) section.classList.add("is-lit");
  // The player goes in as soon as the page has loaded — no extra delay on top — but not before, because the film
  // sits inside the pinned element and ScrollTrigger's first refresh re-parents that subtree (which would reload
  // the iframe and throw). preconnect to player.vimeo.com in <head> covers the handshake in the meantime.
  if (intent === "auto") {
    if (document.readyState === "complete") loadVideo();
    else listen(window, "load", () => loadVideo(), { once: true });
  }
  render();
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
  mm.add("(min-width: 961px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)", () => {
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
      // Compiling the shader and uploading six textures is the expensive part, not the download: wait until the
      // scroll settles, so the cost never lands inside a moving frame. Until then the section shows its photos.
      await whenCalm(4000);
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

/* ---------------- after dark: light that follows the pointer ---------------- */
// A faint agave-green light drifts through the sign's negative space, fine pointers only. The soft disc is a
// fixed-size layer moved with transform from two CSS variables, so movement composites and never repaints.
// Geometry is read once on entry and on refresh, never while moving; pointer events only store numbers, one rAF
// applies them, and the loop sleeps as soon as the light and the ampersand have settled.
function initBarLight() {
  const section = $("[data-pours]");
  const intro = section && $(".pours__intro", section);
  const light = intro && $(".pours__light", intro);
  if (!light || navigator.connection?.saveData) return;
  const amp = $(".bar__amp", intro);

  const mm = gsap.matchMedia();
  mm.add("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)", () => {
    section.classList.add("has-light");
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let box = null;
    let ampAt = null;
    let reach = 1;
    let inside = false;
    let clientX = 0;
    let clientY = 0;
    let frame = 0;
    let leftAt = -Infinity;
    let ampTarget = 0;
    let ampLit = 0;

    const measure = () => {
      const r = intro.getBoundingClientRect();
      box = { left: r.left + window.scrollX, top: r.top + window.scrollY, height: r.height };
      if (amp) {
        const a = amp.getBoundingClientRect();
        ampAt = { x: a.left + a.width / 2 - r.left, y: a.top + a.height / 2 - r.top };
      }
      // Mirrors the disc size in CSS: clamp(30rem, 52vw, 52rem).
      reach = Math.min(Math.max(window.innerWidth * 0.52, 480), 832) * 0.42;
    };
    const aim = () => {
      target.x = clientX + window.scrollX - box.left;
      target.y = clientY + window.scrollY - box.top;
    };
    const tick = () => {
      frame = 0;
      current.x += (target.x - current.x) * 0.19;
      current.y += (target.y - current.y) * 0.19;
      // Snap once the remainder is below what a pixel can show: easing the last fraction of a pixel (or of the
      // ampersand's glow) only keeps the loop awake for another second with nothing visible changing.
      const moving = Math.abs(target.x - current.x) > 0.5 || Math.abs(target.y - current.y) > 0.5;
      if (!moving) Object.assign(current, target);
      if (amp) {
        ampTarget = inside ? Math.max(0, 1 - Math.hypot(current.x - ampAt.x, current.y - ampAt.y) / reach) ** 2 : 0;
        // The glow chases a target that is itself derived from the still-moving light, so it is the last thing to
        // settle. Closing the gap a little faster, and snapping once the remainder is invisible, ends the loop
        // about a third of a second sooner with the same brightness at rest.
        ampLit += (ampTarget - ampLit) * 0.16;
      }
      const glowing = Math.abs(ampTarget - ampLit) > 0.02;
      if (!glowing) ampLit = ampTarget;
      light.style.setProperty("--light-x", `${current.x.toFixed(1)}px`);
      light.style.setProperty("--light-y", `${current.y.toFixed(1)}px`);
      amp?.style.setProperty("--amp-lit", ampLit.toFixed(3));
      if (moving || glowing) frame = requestAnimationFrame(tick);
      else light.dataset.active = "false";
    };
    const schedule = () => {
      if (frame) return;
      light.dataset.active = "true";
      frame = requestAnimationFrame(tick);
    };

    const onEnter = (event) => {
      if (event.pointerType === "touch") return;
      measure();
      inside = true;
      clientX = event.clientX;
      clientY = event.clientY;
      aim();
      // Arriving after the light has faded out: start under the pointer instead of sweeping in from the last exit.
      if (performance.now() - leftAt > 900) Object.assign(current, target);
      light.classList.add("is-on");
      schedule();
    };
    const onMove = (event) => {
      if (!inside || event.pointerType === "touch") return;
      clientX = event.clientX;
      clientY = event.clientY;
      aim();
      schedule();
    };
    const onLeave = () => {
      if (!inside) return;
      inside = false;
      leftAt = performance.now();
      light.classList.remove("is-on");
      schedule();
    };
    // The page can scroll under a still pointer: keep the light beneath it, and let go once it is outside the sign.
    const onScroll = () => {
      if (!inside) return;
      aim();
      if (target.y < 0 || target.y > box.height) return onLeave();
      schedule();
    };
    const onRefresh = () => inside && measure();

    intro.addEventListener("pointerenter", onEnter);
    intro.addEventListener("pointermove", onMove, { passive: true });
    intro.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    ScrollTrigger.addEventListener("refresh", onRefresh);
    return () => {
      intro.removeEventListener("pointerenter", onEnter);
      intro.removeEventListener("pointermove", onMove);
      intro.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      ScrollTrigger.removeEventListener("refresh", onRefresh);
      cancelAnimationFrame(frame);
      frame = 0;
      section.classList.remove("has-light");
      light.classList.remove("is-on");
      light.style.removeProperty("--light-x");
      light.style.removeProperty("--light-y");
      amp?.style.removeProperty("--amp-lit");
      delete light.dataset.active;
    };
  });
  onCleanup(() => mm.revert());
}

/* ---------------- anchored scene (Shabbat Shuk) ---------------- */
// The scene holds the screen with CSS sticky rather than a GSAP pin: the section grows taller and its contents
// stick until the section ends, so the release is plain native scroll. It only anchors when its copy fits the
// screen; on shorter screens it stays in normal flow.
const ANCHOR_QUERY = "(min-width: 901px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)";

function anchorWhenItFits(section, sticky, content, className) {
  const check = () => {
    section.classList.add(className);
    const style = getComputedStyle(sticky);
    const room = sticky.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    section.classList.toggle(className, content.offsetHeight <= room + 1);
  };
  check();
  ScrollTrigger.addEventListener("refreshInit", check);
  return () => {
    ScrollTrigger.removeEventListener("refreshInit", check);
    section.classList.remove(className);
  };
}

/* ---------------- Shabbat Shuk: one dish at a time ---------------- */
function initShuk() {
  const section = $("[data-shuk]");
  if (!section) return;
  const dishes = $$("[data-shuk-dish]", section);
  const rail = $$("[data-shuk-go]", section);
  const indexEl = $("[data-shuk-index]", section);
  const count = dishes.length;
  let active = 0;
  let trigger = null;

  const setActive = (i) => {
    if (i === active) return;
    active = i;
    dishes.forEach((dish, n) => dish.classList.toggle("is-active", n === i));
    rail.forEach((button, n) => {
      if (n === i) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    indexEl.textContent = String(i + 1).padStart(2, "0");
  };

  rail.forEach((button, i) =>
    listen(button, "click", () => {
      if (!trigger || !section.classList.contains("is-story")) return;
      scrollToY(trigger.start + ((i + 0.5) / count) * (trigger.end - trigger.start));
    })
  );

  const mm = gsap.matchMedia();
  mm.add(ANCHOR_QUERY, () => {
    const release = anchorWhenItFits(section, $("[data-shuk-sticky]", section), $(".shuk__panel", section), "is-story");
    trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => setActive(Math.min(count - 1, Math.floor(self.progress * count))),
    });
    return () => {
      release();
      trigger = null;
    };
  });
  onCleanup(() => mm.revert());
}

/* ---------------- Cultura: two films over the catering board ---------------- */
// Layout is pure CSS (one composed screen on desktop). This only runs playback.
function initCultura() {
  const section = $("[data-cultura]");
  if (!section) return;
  const videos = $$("[data-cultura-video]", section);
  const toggle = $("[data-cultura-toggle]", section);
  const toggleLabel = $("[data-cultura-toggle-label]", section);
  const phone = window.matchMedia("(max-width: 900px)");
  // Posters stay up under reduced motion or Save-Data until someone presses play.
  let wanted = !reduceMotion && !navigator.connection?.saveData;
  let near = false;

  const syncToggle = () => {
    toggle.classList.toggle("is-paused", !wanted);
    toggleLabel.textContent = wanted ? "Pause videos" : "Play videos";
  };
  // The same two <video> elements live for the whole visit; they only ever play or pause. The side film starts a
  // beat after the main one so two decoders and two downloads don't spin up in the same frame as the scroll.
  let sideTimer = 0;
  const start = (video) => {
    if (!video.paused) return;
    video.muted = true;
    video.play()?.catch((error) => {
      if (error.name !== "NotAllowedError") return;
      wanted = false;
      syncToggle();
    });
  };
  const sync = () => {
    const run = wanted && near && !document.hidden;
    clearTimeout(sideTimer);
    videos.forEach((video) => {
      // Phones play the main film only; the side film keeps its poster.
      if (run && (!phone.matches || video.dataset.culturaVideo === "main")) {
        if (video.dataset.culturaVideo === "side") sideTimer = setTimeout(() => start(video), 700);
        else start(video);
      } else if (!video.paused) {
        video.pause();
      }
    });
    syncToggle();
  };

  toggle.hidden = false;
  // If neither film can load, the posters are the section; drop a control that would do nothing.
  videos.forEach((video) =>
    listen(video, "error", () => {
      if (videos.every((v) => v.error)) toggle.hidden = true;
    })
  );
  listen(toggle, "click", () => {
    wanted = !wanted;
    sync();
  });
  const observer = new IntersectionObserver(
    ([entry]) => {
      near = entry.isIntersecting;
      sync();
    },
    { rootMargin: "20% 0px" }
  );
  observer.observe(section);
  listen(document, "visibilitychange", sync);
  listen(phone, "change", sync);
  onCleanup(() => {
    observer.disconnect();
    clearTimeout(sideTimer);
    videos.forEach((video) => video.pause());
  });
}

/* ---------------- Visit: light map ---------------- */
// The static map image is the section until the live map is close; MapLibre then loads as its own chunk.
function initVisitMap() {
  const figure = $("[data-visit-map]");
  if (!figure) return;
  figure.dataset.mapState = "idle";
  if (navigator.connection?.saveData || !("WebGLRenderingContext" in window)) {
    figure.dataset.mapState = "fallback";
    return;
  }
  let dispose = null;
  let disposed = false;
  // ScrollTrigger rather than an IntersectionObserver: it re-measures on every refresh, so the pinned sections
  // above the Visit block can grow and shrink without the map missing its cue.
  const trigger = ScrollTrigger.create({
    trigger: figure,
    start: "top bottom+=800",
    once: true,
    onEnter: () => {
      // Building the map (style, sources, first tiles) is heavier than fetching the chunk, and there is no idle
      // time inside a scroll: wait until the page stops moving. The static map holds the section meanwhile.
      whenCalm(5000)
        .then(() => import("./visit-map.js"))
        .then(({ mountVisitMap }) => {
          if (!disposed) dispose = mountVisitMap(figure);
        })
        .catch((error) => {
          figure.dataset.mapState = "fallback";
          console.warn("Lenny's Casita: live map unavailable, showing the static map.", error);
        });
    },
  });
  onCleanup(() => {
    disposed = true;
    trigger.kill();
    dispose?.();
  });
}

/* ---------------- idle warm-up for the heavy optional chunks ---------------- */
// three.js (plate tour) and MapLibre (Visit map) are lazy, but evaluating them the moment their section comes
// near lands a long task in the middle of a scroll. Parse them while the browser is idle instead; mounting still
// waits for the section, so nothing renders earlier than before.
function warmLazyChunks() {
  if (navigator.connection?.saveData) return;
  const warm = () => {
    // Well clear of boot: the first second after load is still busy with the film, fonts and the first reveals,
    // and an idle callback fires inside it. Fetch and parse the chunks after that, so their sections only have
    // start-up left to do when they arrive.
    setTimeout(async () => {
      await whenIdle(3000);
      if (!reduceMotion && hasWebGL()) import("./counter-gl.js").catch(() => {});
      await whenIdle(3000);
      if ("WebGLRenderingContext" in window) import("./visit-map.js").catch(() => {});
    }, 2500);
  };
  if (document.readyState === "complete") warm();
  else listen(window, "load", warm, { once: true });
}

boot(() => {
  // Scenes in page order: the Shabbat Shuk now follows the film directly. The first screen is set up straight
  // away; everything below the fold is built one frame later, so the longest task of the visit (parsing the
  // bundle and wiring the scenes) doesn't also hold up the first paint of the film.
  initFilm();
  initShuk();
  const rest = () => {
    initCounter();
    initBarDrift();
    initPours();
    initBarLight();
    initCultura();
    initVisitMap();
    warmLazyChunks();
    ScrollTrigger.refresh();
  };
  if (reduceMotion) rest();
  else requestAnimationFrame(() => requestAnimationFrame(rest));
});
