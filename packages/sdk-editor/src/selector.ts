export interface SelectorResult {
  selector: string;
  confidence: "high" | "medium" | "low";
}

function isUnique(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

export function generateSelector(el: Element): SelectorResult {
  // 1. data-ab-id
  const abId = el.getAttribute("data-ab-id");
  if (abId) {
    return { selector: `[data-ab-id="${abId}"]`, confidence: "high" };
  }

  // 2. data-testid
  const testId = el.getAttribute("data-testid");
  if (testId) {
    return { selector: `[data-testid="${testId}"]`, confidence: "high" };
  }

  // 3. id attribute (unique)
  const id = el.id;
  if (id && isUnique(`#${CSS.escape(id)}`)) {
    return { selector: `#${CSS.escape(id)}`, confidence: "high" };
  }

  // 4. tag + classes (unique)
  if (el.classList.length > 0) {
    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList)
      .map((c) => `.${CSS.escape(c)}`)
      .join("");
    const candidate = `${tag}${classes}`;
    if (isUnique(candidate)) {
      return { selector: candidate, confidence: "medium" };
    }
  }

  // 5. Structural fallback: walk up to find a unique anchor, then nth-child down
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.documentElement) {
    const parentEl: Element | null = current.parentElement;
    if (!parentEl) break;

    const tag = current.tagName.toLowerCase();
    const siblings = Array.from(parentEl.children).filter((c: Element) => c.tagName === current!.tagName);
    const idx = siblings.indexOf(current) + 1;
    parts.unshift(siblings.length === 1 ? tag : `${tag}:nth-child(${idx})`);

    const partialSelector = parts.join(" > ");
    if (isUnique(partialSelector)) {
      return { selector: partialSelector, confidence: parts.length === 1 ? "medium" : "low" };
    }

    current = parentEl;
  }

  return { selector: parts.join(" > ") || el.tagName.toLowerCase(), confidence: "low" };
}
