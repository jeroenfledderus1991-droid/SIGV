function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return [44, 95, 65];
  return [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
}

function buildBootstrapMarkup(bootstrap, nonce, { defaultSettings, normalizeHex, clamp, mixWithBlack }) {
  const nonceAttr = nonce ? ` nonce="${nonce}"` : "";
  const theme = bootstrap?.themeSettings?.theme || defaultSettings.theme;
  const accentColor = normalizeHex(
    bootstrap?.themeSettings?.accentColor,
    defaultSettings.accent_color
  );
  const accentTextColor = normalizeHex(
    bootstrap?.themeSettings?.accentTextColor,
    defaultSettings.accent_text_color
  );
  const gradientIntensity = Number.isFinite(Number(bootstrap?.themeSettings?.gradientIntensity))
    ? clamp(Number(bootstrap.themeSettings.gradientIntensity), 0, 100)
    : defaultSettings.gradient_intensity;
  const accentRgb = hexToRgb(accentColor);
  const sidebarAccentSecond = mixWithBlack(accentColor, gradientIntensity);
  const bootstrapJson = JSON.stringify(bootstrap).replace(/</g, "\\u003c");
  const themeJson = JSON.stringify(theme);

  return `
    <style id="bootstrap-theme"${nonceAttr}>
      :root {
        --accent-color: ${accentColor};
        --accent-color-rgb: ${accentRgb.join(",")};
        --accent-hover: ${accentColor}E6;
        --accent-text-color: ${accentTextColor};
        --sidebar-accent-second: ${sidebarAccentSecond};
      }
    </style>
    <script${nonceAttr}>
      window.__BOOTSTRAP__ = ${bootstrapJson};
      (function () {
        var theme = ${themeJson};
        var root = document.documentElement;
        root.dataset.theme = theme;
        root.classList.remove("theme-light", "theme-dark", "theme-auto");
        root.classList.add("theme-" + theme);
      })();
    </script>
  `;
}

module.exports = { buildBootstrapMarkup };
