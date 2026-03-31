import argparse
import json
import os
import tempfile
from datetime import datetime
from pathlib import Path

import pandas as pd
import pyodbc
from dotenv import load_dotenv

from wordbee_report.charts import chart_jobs_and_late, chart_language_kpis, chart_words_per_month
from wordbee_report.pdf_report import build_pdf_report


MONTH_LABELS_NL = {
    1: "januari",
    2: "februari",
    3: "maart",
    4: "april",
    5: "mei",
    6: "juni",
    7: "juli",
    8: "augustus",
    9: "september",
    10: "oktober",
    11: "november",
    12: "december",
}


def load_environment(root: Path) -> None:
    env_path = root / ".env"
    if env_path.exists():
        load_dotenv(env_path)


def pick_sql_driver() -> str:
    drivers = [driver for driver in pyodbc.drivers() if "SQL Server" in driver]
    for preferred in ("ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server"):
        if preferred in drivers:
            return preferred
    if drivers:
        return drivers[-1]
    raise RuntimeError("Geen SQL Server ODBC driver gevonden.")


def connect_db() -> pyodbc.Connection:
    driver = pick_sql_driver()
    server = os.getenv("DB_SERVER", "").strip()
    port = os.getenv("DB_PORT", "1433").strip()
    database = os.getenv("DB_NAME", "").strip()
    user = os.getenv("DB_USER", "").strip()
    password = os.getenv("DB_PASSWORD", "").strip()
    encrypt = os.getenv("DB_ENCRYPT", "0").strip().lower() in ("1", "true", "yes")
    trust_cert = os.getenv("DB_TRUST_SERVER_CERTIFICATE", "1").strip().lower() in ("1", "true", "yes")

    if not server or not database or not user or not password:
        raise RuntimeError("Databaseconfiguratie ontbreekt in .env (DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD).")

    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={server},{port};"
        f"DATABASE={database};"
        f"UID={user};"
        f"PWD={password};"
        f"Encrypt={'yes' if encrypt else 'no'};"
        f"TrustServerCertificate={'yes' if trust_cert else 'no'};"
    )
    return pyodbc.connect(conn_str)


def fetch_report_data(conn: pyodbc.Connection, year: int, month: int) -> pd.DataFrame:
    query = """
        SELECT
            id,
            period_year,
            period_month,
            kenmerk,
            aanvraagnummer,
            status,
            brontaal,
            datum_van_ontvangst,
            deadline,
            aanvaarde_datum,
            aantal_vertaalde_woorden,
            voorstel_ander_deadline,
            nummer_rbtv,
            imported_at
        FROM dbo.vw_wordbee_import_rows
        WHERE period_year = ?
          AND period_month <= ?
        ORDER BY period_month ASC, id ASC;
    """
    cursor = conn.cursor()
    cursor.execute(query, [year, month])
    columns = [column[0] for column in cursor.description]
    rows = cursor.fetchall()
    return pd.DataFrame.from_records(rows, columns=columns)


def fetch_complaints(conn: pyodbc.Connection) -> pd.DataFrame:
    query = """
        SELECT
            id,
            kenmerk,
            complaint_text,
            complaint_date,
            actions_taken,
            resolved_date,
            created_by_display,
            updated_by_display,
            created_at,
            updated_at
        FROM dbo.vw_wordbee_complaints
        ORDER BY updated_at DESC, id DESC;
    """
    cursor = conn.cursor()
    cursor.execute(query)
    columns = [column[0] for column in cursor.description]
    rows = cursor.fetchall()
    return pd.DataFrame.from_records(rows, columns=columns)


def parse_nl_datetime(value) -> pd.Timestamp:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return pd.NaT
    text = str(value).strip()
    if not text:
        return pd.NaT
    return pd.to_datetime(text, errors="coerce", dayfirst=True)


def prepare_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    prepared = df.copy()
    if "clientnaam" not in prepared.columns:
        prepared["clientnaam"] = ""
    prepared["deadline_dt"] = prepared["deadline"].apply(parse_nl_datetime)
    prepared["aanvaarde_dt"] = prepared["aanvaarde_datum"].apply(parse_nl_datetime)
    prepared["ontvangst_dt"] = prepared["datum_van_ontvangst"].apply(parse_nl_datetime)
    prepared["aantal_vertaalde_woorden"] = pd.to_numeric(
        prepared["aantal_vertaalde_woorden"], errors="coerce"
    ).fillna(0)
    prepared["is_late"] = (
        prepared["deadline_dt"].notna()
        & prepared["aanvaarde_dt"].notna()
        & (prepared["aanvaarde_dt"] > prepared["deadline_dt"])
    )
    return prepared


def prepare_complaints_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    prepared = df.copy()
    if prepared.empty:
        prepared["kenmerk"] = []
        prepared["complaint_text"] = []
        prepared["actions_taken"] = []
        prepared["complaint_date"] = []
        prepared["resolved_date"] = []
        prepared["updated_by_display"] = []
        prepared["updated_at"] = []
        prepared["complaint_dt"] = []
        return prepared
    prepared["kenmerk"] = prepared["kenmerk"].fillna("").astype(str).str.strip()
    prepared["complaint_text"] = prepared["complaint_text"].fillna("").astype(str).str.strip()
    prepared["actions_taken"] = prepared["actions_taken"].fillna("").astype(str).str.strip()
    prepared["updated_by_display"] = prepared["updated_by_display"].fillna("").astype(str).str.strip()
    prepared["complaint_date"] = pd.to_datetime(prepared["complaint_date"], errors="coerce")
    prepared["resolved_date"] = pd.to_datetime(prepared["resolved_date"], errors="coerce")
    prepared["updated_at"] = pd.to_datetime(prepared["updated_at"], errors="coerce")
    prepared["complaint_dt"] = prepared["complaint_date"].where(prepared["complaint_date"].notna(), prepared["updated_at"])
    prepared = prepared[prepared["kenmerk"] != ""]
    prepared = prepared[
        (prepared["complaint_text"] != "")
        | (prepared["actions_taken"] != "")
        | prepared["complaint_date"].notna()
        | prepared["resolved_date"].notna()
    ]
    return prepared


def build_monthly_stats(df: pd.DataFrame, year: int, month: int) -> pd.DataFrame:
    rows = []
    for month_idx in range(1, 13):
        if month_idx > month:
            opdrachten = 0
            te_laat = 0
            pct_late = 0.0
            leverbetrouwbaarheid = 0.0
            words = 0
            niet_leveringen = 0
        else:
            month_df = df[df["period_month"] == month_idx]
            opdrachten = int(len(month_df))
            te_laat = int(month_df["is_late"].sum()) if opdrachten else 0
            pct_late = (te_laat / opdrachten) * 100 if opdrachten else 0.0
            leverbetrouwbaarheid = (1.0 - (te_laat / opdrachten)) * 100.0 if opdrachten else 0.0
            words = int(month_df["aantal_vertaalde_woorden"].sum()) if opdrachten else 0
            status_values = month_df["status"].fillna("").astype(str).str.lower()
            niet_leveringen = int(
                status_values.str.contains(r"niet[\s-]*lever|niet geleverd|niet\-geleverd|geannuleerd|cancelled|canceled", regex=True).sum()
            ) if opdrachten else 0
        kwaliteit = 100.0 - ((niet_leveringen / opdrachten) * 100.0) if opdrachten else 100.0
        rows.append(
            {
                "jaar": year,
                "maand_idx": month_idx,
                "maand": MONTH_LABELS_NL[month_idx],
                "opdrachten": opdrachten,
                "te_laat": te_laat,
                "pct_late": pct_late,
                "leverbetrouwbaarheid_pct": leverbetrouwbaarheid,
                "kwaliteit": kwaliteit,
                "woorden": words,
                "niet_leveringen": niet_leveringen,
            }
        )
    return pd.DataFrame(rows)


def build_monthly_complaint_stats(df: pd.DataFrame, complaints_df: pd.DataFrame, year: int, month: int) -> pd.DataFrame:
    complaint_keys = set(complaints_df["kenmerk"].tolist()) if not complaints_df.empty else set()
    rows = []
    for month_idx in range(1, 13):
        month_df = df[df["period_month"] == month_idx] if month_idx <= month else pd.DataFrame()
        opdrachten = int(len(month_df)) if month_idx <= month else 0
        klachten = int(month_df["kenmerk"].fillna("").astype(str).str.strip().isin(complaint_keys).sum()) if opdrachten else 0
        if month_idx > month:
            kwaliteit = 0.0
        else:
            kwaliteit = 100.0 - ((klachten / opdrachten) * 100.0) if opdrachten else 0.0
        rows.append(
            {
                "jaar": year,
                "maand_idx": month_idx,
                "maand": MONTH_LABELS_NL[month_idx],
                "opdrachten": opdrachten,
                "klachten": klachten,
                "kwaliteit": max(0.0, kwaliteit),
            }
        )
    return pd.DataFrame(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Genereer WordBee opdrachtgever-rapportage (PDF).")
    parser.add_argument("--year", type=int, default=datetime.now().year)
    parser.add_argument("--month", type=int, default=datetime.now().month)
    parser.add_argument(
        "--output",
        type=str,
        default="",
        help="Optioneel output pad naar PDF. Default: exports/Voorbeeldrapportage-opdrachtgever-YYYY-MM.pdf",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.month < 1 or args.month > 12:
        raise ValueError("Maand moet tussen 1 en 12 liggen.")

    root = Path(__file__).resolve().parents[1]
    load_environment(root)

    output_dir = root / "exports"
    output_dir.mkdir(parents=True, exist_ok=True)
    default_name = f"Voorbeeldrapportage-opdrachtgever-{args.year}-{str(args.month).zfill(2)}.pdf"
    output_pdf = Path(args.output).resolve() if args.output else (output_dir / default_name)

    with connect_db() as conn:
        raw_df = fetch_report_data(conn, args.year, args.month)
        raw_complaints_df = fetch_complaints(conn)

    df = prepare_dataframe(raw_df)
    complaints_df = prepare_complaints_dataframe(raw_complaints_df)
    stats = build_monthly_stats(df, args.year, args.month)
    complaint_stats = build_monthly_complaint_stats(df, complaints_df, args.year, args.month)

    with tempfile.TemporaryDirectory(prefix="wordbee-report-") as temp_dir:
        temp_path = Path(temp_dir)
        jobs_chart = temp_path / "jobs_late.png"
        words_chart = temp_path / "words_per_month.png"
        language_kpi_chart = temp_path / "language_kpis.png"
        logo_path = root / "SIGV-logo.jpg"

        chart_jobs_and_late(stats, jobs_chart)
        chart_words_per_month(stats, words_chart)
        chart_language_kpis(df, language_kpi_chart)

        build_pdf_report(
            output_pdf,
            args.year,
            args.month,
            stats,
            complaint_stats,
            complaints_df,
            df,
            jobs_chart,
            words_chart,
            language_kpi_chart,
            logo_path,
        )

    summary = {
        "ok": True,
        "output": str(output_pdf),
        "year": args.year,
        "month": args.month,
        "rows": int(len(df)),
        "months_included": list(range(1, 13)),
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
