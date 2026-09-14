// Menu page entry.
import { gsap, ScrollTrigger, $, $$, reduceMotion, listen, onCleanup, splitWords, boot } from "./shared.js";
import "./styles/sections.css";
import "./styles/menu.css";

/* ---------------- 02 street tacos: pinned horizontal rail ---------------- */
function initTacoRail() {
  const section = $("[data-tacos]");
  if (!section) return;
  const pin = $("[data-tacos-pin]", section);
  const viewport = $("[data-tacos-viewport]", section);
  const track = $("[data-tacos-track]", section);
  const mm = gsap.matchMedia();
  mm.add("(min-width: 961px) and (prefers-reduced-motion: no-preference)", () => {
    section.classList.add("is-pinned");
    const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
    gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: pin,
        pin: true,
        start: "top top",
        end: () => `+=${distance()}`,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
    return () => section.classList.remove("is-pinned");
  });
  onCleanup(() => mm.revert());
}

/* ---------------- chapter rail: where am I on the menu ---------------- */
function initRail() {
  const rail = $("[data-rail]");
  const wrap = $("[data-chapters]");
  if (!rail || !wrap) return;
  const list = $(".rail__list", rail);
  const links = $$("[data-rail-link]", rail);
  let active = -1;

  const setActive = (index) => {
    if (index === active) return;
    active = index;
    links.forEach((link, n) => {
      link.classList.toggle("is-active", n === index);
      if (n === index) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
    const link = links[index];
    if (link && list.scrollWidth > list.clientWidth + 2) {
      list.scrollTo({ left: link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2, behavior: reduceMotion ? "auto" : "smooth" });
    }
  };

  links.forEach((link, index) => {
    const chapter = document.getElementById(link.hash.slice(1));
    if (!chapter) return;
    ScrollTrigger.create({
      trigger: chapter,
      start: "top 50%",
      end: "bottom 50%",
      onToggle: (self) => self.isActive && setActive(index),
    });
  });
  ScrollTrigger.create({
    trigger: wrap,
    start: "top 65%",
    end: "bottom 35%",
    onToggle: (self) => rail.classList.toggle("is-visible", self.isActive),
    onUpdate: (self) => rail.style.setProperty("--p", self.progress.toFixed(4)),
  });
}

/* ---------------- fusion statement: words light up as you read ---------------- */
function initFusion() {
  const el = $("[data-fusion]");
  if (!el || reduceMotion) return;
  const words = splitWords(el);
  gsap.fromTo(
    words,
    { opacity: 0.15 },
    { opacity: 1, ease: "none", stagger: 0.1, scrollTrigger: { trigger: el, start: "top 78%", end: "bottom 42%", scrub: true } }
  );
}

/* ---------------- 03 build a plate ---------------- */
function initBuilder() {
  const builder = $("[data-builder]");
  if (!builder) return;
  const summary = $("[data-builder-summary]", builder);
  const vessels = $$("[data-vessel]", builder);
  listen(builder, "change", (event) => {
    const input = event.target.closest("input[name='protein']");
    if (!input) return;
    const add = Number(input.dataset.add);
    const taco = Number(input.dataset.taco);
    const totals = vessels.map((vessel) => {
      const price = vessel.dataset.mode === "taco3" ? taco * 3 : Number(vessel.dataset.base) + add;
      $("[data-price]", vessel).textContent = String(price);
      vessel.classList.remove("is-updated");
      void vessel.offsetWidth; // restart the price animation
      vessel.classList.add("is-updated");
      return `${vessel.dataset.name} $${price}`;
    });
    summary.textContent = `With ${input.dataset.label}: ${totals.join(" · ")}.`;
  });
}

/* keep trigger positions right when the back-bar list opens or closes */
function initDetails() {
  $$("details").forEach((details) => listen(details, "toggle", () => ScrollTrigger.refresh()));
}

boot(() => {
  initTacoRail();
  initRail();
  initFusion();
  initBuilder();
  initDetails();
});
