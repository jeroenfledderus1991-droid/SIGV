import { Fragment, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./styles/themes.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/sidebar.css";
import "./styles/components.css";
import "./styles/pages.css";
import "./styles/widgets.css";
import "./styles/theme-override.css";
import "./styles/matrix-styling.css";
import "./styles/client-table.css";
import "./styles/app.css";
import App from "./App.jsx";

const RootWrapper = import.meta.env.DEV ? Fragment : StrictMode;

createRoot(document.getElementById("root")).render(
  <RootWrapper>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </RootWrapper>
);
