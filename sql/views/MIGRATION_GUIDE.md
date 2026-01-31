# Migration Guide: Table-Based → View-Based Repositories

## 🎯 Why Migrate?

**Problem**: Direct table access breaks when schema changes:
```python
# ❌ Current (Fragile)
class UserRepository:
    def get_all(self):
        return db.execute("SELECT * FROM tbl_users")
        # Breaks if columns added/removed/renamed!
```

**Solution**: View-based access is schema-stable:
```python
# ✅ New (Stable)
class UserRepository(ViewRepository):
    def get_all(self):
        return self.get_all()  # Uses vw_accountbeheer_users
        # Safe! View controls what's exposed
```

## 📋 Migration Checklist

### Phase 1: Preparation ✅
- [x] Create view SQL files in `sql/views/`
- [x] Create `ViewRepository` base class
- [x] Create example implementation (`UserViewRepository`)
- [ ] Run `python backend/sql/views/create_all_views.py`
- [ ] Verify views in database

### Phase 2: Repository Migration 🔄

For each repository:

1. **Create new view-based repository**
   ```python
   # repositories/accountbeheer/user_view_repository.py
   from repositories.base.view_repository import ViewRepository
   
   class UserViewRepository(ViewRepository):
       def __init__(self):
           super().__init__(
               view_name='vw_accountbeheer_users',
               table_name='tbl_users',
               primary_key='id'
           )
   ```

2. **Update service to use new repository**
   ```python
   # services/accountbeheer/user_service.py
   
   # Old
   from repositories.accountbeheer.user_repository import UserRepository
   
   # New
   from repositories.accountbeheer.user_view_repository import UserViewRepository
   
   class UserService:
       def __init__(self):
           # self.repo = UserRepository()  # Old
           self.repo = UserViewRepository()  # New
   ```

3. **Test all CRUD operations**
   ```bash
   pytest tests/repositories/test_user_repository.py -v
   ```

4. **Remove old repository** (after testing)
   ```bash
   # Move to archive
   mv repositories/accountbeheer/user_repository.py archief/
   ```

### Phase 3: Testing 🧪

Test each migrated repository:

```python
# tests/repositories/test_user_view_repository.py
def test_get_by_id():
    repo = UserViewRepository()
    user = repo.get_by_id(1)
    assert user is not None
    assert 'username' in user

def test_create_user():
    repo = UserViewRepository()
    user_id = repo.create({
        'username': 'test',
        'email': 'test@test.com',
        'password_hash': 'hash',
        'actief': 1
    })
    assert user_id is not None

def test_update_user():
    repo = UserViewRepository()
    success = repo.update(1, {'voornaam': 'Updated'})
    assert success == True

def test_delete_user():
    repo = UserViewRepository()
    success = repo.delete(999)  # Non-existent
    assert success == False
```

## 🗺️ Repository Migration Map

| Domain | Current Repository | New Repository | View Name | Status |
|--------|-------------------|----------------|-----------|--------|
| **Accountbeheer** |
| Users | `user_repository.py` | `user_view_repository.py` | `vw_accountbeheer_users` | ⏳ Ready |
| Roles | `role_repository.py` | `role_view_repository.py` | `vw_accountbeheer_rollen` | ⏳ Ready |
| **Stamgegevens** |
| Status | `status_repository.py` | `status_view_repository.py` | `vw_stamgegevens_status` | ⏳ Ready |
| Categorie | `categorie_repository.py` | `categorie_view_repository.py` | `vw_stamgegevens_categorie` | ⏳ Ready |

## 📝 Example Migration

### Before (Direct Table)
```python
# repositories/accountbeheer/user_repository.py
class UserRepository:
    def __init__(self):
        self.table_name = 'tbl_users'
    
    def get_by_id(self, user_id):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT * FROM {self.table_name} WHERE id = ?", (user_id,))
            return cursor.fetchone()
    
    def create(self, data):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(f"INSERT INTO {self.table_name} (...) VALUES (...)")
            return cursor.lastrowid
```

### After (View-Based)
```python
# repositories/accountbeheer/user_view_repository.py
from repositories.base.view_repository import ViewRepository

class UserViewRepository(ViewRepository):
    def __init__(self):
        super().__init__(
            view_name='vw_accountbeheer_users',  # Read from view
            table_name='tbl_users',              # Write to table
            primary_key='id'
        )
    
    # That's it! All CRUD methods inherited
    # get_by_id, get_all, create, update, delete - all work!
    
    # Add domain-specific methods:
    def get_active_users(self):
        return self.get_by_criteria({'actief': 1})
```

## 🚀 Deployment Steps

### Development
```bash
# 1. Create views
cd backend
python sql/views/create_all_views.py

# 2. Run tests
pytest tests/repositories/ -v

# 3. Test application
python app.py
# Test all CRUD operations in UI
```

### Staging
```bash
# 1. Deploy views
sqlcmd -S staging-server -d staging-db -i sql/views/*.sql

# 2. Deploy code
git pull origin main
systemctl restart planningstool-staging

# 3. Smoke tests
curl http://staging/health
```

### Production
```bash
# 1. Backup database
sqlcmd -S prod-server -Q "BACKUP DATABASE..."

# 2. Deploy views (non-breaking!)
sqlcmd -S prod-server -d prod-db -i sql/views/*.sql

# 3. Deploy code
git pull origin main
systemctl restart planningstool

# 4. Monitor
tail -f logs/planningstool.log
```

## 🔍 Verification

After migration, verify:

✅ All views created:
```sql
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS 
WHERE TABLE_NAME LIKE 'vw_%';
```

✅ All repositories working:
```bash
pytest tests/repositories/ -v --cov=repositories
```

✅ Application functional:
- Create new record
- Update existing record
- Delete record
- View all records

## 💡 Benefits After Migration

### 1. Schema Flexibility
```sql
-- Add column to table
ALTER TABLE tbl_users ADD nieuwe_kolom VARCHAR(50);

-- Application STILL WORKS! View hasn't changed
-- Update view when ready:
CREATE OR ALTER VIEW vw_accountbeheer_users AS
SELECT ..., nieuwe_kolom FROM tbl_users;  -- Add when needed
```

### 2. Computed Columns (No Table Changes!)
```sql
-- Add computed field in view only
CREATE OR ALTER VIEW vw_accountbeheer_users AS
SELECT 
    *,
    CONCAT(voornaam, ' ', achternaam) AS volledig_naam,  -- Computed!
    CASE WHEN actief = 1 THEN 'Actief' ELSE 'Inactief' END AS status_label
FROM tbl_users;
```

### 3. Backwards Compatibility
```sql
-- Remove column from table (after deprecation)
ALTER TABLE tbl_users DROP COLUMN old_column;

-- Update view to remove it
CREATE OR ALTER VIEW vw_accountbeheer_users AS
SELECT id, username, email -- old_column removed
FROM tbl_users;

-- Application updated at your pace, not forced by schema change!
```

## 🎓 Best Practices

1. **Always use views for SELECT** - Stable schema
2. **Always use tables for INSERT/UPDATE/DELETE** - Direct access needed
3. **Version your view changes** - Keep migration history
4. **Test before deploying** - Views affect queries
5. **Document view purpose** - Comments in SQL
6. **Monitor performance** - Add indexes if needed

## 📚 Next Steps

1. Run `python backend/sql/views/create_all_views.py`
2. Migrate one repository at a time
3. Test thoroughly
4. Deploy views to production
5. Enjoy schema stability! 🎉
