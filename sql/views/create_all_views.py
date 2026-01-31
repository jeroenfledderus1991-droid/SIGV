"""
Database Views Creator

Creates all database views for schema stability.
Run this script after database initialization or when views need updating.

Usage:
    python backend/sql/views/create_all_views.py
    python backend/sql/views/create_all_views.py --drop-first
"""

import sys
import os
from pathlib import Path
import pyodbc
from typing import List

# Add backend to path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from database import get_db


def get_view_files() -> List[Path]:
    """Get all SQL view files in order"""
    views_dir = Path(__file__).parent
    sql_files = sorted(views_dir.glob('*.sql'))
    
    # Filter for numbered SQL files
    sql_files = [f for f in sql_files if f.name[:3].isdigit() and f.name[3] == '_']
    
    return sql_files


def execute_sql_file(conn: pyodbc.Connection, sql_file: Path) -> bool:
    """Execute a SQL file"""
    try:
        print(f"📄 Executing: {sql_file.name}")
        
        with open(sql_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        # Split by GO statements (SQL Server batch separator)
        batches = [batch.strip() for batch in sql_content.split('GO') if batch.strip()]
        
        cursor = conn.cursor()
        for batch in batches:
            if batch:
                cursor.execute(batch)
        
        conn.commit()
        cursor.close()
        
        print(f"   ✅ Success: {sql_file.name}")
        return True
        
    except Exception as e:
        print(f"   ❌ Error in {sql_file.name}: {e}")
        return False


def check_views_exist(conn: pyodbc.Connection) -> dict:
    """Check which views currently exist"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.VIEWS 
        WHERE TABLE_NAME LIKE 'vw_%'
        ORDER BY TABLE_NAME
    """)
    
    existing_views = {row[0] for row in cursor.fetchall()}
    cursor.close()
    
    return existing_views


def drop_all_views(conn: pyodbc.Connection, drop_first: bool = False):
    """Drop all existing views if requested"""
    if not drop_first:
        return
    
    print("\n🗑️  Dropping existing views...")
    existing_views = check_views_exist(conn)
    
    if not existing_views:
        print("   No existing views to drop")
        return
    
    cursor = conn.cursor()
    for view_name in existing_views:
        try:
            cursor.execute(f"DROP VIEW dbo.{view_name}")
            print(f"   ✅ Dropped: {view_name}")
        except Exception as e:
            print(f"   ❌ Failed to drop {view_name}: {e}")
    
    conn.commit()
    cursor.close()


def main():
    """Create all database views"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Create database views')
    parser.add_argument('--drop-first', action='store_true', 
                       help='Drop existing views before creating')
    args = parser.parse_args()
    
    print("=" * 60)
    print("🏗️  Database Views Creator")
    print("=" * 60)
    
    # Get view files
    view_files = get_view_files()
    
    if not view_files:
        print("❌ No view files found!")
        return 1
    
    print(f"\n📋 Found {len(view_files)} view file(s):")
    for vf in view_files:
        print(f"   - {vf.name}")
    
    # Connect to database
    print("\n🔌 Connecting to database...")
    try:
        with get_db() as conn:
            print("   ✅ Connected")
            
            # Check existing views
            existing_views = check_views_exist(conn)
            if existing_views:
                print(f"\n📊 Existing views ({len(existing_views)}):")
                for view in sorted(existing_views):
                    print(f"   - {view}")
            
            # Drop if requested
            if args.drop_first:
                drop_all_views(conn, drop_first=True)
            
            # Create views
            print("\n🚀 Creating views...")
            success_count = 0
            fail_count = 0
            
            for sql_file in view_files:
                if execute_sql_file(conn, sql_file):
                    success_count += 1
                else:
                    fail_count += 1
            
            # Summary
            print("\n" + "=" * 60)
            print("📊 Summary:")
            print(f"   ✅ Successful: {success_count}")
            if fail_count > 0:
                print(f"   ❌ Failed: {fail_count}")
            print("=" * 60)
            
            # Verify created views
            print("\n🔍 Verifying views...")
            final_views = check_views_exist(conn)
            print(f"   Total views in database: {len(final_views)}")
            for view in sorted(final_views):
                print(f"   ✅ {view}")
            
            return 0 if fail_count == 0 else 1
            
    except Exception as e:
        print(f"\n❌ Database connection error: {e}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
