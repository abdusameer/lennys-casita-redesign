// Shared site runtime: fonts, smooth scroll, nav, live hours, hero intro and section reveals.
// Each page entry imports this, adds its own scenes, then calls boot().
import "@fontsource/bebas-neue/400.css";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource-variable/hanken-grotesk/wght.css";
import "lenis/dist/lenis.css";
import "./styles/base.css";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { splitWords } from "./split.js";
import { getStatus } from "./hours.js";

gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger, splitWords };

export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
export const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const cleanups = [];
export const onCleanup = (fn) => cleanups.push(fn);
export const listen = (target, type, handler, options) => {
  target.addEventListener(type, handler, options);
  cleanups.push(() => target.removeEventListener(type, handler, options));
};

let lenis = null;
let drawerOpen = false;

/* ---------------- smooth scroll (Lenis is the only engine) ---------------- */
function initSmoothScroll() {
  if (reduceMotion) return;
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  const tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  onCleanup(() => {
    gsap.ticker.remove(tick);
    lenis.destroy();
    lenis = null;
  });
}

export function scrollToY(y, immediate = false) {
  if (lenis) lenis.scrollTo(y, { duration: immediate ? 0 : 1.2, immediate, force: true });
  else window.scrollTo({ top: y, behavior: "auto" });
}

// Document offset of an element, honouring its CSS scroll-margin-top.
export function offsetOf(target) {
  const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  return target.getBoundingClientRect().top + window.scrollY - margin;
}

/* ---------------- live status + hours ---------------- */
function initStatus() {
  const pill = $("[data-status]");
  const pillText = $("[data-status-text]");
  const hoursStatus = $("[data-hours-status]");
  const rows = $$("[data-hours] tr[data-day]");

  const update = () => {
    const status = getStatus();
    if (pill) {
      pill.classList.toggle("is-open", status.open);
      pill.classList.toggle("is-closed", !status.open);
      if (pillText.textContent !== status.short) pillText.textContent = status.short;
    }
    if (hoursStatus) {
      hoursStatus.textContent = status.long;
      hoursStatus.classList.toggle("is-open", status.open);
    }
    rows.forEach((row) => {
      const today = Number(row.dataset.day) === status.day;
      row.classList.toggle("is-today", today);
      if (today) row.setAttribute("aria-current", "date");
      else row.removeAttribute("aria-current");
    });
  };

  update();
  const timer = setInterval(() => !document.hidden && update(), 60_000);
  listen(document, "visibilitychange", () => !document.hidden && update());
  onCleanup(() => clearInterval(timer));

  const year = $("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
}

/* ---------------- nav, drawer, anchors ---------------- */
function initNav() {
  const nav = $("[data-nav]");
  const toggle = $("[data-drawer-toggle]");
  const drawer = $("[data-drawer]");
  const label = $("[data-drawer-label]");
  const outside = [$("#main"), $(".footer")].filter(Boolean);

  const trigger = ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate(self) {
      const y = self.scroll();
      nav.classList.toggle("is-solid", y > 40 || drawerOpen);
      const menuOpen = Boolean(document.querySelector(".dd.is-open"));
      nav.classList.toggle("is-hidden", !drawerOpen && !menuOpen && self.direction === 1 && y > window.innerHeight * 0.9);
      document.documentElement.classList.toggle("nav-hidden", nav.classList.contains("is-hidden"));
    },
  });
  onCleanup(() => trigger.kill());
  listen(nav, "focusin", () => nav.classList.remove("is-hidden"));

  const setOpen = (open) => {
    drawerOpen = open;
    toggle.setAttribute("aria-expanded", String(open));
    label.textContent = open ? "Close menu" : "Open menu";
    drawer.hidden = !open;
    document.documentElement.classList.toggle("drawer-open", open);
    outside.forEach((el) => (el.inert = open));
    nav.classList.toggle("is-solid", open || window.scrollY > 40);
    nav.classList.remove("is-hidden");
    if (open) {
      lenis?.stop();
      document.body.style.overflow = "hidden";
      $("a", drawer).focus();
    } else {
      lenis?.start();
      document.body.style.overflow = "";
    }
  };

  listen(toggle, "click", () => setOpen(!drawerOpen));
  listen(document, "keydown", (event) => {
    if (event.key === "Escape" && drawerOpen) {
      setOpen(false);
      toggle.focus();
    }
  });
  const desktop = window.matchMedia("(min-width: 961px)");
  const onDesktop = (event) => event.matches && drawerOpen && setOpen(false);
  desktop.addEventListener("change", onDesktop);
  onCleanup(() => desktop.removeEventListener("change", onDesktop));

  // In-page links: scroll with the active engine, then move focus to the destination.
  listen(document, "click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute("href").slice(1);
    const target = id === "top" ? $("#hero-title") || $("h1") : document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    if (drawerOpen) setOpen(false);
    scrollToY(id === "top" ? 0 : offsetOf(target));
    history.replaceState(null, "", `#${id}`);
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  });
}

/* ---------------- dropdown menus ---------------- */
// Click or ArrowDown opens; hover opens for mouse; Escape and outside clicks close and restore focus.
function initDropdowns() {
  const menus = $$("[data-dd]");
  if (!menus.length) return;
  let closeTimer = 0;
  let openedAt = 0;

  const setOpen = (dd, open, { returnFocus = false } = {}) => {
    const trigger = $(".dd__trigger", dd);
    if (open) {
      menus.forEach((other) => other !== dd && setOpen(other, false));
      openedAt = performance.now();
      $("[data-nav]")?.classList.remove("is-hidden");
    }
    dd.classList.toggle("is-open", open);
    trigger.setAttribute("aria-expanded", String(open));
    if (!open && returnFocus) trigger.focus();
  };

  menus.forEach((dd) => {
    const trigger = $(".dd__trigger", dd);
    listen(trigger, "click", () => {
      const isOpen = dd.classList.contains("is-open");
      if (isOpen && performance.now() - openedAt < 450) return; // was just opened by hover
      setOpen(dd, !isOpen);
    });
    listen(trigger, "keydown", (event) => {
      if (event.key !== "ArrowDown") return;
      event.preventDefault();
      setOpen(dd, true);
      $(".dd__panel a", dd)?.focus();
    });
    listen(dd, "keydown", (event) => {
      if (event.key !== "Escape" || !dd.classList.contains("is-open")) return;
      event.stopPropagation();
      setOpen(dd, false, { returnFocus: true });
    });
    listen(dd, "focusout", (event) => {
      if (!dd.contains(event.relatedTarget)) setOpen(dd, false);
    });
    listen(dd, "pointerenter", (event) => {
      if (event.pointerType !== "mouse" || !finePointer) return;
      clearTimeout(closeTimer);
      if (!dd.classList.contains("is-open")) setOpen(dd, true);
    });
    listen(dd, "pointerleave", (event) => {
      if (event.pointerType !== "mouse" || !finePointer) return;
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => setOpen(dd, false), 180);
    });
    listen($(".dd__panel", dd), "click", (event) => {
      if (event.target.closest("a")) setOpen(dd, false);
    });
  });
  listen(document, "pointerdown", (event) => {
    if (!event.target.closest("[data-dd]")) menus.forEach((dd) => setOpen(dd, false));
  });
  onCleanup(() => clearTimeout(closeTimer));
}

/* ---------------- moving word strips (paused offscreen) ---------------- */
function initStrips() {
  $$("[data-strip]").forEach((strip) => {
    const observer = new IntersectionObserver(([entry]) => strip.classList.toggle("is-paused", !entry.isIntersecting));
    observer.observe(strip);
    onCleanup(() => observer.disconnect());
  });
}

/* ---------------- hero (shared cutout composition) ---------------- */
function initHero() {
  const hero = $("[data-hero]");
  if (!hero) return;
  const photo = $("[data-hero-photo]");
  const cutout = $("[data-hero-cutout]");
  const word = $("[data-hero-word]");
  const images = [$("img", photo), $("img", cutout)];
  const layers = [photo, cutout];
  const words = $$(".hero__title [data-split]").flatMap(splitWords);

  gsap.set(layers, { clipPath: "inset(100% 0% 0% 0%)" });
  gsap.set(images, { scale: 1.18 });
  gsap.set(words, { yPercent: 115 });
  gsap.set(word, { autoAlpha: 0, yPercent: 35 });

  gsap
    .timeline({ defaults: { ease: "expo.out" }, delay: 0.1 })
    .to(layers, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.35, ease: "expo.inOut" }, 0)
    .to(images, { scale: 1.08, duration: 2 }, 0.25)
    .to(words, { yPercent: 0, duration: 1.1, stagger: 0.055 }, 0.12)
    .to(word, { autoAlpha: 1, yPercent: 0, duration: 1.5 }, 0.85);

  // Scroll out: photo and cutout move together; the word slides out from behind the food.
  gsap.to(images, {
    y: () => photo.offsetHeight * 0.035,
    ease: "none",
    scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true, invalidateOnRefresh: true },
  });
  gsap.to(word, {
    xPercent: -14,
    ease: "none",
    scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
  });

  if (!finePointer) return;
  const xTo = gsap.quickTo(word, "x", { duration: 0.9, ease: "power3.out" });
  const yTo = gsap.quickTo(word, "y", { duration: 0.9, ease: "power3.out" });
  const reset = () => {
    xTo(0);
    yTo(0);
  };
  listen(hero, "pointermove", (event) => {
    const rect = hero.getBoundingClientRect();
    xTo(((event.clientX - rect.left) / rect.width - 0.5) * -32);
    yTo(((event.clientY - rect.top) / rect.height - 0.5) * -20);
  });
  listen(hero, "pointerleave", reset);
  listen(window, "blur", reset);
}

/* ---------------- section choreography ---------------- */
function initReveals() {
  $$("[data-split]")
    .filter((el) => !el.closest(".hero__title"))
    .forEach((el) => {
      const words = splitWords(el);
      if (!words.length) return;
      gsap.set(words, { yPercent: 115 });
      ScrollTrigger.create({
        trigger: el,
        start: "top 86%",
        once: true,
        onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.05, ease: "expo.out", stagger: 0.05 }),
      });
    });

  $$("[data-reveal]").forEach((el) => {
    gsap.set(el, { autoAlpha: 0, y: 28 });
    ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: () => gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.95, delay: 0.15, ease: "power3.out" }),
    });
  });

  $$("[data-reveal-group]").forEach((group) => {
    const children = $$("[data-reveal-item]", group);
    gsap.set(children, { autoAlpha: 0, y: 24 });
    ScrollTrigger.batch(children, {
      start: "top 90%",
      once: true,
      onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.85, ease: "power3.out", stagger: 0.07 }),
    });
  });

  $$("[data-image-reveal]").forEach((figure) => {
    const img = $("img", figure);
    gsap.set(figure, { clipPath: "inset(100% 0% 0% 0%)" });
    gsap.set(img, { scale: 1.14 });
    ScrollTrigger.create({
      trigger: figure,
      start: "top 85%",
      once: true,
      onEnter: () =>
        gsap
          .timeline()
          .to(figure, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.25, ease: "expo.inOut" })
          .to(img, { scale: 1, duration: 1.6, ease: "expo.out" }, 0.15),
    });
  });
}

/* ---------------- boot ---------------- */
// Page scenes (pins first, in page order) run before the generic reveals so trigger positions include pin spacing.
export function boot(pageScenes = () => {}) {
  initStatus();
  initSmoothScroll();
  initNav();
  initDropdowns();
  initStrips();
  pageScenes();
  if (!reduceMotion) {
    initHero();
    initReveals();
  }
  document.documentElement.classList.add("motion-ready");

  const settle = () => {
    ScrollTrigger.refresh();
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) scrollToY(offsetOf(target), true);
  };
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  if (document.readyState === "complete") settle();
  else listen(window, "load", settle);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      cleanups.splice(0).reverse().forEach((fn) => fn());
      ScrollTrigger.getAll().forEach((t) => t.kill());
      gsap.killTweensOf("*");
    });
  }
}
