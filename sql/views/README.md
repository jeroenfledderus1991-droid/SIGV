# Database Views - Schema Stability Layer

## 🎯 Purpose

Database views zorgen voor **stabiele interfaces** tussen de database en applicatie:

- ✅ **Schema wijzigingen** crashen de applicatie niet meer
- ✅ **Backwards compatibility** bij kolom toevoegingen/verwijderingen  
- ✅ **Expliciete kolom selectie** voorkomt `SELECT *` problemen
- ✅ **Logische data transformaties** op één plek

## 📐 Naming Convention

```
vw_[domain]_[entity]_[variant]

Examples:
- vw_accountbeheer_users          # Standaard user view
- vw_accountbeheer_users_detail   # Extended user info
- vw_stamgegevens_status          # Status master data
- vw_stamgegevens_categorie       # Category master data
```

## 🏗️ View Structure

### Basic View Template
```sql
IF OBJECT_ID('dbo.vw_accountbeheer_users', 'V') IS NOT NULL
    DROP VIEW dbo.vw_accountbeheer_users;
GO

CREATE VIEW dbo.vw_accountbeheer_users
AS
SELECT 
    -- Primary Key
    id,
    
    -- Core Attributes (EXPLICIT, never SELECT *)
    username,
    email,
    voornaam,
    achternaam,
    rol_id,
    actief,
    
    -- Computed/Formatted Fields
    CONCAT(voornaam, ' ', achternaam) AS volledig_naam,
    
    -- Timestamps
    created_at,
    updated_at
FROM 
    dbo.tbl_users
WHERE 
    -- Optional: Apply default filters
    actief = 1;
GO
```

## 🔧 Implementation Pattern

### 1. Create View
```sql
-- File: 001_create_vw_accountbeheer_users.sql
CREATE VIEW dbo.vw_accountbeheer_users AS
SELECT 
    id, username, email, voornaam, achternaam, 
    rol_id, actief, created_at
FROM dbo.tbl_users;
```

### 2. Repository Uses View
```python
# repositories/accountbeheer/user_repository.py
class UserRepository(BaseRepository):
    def __init__(self):
        # Use VIEW instead of table
        super().__init__('vw_accountbeheer_users', 'id')
    
    def get_all_active(self):
        # View already filters actief=1
        return self.get_all()
```

### 3. Schema Change (Safe!)
```sql
-- Add new column to table
ALTER TABLE dbo.tbl_users ADD nieuwe_kolom VARCHAR(50);

-- Update view to include it (or not!)
CREATE OR ALTER VIEW dbo.vw_accountbeheer_users AS
SELECT 
    id, username, email, voornaam, achternaam, 
    rol_id, actief, created_at,
    nieuwe_kolom  -- Optional: add to view when ready
FROM dbo.tbl_users;
```

**Result**: Application keeps working even if view doesn't expose new column yet!

## 📊 View Categories

### 1. **List Views** (Grid/Table Display)
Minimal columns for fast queries:
```sql
CREATE VIEW vw_stamgegevens_status_list AS
SELECT id, naam, bg_kleur, text_kleur, actief, volgorde
FROM tbl_status;
```

### 2. **Detail Views** (Single Record)
All relevant data including joins:
```sql
CREATE VIEW vw_accountbeheer_users_detail AS
SELECT 
    u.id, u.username, u.email,
    u.voornaam, u.achternaam,
    r.rol_naam,
    u.created_at, u.updated_at
FROM tbl_users u
LEFT JOIN tbl_rollen r ON u.rol_id = r.id;
```

### 3. **Lookup Views** (Dropdowns)
Minimal data for select lists:
```sql
CREATE VIEW vw_stamgegevens_status_lookup AS
SELECT id, naam
FROM tbl_status
WHERE actief = 1
ORDER BY volgorde;
```

## 🛡️ Benefits

### Before (Direct Table Access)
```python
# ❌ FRAGILE - Breaks if column added/removed
query = "SELECT * FROM tbl_users"
# If tbl_users gets new column, ORM might fail
# If column removed, crashes immediately
```

### After (View-Based)
```python
# ✅ STABLE - View controls what's exposed
query = "SELECT * FROM vw_accountbeheer_users"
# New table columns don't affect view
# View can be updated independently
# Application remains functional
```

## 📝 Migration Strategy

### Phase 1: Create Views for Existing Tables
```bash
python backend/sql/views/create_all_views.py
```

### Phase 2: Update Repositories
```python
# Old
class UserRepository(BaseRepository):
    def __init__(self):
        super().__init__('tbl_users', 'id')  # ❌ Direct table

# New
class UserRepository(BaseRepository):
    def __init__(self):
        super().__init__('vw_accountbeheer_users', 'id')  # ✅ View
```

### Phase 3: Test & Deploy
```bash
# Test all CRUD operations
pytest tests/repositories/test_user_repository.py

# Deploy views to production
sqlcmd -S server -d database -i sql/views/*.sql
```

## 🚀 Best Practices

1. **Never use `SELECT *`** - Always list columns explicitly
2. **Version your views** - Keep migration scripts
3. **Document view purpose** - Add comments in SQL
4. **Test performance** - Views should be indexed properly
5. **Use materialized views** for heavy computations (SQL Server: indexed views)

## 📚 Examples

See individual view files:
- `001_create_vw_accountbeheer_users.sql`
- `002_create_vw_stamgegevens_status.sql`
- `003_create_vw_stamgegevens_categorie.sql`

## 🔍 Debugging

```sql
-- Check if view exists
SELECT * FROM INFORMATION_SCHEMA.VIEWS 
WHERE TABLE_NAME LIKE 'vw_%';

-- View definition
EXEC sp_helptext 'vw_accountbeheer_users';

-- View dependencies
SELECT * FROM sys.sql_expression_dependencies 
WHERE referencing_id = OBJECT_ID('vw_accountbeheer_users');
```
