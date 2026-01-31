/*
    View Template - Copy this for new features
    
    Instructions:
    1. Copy this file to: XXX_create_vw_[domain]_[entity].sql
    2. Replace [DOMAIN], [ENTITY], [TABLE_NAME] with actual values
    3. Update column list to match your table
    4. Add computed columns as needed
    5. Run: python database_setup.py views
    
    Example:
    - 007_create_vw_projecten_taken.sql
    - vw_projecten_taken
    - tbl_taken
*/

-- Drop existing view if it exists
IF OBJECT_ID('dbo.vw_[DOMAIN]_[ENTITY]', 'V') IS NOT NULL
    DROP VIEW dbo.vw_[DOMAIN]_[ENTITY];
GO

-- Create view with explicit column selection
CREATE VIEW dbo.vw_[DOMAIN]_[ENTITY]
AS
SELECT 
    -- Primary Key
    id,
    
    -- Core Fields (REPLACE WITH YOUR COLUMNS)
    naam,
    omschrijving,
    
    -- Status & Ordering (if applicable)
    actief,
    volgorde,
    
    -- Timestamps
    created_at,
    updated_at,
    
    -- Computed Fields (add without changing table!)
    -- Examples:
    CASE 
        WHEN actief = 1 THEN 'Actief'
        ELSE 'Inactief'
    END AS status_label
    
    -- More computed examples:
    -- CONCAT(voornaam, ' ', achternaam) AS volledig_naam,
    -- DATEDIFF(day, created_at, GETDATE()) AS dagen_oud,
    -- CASE WHEN deadline < GETDATE() THEN 1 ELSE 0 END AS is_verlopen
FROM 
    dbo.[TABLE_NAME];
GO

-- Grant permissions
GRANT SELECT ON dbo.vw_[DOMAIN]_[ENTITY] TO public;
GO

/*
    Usage in Repository:
    
    from repositories.base.view_repository import ViewRepository
    
    class [Entity]Repository(ViewRepository):
        def __init__(self):
            super().__init__(
                view_name='vw_[domain]_[entity]',
                table_name='tbl_[entity]',
                primary_key='id'
            )
        
        # Add domain-specific methods
        def get_active(self):
            return self.get_by_criteria({'actief': 1})
*/
