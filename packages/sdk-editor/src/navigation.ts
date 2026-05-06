import { postToParent } from "./bridge";

let isActive = false;
let pickModeActive = false;

function isEditorElement(el: Element | null): boolean {
  return !!el && typeof (el as HTMLElement).id === "string" && (el as HTMLElement).id.startsWith("ab-editor-");
}

function shouldIgnoreUrl(url: URL): boolean {
  return !["http:", "https:"].includes(url.protocol);
}

function isSameDocumentNavigation(url: URL): boolean {
  const current = new URL(document.baseURI);
  const currentWithoutHash = `${current.origin}${current.pathname}${current.search}`;
  const nextWithoutHash = `${url.origin}${url.pathname}${url.search}`;
  return currentWithoutHash === nextWithoutHash;
}

function onClick(event: MouseEvent): void {
  if (!isActive || pickModeActive) return;

  const target = event.target as Element | null;
  const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor || isEditorElement(anchor)) return;
  if (anchor.getAttribute("download")) return;

  const rawHref = anchor.href;
  if (!rawHref) return;

  let url: URL;
  try {
    url = new URL(rawHref, document.baseURI);
  } catch {
    return;
  }

  if (shouldIgnoreUrl(url) || isSameDocumentNavigation(url)) return;

  event.preventDefault();
  event.stopPropagation();
  postToParent({ type: "NAVIGATE_PREVIEW", url: url.toString() });
}

export function startLinkNavigation(): void {
  if (isActive) return;
  isActive = true;
  document.addEventListener("click", onClick, true);
}

export function stopLinkNavigation(): void {
  if (!isActive) return;
  isActive = false;
  document.removeEventListener("click", onClick, true);
}

export function setPickModeActive(active: boolean): void {
  pickModeActive = active;
}
