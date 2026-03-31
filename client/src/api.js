const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const UNAUTHENTICATED_EVENT = "app:unauthenticated";
let unauthorizedNotified = false;

function getCookieValue(name) {
  const cookieString = document.cookie || "";
  return cookieString
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split("="))
    .find(([key]) => decodeURIComponent(key) === name)?.[1] || "";
}

function notifyUnauthenticated({ status, path }) {
  if (typeof window === "undefined" || unauthorizedNotified) {
    return;
  }
  unauthorizedNotified = true;
  try {
    localStorage.removeItem("authUser");
  } catch {
    return;
  } finally {
    window.__BOOTSTRAP__ = null;
    window.dispatchEvent(
      new CustomEvent(UNAUTHENTICATED_EVENT, {
        detail: { status, path },
      }),
    );
  }
}

async function request(path, options = {}) {
  const csrfToken = getCookieValue("csrf_token");
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-Token": decodeURIComponent(csrfToken) } : {}),
      ...(options.headers || {}),
    },
    credentials: "include",
    ...options,
  });

  if (response.ok) {
    unauthorizedNotified = false;
  }

  if (response.status === 401) {
    notifyUnauthenticated({ status: response.status, path });
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorJson = await response.json().catch(() => ({}));
      const message = [errorJson.error, errorJson.details].filter(Boolean).join(" ");
      throw new Error(message || `Request failed with ${response.status}`);
    }
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function requestBlob(path, options = {}) {
  const csrfToken = getCookieValue("csrf_token");
  const hasBody = Object.prototype.hasOwnProperty.call(options, "body");
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(csrfToken ? { "X-CSRF-Token": decodeURIComponent(csrfToken) } : {}),
      ...(options.headers || {}),
    },
    credentials: "include",
    ...options,
  });

  if (response.ok) {
    unauthorizedNotified = false;
  }

  if (response.status === 401) {
    notifyUnauthenticated({ status: response.status, path });
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorJson = await response.json().catch(() => ({}));
      const message = [errorJson.error, errorJson.details].filter(Boolean).join(" ");
      throw new Error(message || `Request failed with ${response.status}`);
    }
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with ${response.status}`);
  }

  const blob = await response.blob();
  const fileNameHeader = response.headers.get("x-report-filename") || "";
  const contentDisposition = response.headers.get("content-disposition") || "";
  const fallbackName = fileNameHeader || "download.bin";
  const dispositionNameMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  const fileName = (dispositionNameMatch && dispositionNameMatch[1]) || fallbackName;
  return {
    blob,
    fileName,
    contentType: response.headers.get("content-type") || "",
  };
}

export function getJson(path) {
  return request(path, { method: "GET" });
}

export function postJson(path, body) {
  return request(path, { method: "POST", body: JSON.stringify(body) });
}

export function putJson(path, body) {
  return request(path, { method: "PUT", body: JSON.stringify(body) });
}

export function deleteJson(path) {
  return request(path, { method: "DELETE" });
}

export function postBlob(path, body) {
  return requestBlob(path, { method: "POST", body: JSON.stringify(body) });
}

export { UNAUTHENTICATED_EVENT };
