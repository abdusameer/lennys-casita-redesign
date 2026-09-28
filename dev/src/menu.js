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

/* ---------------- phone chapter stories ---------------- */
// Long menu chapters read as one list to scan through. On a phone the picture sticks while the rows pass under
// it: the dish or the glass you are reading about is always on screen. The rows, prices and links are untouched,
// so the chapter still works as a menu. Desktop keeps its approved layout; short screens keep the plain list.
const PHONE_STORY = "(max-width: 899px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)";

function initChapterStories() {
  $$("[data-story-list]").forEach((list) => {
    const items = $$(":scope > li", list);
    const stillOf = (li) => li.dataset.still || $("img", li)?.getAttribute("src");
    if (items.length < 3 || !stillOf(items[0])) return;
    const section = list.closest("section");

    const figure = document.createElement("figure");
    figure.className = "chapter__still";
    // Decorative: the row underneath is the real content, and it keeps the name, the price and the links.
    figure.setAttribute("aria-hidden", "true");
    const layers = [document.createElement("img"), document.createElement("img")];
    layers.forEach((layer) => {
      layer.decoding = "async";
      layer.alt = "";
      figure.appendChild(layer);
    });
    const caption = document.createElement("figcaption");
    caption.className = "chapter__still-cap";
    const nameEl = document.createElement("span");
    nameEl.className = "chapter__still-name";
    const priceEl = document.createElement("span");
    priceEl.className = "chapter__still-price";
    caption.append(nameEl, priceEl);
    figure.appendChild(caption);

    // The name of the row the picture is showing. Drinks carry their own name and price; the Shuk rows put the
    // name in the first span with the description in a <small>, so take the row's own text and leave that out.
    const labelOf = (li) => {
      const nameNode = $(".drink__name", li) || $("span", li);
      const priceNode = $(".drink__price", li) || li.querySelector("span:last-child");
      const name = nameNode
        ? [...nameNode.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join(" ").replace(/\s+/g, " ").trim() || nameNode.textContent.trim()
        : "";
      return { name, price: priceNode ? priceNode.textContent.replace(/\s+/g, " ").trim() : "" };
    };

    // The still and its list live in their own wrapper, so the picture is released the moment the list ends
    // instead of hanging around over whatever follows it in the chapter (the back bar, the closing note).
    const wrap = document.createElement("div");
    wrap.className = "chapter__story";

    const mm = gsap.matchMedia();
    mm.add(PHONE_STORY, () => {
      section.classList.add("has-chapter-story");
      list.before(wrap);
      wrap.append(figure, list);
      let active = -1;
      let front = 0;
      const show = (i, immediate = false) => {
        if (i === active) return;
        active = i;
        items.forEach((li, n) => li.classList.toggle("is-active", n === i));
        const { name, price } = labelOf(items[i]);
        const writeCaption = () => {
          nameEl.textContent = name;
          priceEl.textContent = price;
          gsap.to(caption, { autoAlpha: 1, y: 0, duration: immediate ? 0 : 0.34, ease: "power3.out", overwrite: true });
        };
        // The name leaves before the picture does and arrives with it, so the two read as one change.
        if (immediate) writeCaption();
        else gsap.to(caption, { autoAlpha: 0, y: 8, duration: 0.16, ease: "power2.in", overwrite: true });

        const next = layers[front ? 0 : 1];
        const src = stillOf(items[i]);
        if (!src || next.getAttribute("src") === src) {
          if (!immediate) writeCaption();
          return;
        }
        next.src = src;
        const reveal = () => {
          next.classList.add("is-on");
          layers[front].classList.remove("is-on");
          front = front ? 0 : 1;
          if (!immediate) writeCaption();
        };
        if (next.complete) reveal();
        else next.addEventListener("load", reveal, { once: true });
      };
      show(0, true);
      const trigger = ScrollTrigger.create({
        trigger: list,
        start: "top 58%",
        end: "bottom 55%",
        onUpdate: (self) => show(Math.min(items.length - 1, Math.floor(self.progress * items.length))),
      });
      return () => {
        trigger.kill();
        wrap.before(list);
        figure.remove();
        wrap.remove();
        section.classList.remove("has-chapter-story");
        items.forEach((li) => li.classList.remove("is-active"));
        layers.forEach((layer) => layer.classList.remove("is-on"));
        gsap.set(caption, { clearProps: "all" });
        active = -1;
      };
    });
    onCleanup(() => mm.revert());
  });
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
  initChapterStories();
  initRail();
  initFusion();
  initBuilder();
  initDetails();
});
