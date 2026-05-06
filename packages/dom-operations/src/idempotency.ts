const ATTR_PREFIX = "data-ab-op";

export function hashContent(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function markApplied(el: Element, operationKey: string): void {
  el.setAttribute(`${ATTR_PREFIX}-${operationKey}`, "1");
}

export function isAlreadyApplied(el: Element, operationKey: string): boolean {
  return el.hasAttribute(`${ATTR_PREFIX}-${operationKey}`);
}
