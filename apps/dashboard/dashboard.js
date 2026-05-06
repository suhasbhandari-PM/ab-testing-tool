const API_BASE = "";  // same origin — server serves dashboard at /dashboard/

// ── API key management ─────────────────────────────────────────────────────

export function getApiKey() {
  return localStorage.getItem("ab_api_key") ?? "";
}

export function setApiKey(key) {
  localStorage.setItem("ab_api_key", key.trim());
}

function authHeaders() {
  const key = getApiKey();
  return key ? { "X-API-Key": key } : {};
}

/**
 * Show the key prompt modal (defined in index.html and editor.html).
 * Resolves when the user saves a key.
 */
export function promptApiKey() {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-key");
    if (!modal) { resolve(); return; }
    modal.classList.add("open");
    modal.querySelector("#btn-key-save").onclick = () => {
      const val = modal.querySelector("#inp-api-key").value.trim();
      if (!val) return;
      setApiKey(val);
      modal.classList.remove("open");
      resolve();
    };
  });
}

async function apiFetch(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers ?? {}) }
  });
  if (res.status === 401) {
    await promptApiKey();
    // Retry once with the new key
    return fetch(`${API_BASE}${url}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers ?? {}) }
    });
  }
  return res;
}

// ── API helpers ────────────────────────────────────────────────────────────

export async function fetchExperiments() {
  const res = await apiFetch("/v1/experiments");
  if (!res.ok) throw new Error(`Failed to fetch experiments: ${res.status}`);
  return res.json();
}

export async function createExperiment(data) {
  const res = await apiFetch("/v1/experiments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Failed to create experiment: ${res.status}`);
  return res.json();
}

export async function updateExperiment(id, patch) {
  const res = await apiFetch(`/v1/experiments/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  if (!res.ok) throw new Error(`Failed to update experiment: ${res.status}`);
  return res.json();
}

export async function deleteExperiment(id) {
  const res = await apiFetch(`/v1/experiments/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete experiment: ${res.status}`);
}

export async function fetchExperiment(id) {
  const res = await apiFetch(`/v1/experiments/${id}`);
  if (!res.ok) throw new Error(`Experiment not found: ${res.status}`);
  return res.json();
}

export async function uploadExperimentSnapshot(id, payload) {
  const res = await apiFetch(`/v1/experiments/${id}/snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to upload snapshot: ${res.status}`);
  return res.json();
}

export async function fetchResultsList() {
  const res = await apiFetch("/v1/results");
  if (!res.ok) throw new Error(`Failed to fetch results list: ${res.status}`);
  return res.json();
}

export async function fetchResultDetail(experimentId) {
  const res = await apiFetch(`/v1/results/${experimentId}`);
  if (!res.ok) throw new Error(`Failed to fetch results: ${res.status}`);
  return res.json();
}

// ── Iframe communication ───────────────────────────────────────────────────

export function sendToFrame(iframe, message) {
  iframe.contentWindow?.postMessage(message, "*");
}

export function waitForMessage(type, timeoutMs = 5000, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error(`Timeout waiting for message type: ${type}`));
    }, timeoutMs);

    function handler(event) {
      if (event.data?.type === type && predicate(event.data, event)) {
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        resolve(event.data);
      }
    }

    window.addEventListener("message", handler);
  });
}

export async function requestFrameScreenshot(iframe, input) {
  const requestId = input.requestId ?? `capture_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  sendToFrame(iframe, {
    type: "CAPTURE_SCREENSHOT",
    requestId,
    viewport: input.viewport,
    width: input.width,
    height: input.height
  });

  const result = await waitForMessage(
    "SCREENSHOT_CAPTURED",
    input.timeoutMs ?? 18000,
    (message) => message.requestId === requestId
  );
  if (result.error) {
    throw new Error(result.error);
  }
  if (!result.dataUrl) {
    throw new Error("Screenshot capture returned no image data");
  }
  return result;
}

// ── Status badge ───────────────────────────────────────────────────────────

export function statusBadge(status) {
  const colors = {
    draft: "#6b7280",
    active: "#059669",
    paused: "#d97706",
    archived: "#9ca3af"
  };
  const color = colors[status] ?? "#6b7280";
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;text-transform:uppercase">${status}</span>`;
}
