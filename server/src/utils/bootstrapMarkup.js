function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return [18, 28, 90];
  return [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
}

function buildBootstrapMarkup(
  bootstrap,
  nonce,
  {
    defaultSettings,
    normalizeHex,
    clamp,
    mixWithBlack,
    normalizeTableTint,
    normalizeContainerTint,
    getTableTintRgb,
    getContainerTintRgb,
  }
) {
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
  const tableTint = normalizeTableTint(
    bootstrap?.themeSettings?.tableTint,
    defaultSettings.table_tint
  );
  const tableTintRgb = getTableTintRgb(tableTint, defaultSettings.table_tint);
  const containerTint = normalizeContainerTint(
    bootstrap?.themeSettings?.containerTint,
    defaultSettings.container_tint
  );
  const containerTintRgb = getContainerTintRgb(containerTint, defaultSettings.container_tint);
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
        --table-tint-rgb: ${tableTintRgb};
        --container-tint-rgb: ${containerTintRgb};
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
