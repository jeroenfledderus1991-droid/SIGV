# Database Setup Tool

Een geavanceerde database setup tool met verschillende opties voor flexibel databasebeheer.

## Gebruik

```bash
python database_setup.py [optie]
```

## Beschikbare Opties

### `tables`
Voert alleen de tabel structuren uit. Gebruikt bestanden uit `sql/tables/` in numerieke volgorde.

```bash
python database_setup.py tables
```

**Gebruik voor:**
- Nieuwe database initialisatie
- Tabel structuur updates
- Ontwikkeling/testing setup

### `views`
Voert alleen database views uit. Gebruikt bestanden uit `sql/views/`.

```bash
python database_setup.py views
```

**Gebruik voor:**
- View definities toevoegen
- Rapportage views updaten
- Query abstractions

### `procedures`
Voert alleen stored procedures uit. Gebruikt bestanden uit `sql/procedures/`.

```bash
python database_setup.py procedures
```

**Gebruik voor:**
- Database logica procedures
- Performance optimalisaties
- Complex database operaties

### `migrations`
Voert database schema wijzigingen uit. Gebruikt bestanden uit `sql/migrations/`.

```bash
python database_setup.py migrations
```

**Gebruik voor:**
- Schema wijzigingen
- Data migraties
- Versie updates

### `eesa`
Maakt het standaard EESA superadmin account aan of werkt het bij.

```bash
python database_setup.py eesa
```

**Account details:**
- **Username:** EESA
- **Password:** kRyx2159S?;KWkkj
- **Email:** eesa@admin.local
- **Role:** superadmin (met alle rechten)

### `full`
Volledige database reset en setup. **VERWIJDERT ALLE BESTAANDE DATA!**

```bash
python database_setup.py full
```

**Voert uit:**
1. Verwijdert alle bestaande tabellen
2. Maakt alle tabellen opnieuw aan
3. Voegt views toe
4. Voegt procedures toe
5. Voert migraties uit
6. Maakt EESA account aan

**⚠️ WAARSCHUWING:** Dit commando verwijdert alle data en vraagt om bevestiging.

## Directory Structuur

```
sql/
├── tables/          # Tabel definities (001_*, 002_*, etc.)
├── views/           # Database views (*.sql)
├── procedures/      # Stored procedures (*.sql) 
└── migrations/      # Schema wijzigingen (*.sql)
```

## Extra map: security_audit

- `sql/security_audit/` bevat handmatige scripts voor een centrale audit-database.
- Gebruik `001_create_auth_audit_database.sql` als je mislukte loginpogingen van meerdere tools in een aparte database wilt verzamelen.
- Gebruik `002_create_system_error_table.sql` als je algemene serverfouten (5xx + process errors) centraal wilt opslaan.

## Voorbeelden

### Ontwikkeling Setup
```bash
# Nieuwe database setup voor ontwikkeling
python database_setup.py tables
python database_setup.py eesa
```

### Productie Migration
```bash
# Voeg nieuwe views toe zonder data te verliezen
python database_setup.py views
python database_setup.py procedures
```

### Volledige Reset (Testing)
```bash
# Complete reset voor testing
python database_setup.py full
```

### Alleen Account Herstel
```bash
# Reset alleen het EESA account
python database_setup.py eesa
```

## Veiligheidsfeatures

- **Bevestiging vereist** voor `full` reset
- **Idempotent** - veilig om meerdere keren uit te voeren
- **Gecontroleerde volgorde** voor tabellen (foreign key dependencies)
- **Error handling** met duidelijke foutmeldingen
- **Progress feedback** tijdens uitvoering

## Extensibiliteit

Voeg eenvoudig nieuwe componenten toe door:

1. **Views:** Plaats `.sql` bestanden in `sql/views/`
2. **Procedures:** Plaats `.sql` bestanden in `sql/procedures/`
3. **Migrations:** Plaats `.sql` bestanden in `sql/migrations/`
4. **Tabellen:** Voeg nieuwe `00X_naam.sql` bestanden toe en update de volgorde in de code

De tool detecteert automatisch nieuwe bestanden en voert ze uit in alfabetische volgorde (behalve tabellen die een specifieke volgorde hebben).
