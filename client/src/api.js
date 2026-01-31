const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function getCookieValue(name) {
  const cookieString = document.cookie || "";
  return cookieString
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split("="))
    .find(([key]) => decodeURIComponent(key) === name)?.[1] || "";
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

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.error || `Request failed with ${response.status}`);
    }
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
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
