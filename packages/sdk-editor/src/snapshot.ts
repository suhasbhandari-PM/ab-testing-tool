interface Snapshot {
  parentSelector: string | null;
  nextSiblingSelector: string | null;
  outerHTML: string;
}

const snapshots = new Map<string, Snapshot>();

function getParentSelector(el: Element): string | null {
  const parent = el.parentElement;
  if (!parent || parent === document.body) return null;
  if (parent.id) return `#${CSS.escape(parent.id)}`;
  return null;
}

function getNextSiblingSelector(el: Element): string | null {
  const next = el.nextElementSibling;
  if (!next) return null;
  if (next.id) return `#${CSS.escape(next.id)}`;
  const abId = next.getAttribute("data-ab-id");
  if (abId) return `[data-ab-id="${abId}"]`;
  return null;
}

export function snapshotElement(selector: string): void {
  if (snapshots.has(selector)) return;
  const el = document.querySelector(selector);
  if (!el) return;
  snapshots.set(selector, {
    parentSelector: getParentSelector(el),
    nextSiblingSelector: getNextSiblingSelector(el),
    outerHTML: el.outerHTML
  });
}

export function restoreAll(): void {
  snapshots.forEach((snap, selector) => {
    const current = document.querySelector(selector);
    const template = document.createElement("template");
    template.innerHTML = snap.outerHTML.trim();
    const restored = template.content.firstElementChild;
    if (!restored) return;

    if (current) {
      current.replaceWith(restored);
    } else if (snap.parentSelector) {
      const parent = document.querySelector(snap.parentSelector);
      if (!parent) return;
      if (snap.nextSiblingSelector) {
        const ref = parent.querySelector(snap.nextSiblingSelector);
        if (ref) { parent.insertBefore(restored, ref); return; }
      }
      parent.appendChild(restored);
    }
  });
  snapshots.clear();
}
