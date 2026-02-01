import { getJson } from "./api";

let bootstrapPromise = null;

export function getBootstrap() {
  if (typeof window === "undefined") return {};
  return window.__BOOTSTRAP__ || {};
}

export function setBootstrap(value) {
  if (typeof window === "undefined") return {};
  window.__BOOTSTRAP__ = value || {};
  return window.__BOOTSTRAP__;
}

export function loadBootstrap(options = {}) {
  if (typeof window === "undefined") return Promise.resolve({});
  if (options.force) {
    bootstrapPromise = null;
    window.__BOOTSTRAP__ = null;
  }
  if (window.__BOOTSTRAP__) return Promise.resolve(window.__BOOTSTRAP__);
  if (!bootstrapPromise) {
    bootstrapPromise = getJson("/bootstrap")
      .then((data) => setBootstrap(data))
      .catch((error) => {
        bootstrapPromise = null;
        throw error;
      });
  }
  return bootstrapPromise;
}
