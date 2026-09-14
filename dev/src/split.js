// Splits a plain-text element into masked words for staggered reveals.
// The readable sentence stays in a visually hidden span; the animated words are aria-hidden.
// Elements containing markup (links, emphasis) are skipped so meaning is never broken apart.
export function splitWords(element) {
  if (element.dataset.splitDone === "true") return [...element.querySelectorAll(".w")];
  if (element.children.length > 0) return [];

  const text = element.textContent.replace(/\s+/g, " ").trim();
  if (!text) return [];

  const accessible = document.createElement("span");
  accessible.className = "visually-hidden";
  accessible.textContent = text;

  const visual = document.createElement("span");
  visual.setAttribute("aria-hidden", "true");

  const words = [];
  text.split(" ").forEach((part, index) => {
    if (index > 0) visual.appendChild(document.createTextNode(" "));
    const mask = document.createElement("span");
    mask.className = "w-mask";
    const word = document.createElement("span");
    word.className = "w";
    word.textContent = part;
    mask.appendChild(word);
    visual.appendChild(mask);
    words.push(word);
  });

  element.textContent = "";
  element.append(accessible, visual);
  element.dataset.splitDone = "true";
  return words;
}
