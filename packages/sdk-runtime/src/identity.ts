const DEFAULT_STORAGE_KEY = "ab_user_key";

let inMemoryUserKey: string | null = null;

function generateUserKey(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `u_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function getOrCreateUserKey(storageKey = DEFAULT_STORAGE_KEY): string {
  try {
    const existing = globalThis.localStorage?.getItem(storageKey);
    if (existing) {
      return existing;
    }

    const created = generateUserKey();
    globalThis.localStorage?.setItem(storageKey, created);
    return created;
  } catch {
    if (!inMemoryUserKey) {
      inMemoryUserKey = generateUserKey();
    }

    return inMemoryUserKey;
  }
}
