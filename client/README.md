# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Combobox PartialMatching Widget

Use:

```jsx
import { ComboboxPartialMatchingWidget } from "./components/widgets";

<ComboboxPartialMatchingWidget
  value={selectedId}
  onChange={setSelectedId}
  options={[
    { value: "1", label: "Klant A" },
    { value: "2", label: "Klant B" },
  ]}
  placeholder="Zoek klant..."
/>
```

Supports keyboard navigation and partial matching (`contains` by default).

## Data Filter Widget

Use:

```jsx
import { DataFilterWidget } from "./components/widgets";

const [query, setQuery] = useState("");
const [filteredRows, setFilteredRows] = useState(rows);

<DataFilterWidget
  data={rows}
  searchableKeys={["Naam", "Email", "RolNaam"]}
  value={query}
  onChange={setQuery}
  onFilteredDataChange={setFilteredRows}
  placeholder="Zoek in data..."
/>;
```

Default behavior is equivalent to `ClientTable` global search: case-insensitive `contains` matching over selected columns.

## Combobox MultiSelect Filter Widget

Use:

```jsx
import { ComboboxMultiSelectFilterWidget } from "./components/widgets";

const [selectedStatuses, setSelectedStatuses] = useState([]);
const [filteredRows, setFilteredRows] = useState(rows);

<ComboboxMultiSelectFilterWidget
  options={[
    { value: "Actief", label: "Actief" },
    { value: "Inactief", label: "Inactief" },
  ]}
  selectedValues={selectedStatuses}
  onChange={setSelectedStatuses}
  data={rows}
  filterKey="Status"
  onFilteredDataChange={setFilteredRows}
  placeholder="Filter status..."
/>;
```

Features:
- Partial matching in options search (`contains` by default)
- Multiple values selectable via checkboxes
- Optional direct dataset filtering via `data + filterKey`
