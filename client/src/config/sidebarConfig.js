// Centrale sidebar-config:
// Pas hier groepen, volgorde en items aan.
//
// Voorbeeld 1: item ZONDER groep (direct zichtbaar in de sidebar)
// { type: "link", to: "/rapporten", label: "Rapporten", icon: "fa-chart-line", permissions: ["/rapporten*"] }
//
// Voorbeeld 2: item BINNEN een groep
// {
//   type: "group",
//   key: "beheer",
//   label: "Beheer",
//   icon: "fa-layer-group",
//   items: [
//     { to: "/accounts", label: "Accountbeheer", icon: "fa-users-cog", permissions: ["/accounts*"] },
//   ],
// }
//
// Tip: wil je GEEN groep gebruiken voor een bestaand item?
// Zet dat item als los "link" object op topniveau in SIDEBAR_ENTRIES
// en haal het weg uit de "items" array van de groep.
//
// Header-kleur bovenaan de sidebar (stuk met logo):
// - true  = altijd wit (handig voor donker logo)
// - false = altijd meeleuren met sidebar
// - null  = gebruik bestaande feature-flag gedrag
export const SIDEBAR_HEADER_WHITE = null;

// Sidebar stijl (los van kleur-variant uit theme settings):
// - "classic"  = huidige look
// - "rounded"  = afgeronde shell + zachtere, moderne knoppen
// - "contrast" = strakkere outline look met compacte buttons
// - null       = gebruik .env waarde VITE_SIDEBAR_STYLE (of fallback classic)
export const SIDEBAR_STYLE = "contrast";

export const SIDEBAR_ENTRIES = [
  { type: "link", to: "/", label: "Home", icon: "fa-home", end: true, permissions: ["/home*"] },
  {
    type: "group",
    key: "beheer",
    label: "Beheer",
    icon: "fa-layer-group",
    items: [
      { to: "/accounts", label: "Accountbeheer", icon: "fa-users-cog", permissions: ["/accounts*"] },
      { to: "/rollen", label: "Rolbeheer", icon: "fa-user-shield", permissions: ["/rollen*"] },
      { to: "/stamgegevens", label: "Stamgegevens", icon: "fa-database", permissions: ["/stamgegevens*"] },
      { to: "/feature-flags", label: "Feature flags", icon: "fa-flag", permissions: ["/feature-flags*"] },
    ],
  },
];

export function isRouteMatch(item, pathname) {
  return item.end ? pathname === item.to : pathname.startsWith(item.to);
}
