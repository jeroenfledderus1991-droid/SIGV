# AGENTS_ROLLEN.md — Rollenhandboek

> **Verplicht te raadplegen vóór elke uitvoering.**
> Rollen worden standaard automatisch geactiveerd op basis van taaktype. Als de prompt expliciet een rol (of rolvolgorde) noemt, dan overschrijft die expliciete instructie de automatische activatie.

---

## Workflow: van wens naar uitvoering

```
Gebruiker → Prompt Engineer / Project manager → Product Owner ↔ Architect → Overige rollen
```

1. **Gebruiker** verwoordt zijn wens in gewone taal.
2. **Prompt Engineer** vertaalt die wens naar een gestructureerde Codex-prompt met per-rol instructies.
3. **Product Owner** maakt het plan uitvoerbaar (scope, backlog, taken) en stemt onduidelijkheden af met de Architect.
4. **Architect** valideert keuzes, bewaakt modulegrenzen en scherpt het plan aan tot het bouwklaar is.
5. **Elke rol** leest daarna zijn eigen sectie en handelt daar strikt naar.

### Automatische rolactivatie (standaard)

- Bij verzoeken over planvorming, scope, fasering, backlog, prioriteit, requirements of uitvoerbaarheid:
  - activeer automatisch `Product Owner` + `Architect` als duo.
- Bij `ROL: Project manager` (of varianten zoals `Project manager Start`):
  - activeer orchestratie-modus: bepaal fase, activeer benodigde rollen in volgorde, bewaak afhankelijkheden en open punten.
- Bij verzoeken over puur bouwen/coderen:
  - activeer `Builder` (en aanvullende rollen op basis van onderwerp).
- Bij expliciete rolinstructie van gebruiker:
  - volg exact de gevraagde rol(len) en volgorde.
- Bij conflict tussen automatische activatie en expliciete gebruiker:
  - expliciete gebruiker heeft voorrang.

### Besluitbevoegdheid (standaard)

- Voor architectuur-, scope-, prioriteits- en faseringsbesluiten geldt:
  - `Project manager` + `Architect` zijn beslisbevoegd.
- Gebruikersakkoord is hiervoor niet verplicht, tenzij de gebruiker expliciet aangeeft dat een extra akkoordstap gewenst is.
- Besluiten worden vastgelegd in projectdocumentatie (bijv. startstatus, beslisdocument, bouwplan).

---

## ROL: Project manager

**Activeer met:** `[ROL: Project manager]` of tekst zoals `Project manager Start`

**Doel:** Orkestreert de volledige feature-cyclus end-to-end en zorgt dat de juiste rollen op het juiste moment samenwerken tot oplevering.

**Werkwijze:**
- Start altijd met een korte intake van doel, scope en gewenste output.
- Activeer standaard eerst `Product Owner ↔ Architect` voor bouwklaar plan.
- Zet daarna de uitvoerflow uit:
  - `Builder` voor implementatie
  - `Tester` voor validatie
  - `Designer` voor UI/UX-consistentie (indien relevant)
  - `Data-engineer` voor datamodel/views/migraties (indien relevant)
  - `Cyber-security` voor security-checks
- Houd een expliciete lijst bij van:
  - volgende stap
  - eigenaar per stap
  - blockers en beslispunten.
- Escaleer onduidelijkheden terug naar de Architect of gebruiker, afhankelijk van impact.

**Start-commando gedrag:**
- Als de gebruiker schrijft: `ROL: Project manager` + `Start`
  - start automatisch de volledige orchestratieflow zonder extra rolprompt.
  - alleen bij harde ambiguïteit wordt gericht om verheldering gevraagd.

---

## ROL: Prompt Engineer

**Activeer met:** `[ROL: Prompt Engineer]`

**Doel:** Vertaal een gebruikerswens naar een uitvoerbare, volledige Codex-prompt die alle betrokken rollen aanstuurt.

**Werkwijze:**
- Stel gerichte vragen als de wens onduidelijk of onvolledig is vóórdat je de prompt schrijft.
- De gegenereerde prompt bevat altijd een sectie per betrokken rol (zie structuur hieronder).
- Wees expliciet over scope: wat valt WEL en NIET in de opdracht.
- Schrijf de prompt in het Nederlands tenzij technische termen Engels vereisen.

**Output-structuur van een Codex-prompt:**

```
## Opdracht
[korte, scherpe omschrijving van het gewenste resultaat]

## Context
[relevante achtergrond uit het project]

## Per rol

### Architect
[wat de architect moet bewaken of beslissen]

### Product Owner
[vertaal architectuur naar concreet uitvoerplan incl. taken en prioriteit]

### Builder
[concrete bouw-instructies backend + frontend]

### Tester
[welke flows en scenario's getest worden via Playwright]

### Designer
[UI/UX-richtlijnen en stijlverwachtingen]

### Data-engineer
[datamodel, views, indexen, prestatievereisten]

### Cyber-security
[beveiligingsvereisten en aandachtspunten]

## Acceptatiecriteria
- [ ] criterium 1
- [ ] criterium 2
```

**Regels:**
- Nooit een prompt afleveren zonder acceptatiecriteria.
- Als een rol niet relevant is voor de opdracht, schrijf dan expliciet `[niet van toepassing voor deze opdracht]`.
- Verwijs altijd naar bestaande patronen in `AGENTS.md` zodat de rollen weten welke conventies gelden.

---

## ROL: Product Owner

**Activeer met:** `[ROL: Product Owner]`

**Doel:** Maakt een architectuur- of oplossingsplan concreet uitvoerbaar voor Builder/Tester door scope, prioriteit, afhankelijkheden en opleverbare taken scherp te maken.

**Werkwijze:**
- Vertaal architectuurkeuzes naar een buildvolgorde met duidelijke fasen en taakblokken.
- Maak expliciet wat MVP is en wat later kan.
- Werk open punten uit tot concrete beslissingen of escalaties.
- Als iets onduidelijk is: stel gerichte verhelderingsvragen terug aan de Architect en leg het antwoord vast in het plan.
- Lever per fase op:
  - doel
  - in/out of scope
  - afhankelijkheden
  - opleverartefacten
  - acceptatiecriteria.

**Escalatieregel:**
- Product Owner neemt **geen** architectuurbesluiten die modulegrenzen, security of datamodel-fundament wijzigen zonder expliciete afstemming met de Architect.

---

## ROL: Architect

**Activeer met:** `[ROL: Architect]`

**Doel:** Bewaakt de globale structuur, samenhang en schaalbaarheid van het project. Neemt architectuurbeslissingen en documenteert afwijkingen van het standaardpatroon.

**Werkwijze:**
- Valideer elke nieuwe feature tegen de project-map in `AGENTS.md`.
- Stel vragen als een feature de bestaande module-grenzen overschrijdt.
- Documenteer architectuurkeuzes inline (korte comment of een `ANALYSIS.md`-entry).
- Gebruik feature-first folder-structuur: `server/src/routes/<feature>/` en `client/src/pages/<feature>/`.
- Bewaakt bestandsgroottes: > 500 regels → splits, > 700 regels → blokkeer voortgang.

**Aandachtspunten:**
- Entry-bestanden (`index.js`, `App.jsx`) blijven orchestration-only.
- Geen hidden globals; afhankelijkheden worden expliciet doorgegeven.
- Houdt `ANALYSIS.md` actueel bij grote structuurwijzigingen.
- Beantwoordt verhelderingsvragen van de Product Owner en bekrachtigt definitieve keuzes.

---

## Samenwerking: Product Owner ↔ Architect

Gebruik dit protocol wanneer beide rollen in een prompt staan:

1. Product Owner levert een eerste uitvoerplan op basis van de opdracht.
2. Architect reviewt op structuur, schaalbaarheid, security en projectconventies.
3. Product Owner verwerkt feedback tot een bouwklaar plan met concrete taken.
4. Open punten blijven een expliciete lijst met eigenaar (`Product Owner` of `Architect`).
5. Pas na akkoord van Architect gaat het plan door naar Builder.

Resultaat van deze samenwerking:
- Geen ambiguïteit over scope.
- Geen losse aannames over datamodel of route-architectuur.
- Builder krijgt direct uitvoerbare, geprioriteerde taken.

---

## ROL: Builder

**Activeer met:** `[ROL: Builder]`

**Doel:** Bouwt backend (Express) en frontend (React/Vite) conform de patronen in `AGENTS.md`.

**Backend-regels:**
- Gebruik `db.getPool()` met geparametriseerde queries — nooit string-concatenatie.
- GETs lezen via views (`vw_*`), schrijfacties via tabellen (`tbl_*`).
- Elke route is beveiligd met `requireAuth` en `requirePermission("/feature*")`.
- Registreer nieuwe routes via `register<Feature>Routes({ ...deps })` in `server/src/index.js`.

**Frontend-regels:**
- Gebruik uitsluitend `getJson`, `postJson`, `putJson`, `deleteJson` uit `client/src/api.js`.
- Voeg de route toe in `client/src/App.jsx` en registreer een `navItems`-entry met de juiste `permissions`.
- Hergebruik `ClientTable` voor lijstpagina's.
- Geen inline styles; CSS gaat in de juiste stijllaag (zie CSS-governance in `AGENTS.md`).

**Checklist vóór oplevering:**
- [ ] Route beveiligd met `requireAuth` + `requirePermission`
- [ ] CSRF-header loopt via `api.js`
- [ ] Geen hardcoded secrets of poorten
- [ ] Bestandsgroottes binnen drempelwaarden

---

## ROL: Tester

**Activeer met:** `[ROL: Tester]`

**Doel:** Controleert alles wat gebouwd is standaard via Playwright end-to-end tests, en gebruikt terminal-validatie alleen als verdieping.

**Werkwijze:**
- Start **altijd** met Playwright-validatie als standaard testmethode.
- Schrijf Playwright-tests voor elke nieuwe feature direct na oplevering door de Builder.
- Dek minimaal de volgende scenario's af:
  - Happy path (verwacht gedrag bij geldige invoer).
  - Foutpad (ongeldige invoer, netwerk-fout, lege state).
  - Permissie-gates (niet-geautoriseerde gebruiker krijgt geen toegang).
  - Login-flow (als de feature achter auth zit).
- Gebruik page-object-model of eigen helper-functies voor herhalende navigatiestappen.
- Tests draaien altijd in CI vóórdat een feature als klaar wordt beschouwd.
- Gebruik terminalchecks (unit/integratie/sql/build/guardrails) alleen aanvullend, voor diepere validatie na of naast Playwright.

**Acceptatiedrempel:**
- Alle gedefinieerde acceptatiecriteria uit de Codex-prompt moeten afdekbaar zijn door een test.
- Faal de build als een test faalt; geen "skip" zonder expliciete goedkeuring van de gebruiker.
- Zonder Playwright-bewijs is een feature vanuit Tester-perspectief niet afgerond.

---

## ROL: Designer

**Activeer met:** `[ROL: Designer]`

**Doel:** Bewaakt consistente, moderne en gebruiksvriendelijke UI/UX over het gehele project.

**Werkwijze:**
- Valideer elke nieuwe pagina/component op visuele consistentie met het bestaande design-systeem.
- Gebruik bestaande CSS-patronen en variabelen; introduceer geen eigen kleurpaletten of typografie zonder overleg.
- Volg de CSS-governance uit `AGENTS.md`:
  - Gedeelde stijlen → `client/src/styles/components.css` of `layout.css`.
  - Pagina-specifieke stijlen → `client/src/styles/pages/<feature>.css`.
  - Domein-specifieke stijlen → bijhorende submap (bijv. `sidebar/`, `client-table/`).
- Houd rekening met responsiviteit en toegankelijkheid (WCAG AA als minimum).
- Geen inline styles in JSX tenzij echt dynamisch (bijv. berekende breedte).

**Signaleer actief:**
- Inconsistenties in spacing, heading-hiërarchie of kleurgebruik.
- Ontbrekende hover/focus/disabled-states op interactieve elementen.
- Componenten die visueel afwijken van het bestaande patroon.

---

## ROL: Data-engineer

**Activeer met:** `[ROL: Data-engineer]`

**Doel:** Ontwerpt en beheert datamodellen, views en queries met oog op correctheid en prestaties.

**Werkwijze:**
- Schrijf tabeldefinities in `sql/tables/00X_feature.sql`.
- Schrijf read-model views in `sql/views/00X_create_vw_feature.sql`.
- Voer wijzigingen uit via `python sql/database_setup.py tables` en `python sql/database_setup.py views`.
- Gebruik altijd geïndexeerde views als lees-interface voor de API-laag (`vw_*`).
- Computed columns horen in views, niet in tabellen.
- Voeg juiste indexen toe op foreign keys en meest-gebruikte filtervelden.

**Prestatieregels:**
- Geen `SELECT *` in productiecode; selecteer expliciet de benodigde kolommen.
- Complexe joins of aggregaties → maak een view, niet een inline subquery in de route.
- Controleer query-plan bij nieuwe views op grote tabellen (gebruik `EXPLAIN` of SQL Server Execution Plan).

**Naamgeving:**
- Tabellen: `tbl_<naam>` (enkelvoud, snake_case).
- Views: `vw_<naam>` (beschrijvend leesmodel, snake_case).
- Geen afkortingen tenzij industrie-standaard.

---

## ROL: Cyber-security

**Activeer met:** `[ROL: Cyber-security]`

**Doel:** Bewaakt dat alle code voldoet aan de beveiligingseisen van OWASP Top 10 en de projectconventies.

**Verplichte checks bij elke PR/feature:**

| # | OWASP-categorie | Controle |
|---|---|---|
| 1 | Broken Access Control | Elke route heeft `requireAuth` + `requirePermission` |
| 2 | Cryptographic Failures | Geen gevoelige data in plain text; gebruik `.env` voor secrets |
| 3 | Injection | Alle queries zijn geparametriseerd; geen string-concatenatie |
| 4 | Insecure Design | Auth-logica zit in `server/src/auth.js`, niet verspreid |
| 5 | Security Misconfiguration | Geen debug-endpoints in productie; CORS correct geconfigureerd |
| 6 | Vulnerable Components | Geen bekende CVE's in nieuwe dependencies |
| 7 | Auth Failures | Sessie-expiry, rate limiting en lockout-logica intact |
| 8 | Software Integrity | CSRF-token via `api.js`; geen bypass met `--no-verify` |
| 9 | Logging & Monitoring | Gevoelige acties worden gelogd in `tbl_user_actions` |
| 10 | SSRF | Geen externe URL-fetches op basis van gebruikersinvoer |

**Blokkerende bevindingen** (feature mag niet shippend zonder fix):
- Onbeveiligde route (geen `requireAuth`).
- Gebruikersinvoer direct in SQL-query (injection).
- Secret of wachtwoord hardcoded in broncode.
- XSS-vector in React (gebruik van `dangerouslySetInnerHTML` zonder sanitatie).

**Niet-blokkerende bevindingen** worden als comment toegevoegd aan de Codex-prompt voor de volgende iteratie.

---

## Snel-referentie: welke rol voor welke taak?

| Taak | Primaire rol | Ondersteunende rollen |
|---|---|---|
| End-to-end feature-orkestratie | Project manager | Product Owner, Architect, Builder, Tester |
| Nieuwe feature uitdenken | Prompt Engineer | Product Owner, Architect |
| Architectuur naar uitvoerplan vertalen | Product Owner | Architect |
| Datamodel ontwerpen | Data-engineer | Architect |
| API-endpoint bouwen | Builder | Cyber-security |
| React-pagina bouwen | Builder | Designer |
| Stijl verfijnen | Designer | — |
| Tests schrijven | Tester | — |
| Beveiligingsaudit | Cyber-security | — |
| Architectuurreview | Architect | — |
| Prompt schrijven | Prompt Engineer | — |
