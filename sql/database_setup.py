"""
Database setup helper.

Usage:
  python database_setup.py initialize|tables|views|procedures|data|migrations|all|cleanup
"""

import sys
import os
from pathlib import Path
import logging

from database import get_db


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


class DatabaseSetup:
    def __init__(self):
        self.base_path = Path(__file__).parent

    def get_sql_files(self, folder):
        folder_path = self.base_path / folder
        if not folder_path.exists():
            logger.warning("Folder %s does not exist", folder_path)
            return []
        sql_files = [f for f in folder_path.glob("*.sql") if not f.name.startswith("TEMPLATE_")]
        if folder == "data" and os.getenv("ALLOW_SEED_USERS", "").lower() != "1":
            filtered = []
            for sql_file in sql_files:
                if sql_file.name == "03_default_users_seed.sql":
                    logger.warning("Skipping %s (set ALLOW_SEED_USERS=1 to enable).", sql_file.name)
                    continue
                filtered.append(sql_file)
            sql_files = filtered

        def sort_key(filepath):
            name = filepath.stem
            i = 0
            while i < len(name) and name[i].isdigit():
                i += 1
            return (int(name[:i]) if i else 999999, name)

        sql_files.sort(key=sort_key)
        return [str(f) for f in sql_files]

    def execute_sql_file(self, filepath):
        try:
            logger.info("Executing SQL file: %s", Path(filepath).name)
            sql_content = Path(filepath).read_text(encoding="utf-8")
            batches = [batch.strip() for batch in sql_content.split("GO") if batch.strip()]
            error_count = 0
            with get_db() as conn:
                cursor = conn.cursor()
                for index, batch in enumerate(batches, start=1):
                    try:
                        cursor.execute(batch)
                    except Exception as exc:
                        error_count += 1
                        logger.error("Error in batch %s/%s: %s", index, len(batches), exc)
                try:
                    conn.commit()
                except Exception as commit_err:
                    logger.error("Commit failed for %s: %s", Path(filepath).name, commit_err)
                    return False
            if error_count == 0:
                logger.info("OK: %s", Path(filepath).name)
                return True
            logger.warning("Completed %s with %s batch errors", Path(filepath).name, error_count)
            return False
        except Exception as exc:
            logger.error("Failed to execute %s: %s", Path(filepath).name, exc)
            return False

    def execute_folder(self, folder, label):
        logger.info("Running %s scripts...", label)
        sql_files = self.get_sql_files(folder)
        if not sql_files:
            logger.info("No %s SQL files found", label)
            return True
        success = True
        for sql_file in sql_files:
            if not self.execute_sql_file(sql_file):
                success = False
        return success

    def execute_initialize(self):
        return self.execute_folder("initialize", "initialize")

    def execute_tables(self):
        return self.execute_folder("tables", "tables")

    def execute_views(self):
        return self.execute_folder("views", "views")

    def execute_procedures(self):
        return self.execute_folder("procedures", "procedures")

    def execute_data(self):
        return self.execute_folder("data", "data")

    def execute_migrations(self):
        return self.execute_folder("migrations", "migrations")

    def execute_cleanup(self):
        response = input("Type YES to run cleanup (this deletes data): ")
        if response != "YES":
            logger.info("Cleanup cancelled.")
            return False
        return self.execute_folder("initialize", "cleanup")

    def execute_all(self):
        success = True
        if not self.execute_initialize():
            success = False
        if not self.execute_tables():
            success = False
        if not self.execute_views():
            success = False
        if not self.execute_procedures():
            success = False
        if not self.execute_data():
            success = False
        return success


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    option = sys.argv[1].lower()
    setup = DatabaseSetup()
    try:
        with get_db():
            logger.info("Database connection successful")
    except Exception as exc:
        logger.error("Database connection failed: %s", exc)
        return

    if option == "initialize":
        setup.execute_initialize()
    elif option == "tables":
        setup.execute_tables()
    elif option == "views":
        setup.execute_views()
    elif option == "procedures":
        setup.execute_procedures()
    elif option == "data":
        setup.execute_data()
    elif option == "migrations":
        setup.execute_migrations()
    elif option == "cleanup":
        setup.execute_cleanup()
    elif option == "all":
        setup.execute_all()
    else:
        print("Unknown option:", option)
        print(__doc__)


if __name__ == "__main__":
    main()
