from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from wordbee_report.branding import BRAND_COLORS, PAGE_HEADERS


def format_pct(value: float) -> str:
    return f"{value:.1f}%".replace(".", ",")


def format_int(value: int) -> str:
    return f"{int(value):,}".replace(",", ".")


def truncate_text(value, max_len: int = 110) -> str:
    text = str(value or "").strip()
    if len(text) <= max_len:
        return text
    return f"{text[: max_len - 1]}..."


def build_monthly_status_overview(df: pd.DataFrame, month: int) -> list[tuple[str, list[int]]]:
    statuses = [
        "Verzoek",
        "In uitvoering",
        "Werk klaar",
        "Resultaten goedgekeurd",
        "Geannuleerd",
    ]
    overview = []
    for status_name in statuses:
        counts = []
        for month_idx in range(1, 13):
            if month_idx > month:
                counts.append(0)
                continue
            month_df = df[df["period_month"] == month_idx]
            month_status_count = int(
                month_df["status"].fillna("").astype(str).str.strip().str.lower().eq(status_name.lower()).sum()
            )
            counts.append(month_status_count)
        overview.append((status_name, counts))
    return overview


def _append_cover(story: list, logo_path: Path | None, month_label: str, year: int, generated_at: str, styles_map: dict) -> None:
    if logo_path and logo_path.exists():
        story.append(Image(str(logo_path), width=5.2 * cm, height=3.0 * cm))
        story.append(Spacer(1, 1.2 * cm))
    story.append(Paragraph("SIGV Coöperatie", styles_map["cover_eyebrow"]))
    story.append(Paragraph("Maandrapportage", styles_map["title"]))
    story.append(Paragraph(f"Rapportage t/m {month_label} {year}", styles_map["subtitle"]))
    story.append(Paragraph(f"Gegenereerd op {generated_at}", styles_map["lead"]))
    story.append(PageBreak())


def _apply_summary_table_style(table: Table, header_color: str) -> None:
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(header_color)),
                ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor(BRAND_COLORS["navy"])),
                ("TEXTCOLOR", (0, 0), (-1, 1), colors.white),
                ("FONTNAME", (0, 0), (-1, 1), "Helvetica-Bold"),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(BRAND_COLORS["warm_dark"])),
                ("ROWBACKGROUNDS", (0, 2), (-1, -1), [colors.white, colors.HexColor("#FBF8F5")]),
                ("TEXTCOLOR", (0, 2), (-1, -1), colors.HexColor(BRAND_COLORS["navy"])),
                ("FONTSIZE", (0, 0), (-1, -1), 9.4),
                ("BOTTOMPADDING", (0, 0), (-1, 1), 6),
                ("TOPPADDING", (0, 0), (-1, 1), 6),
                ("FONTNAME", (0, 2), (0, -1), "Helvetica-Bold"),
            ]
        )
    )


def build_pdf_report(
    output_pdf: Path,
    year: int,
    month: int,
    stats: pd.DataFrame,
    complaint_stats: pd.DataFrame,
    complaints_df: pd.DataFrame,
    df: pd.DataFrame,
    jobs_chart: Path,
    words_chart: Path,
    language_kpi_chart: Path,
    logo_path: Path | None = None,
) -> None:
    doc = SimpleDocTemplate(
        str(output_pdf),
        pagesize=landscape(A4),
        rightMargin=1.3 * cm,
        leftMargin=1.3 * cm,
        topMargin=1.85 * cm,
        bottomMargin=1.2 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleLarge",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=28,
        leading=34,
        textColor=colors.HexColor(BRAND_COLORS["navy"]),
        spaceAfter=14,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor(BRAND_COLORS["muted"]),
        spaceAfter=8,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor(BRAND_COLORS["navy"]),
    )
    cover_eyebrow_style = ParagraphStyle(
        "CoverEyebrow",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor(BRAND_COLORS["red"]),
        spaceAfter=6,
    )
    cover_lead_style = ParagraphStyle(
        "CoverLead",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=22,
        textColor=colors.HexColor(BRAND_COLORS["navy"]),
        spaceAfter=14,
    )
    kpi_title_style = ParagraphStyle(
        "KpiPageTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=19,
        leading=23,
        textColor=colors.HexColor(BRAND_COLORS["navy"]),
        spaceAfter=4,
    )
    kpi_subtitle_style = ParagraphStyle(
        "KpiPageSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor(BRAND_COLORS["muted"]),
        spaceAfter=8,
    )

    styles_map = {
        "body": body_style,
        "cover_eyebrow": cover_eyebrow_style,
        "lead": cover_lead_style,
        "subtitle": subtitle_style,
        "title": title_style,
    }

    story = []
    month_label = str(stats["maand"].iloc[month - 1]).capitalize()
    generated_at = datetime.now().strftime("%d-%m-%Y %H:%M")
    month_labels = [str(name)[:3] for name in stats["maand"].tolist()]
    month_opdrachten = stats["opdrachten"].astype(int).tolist()
    month_niet_leveringen = stats["niet_leveringen"].astype(int).tolist()
    month_kwaliteit = stats["kwaliteit"].astype(float).tolist()
    month_woorden = stats["woorden"].astype(int).tolist()
    month_klachten = complaint_stats["klachten"].astype(int).tolist()
    month_klacht_kwaliteit = complaint_stats["kwaliteit"].astype(float).tolist()

    total_opdrachten = sum(month_opdrachten)
    total_niet_leveringen = sum(month_niet_leveringen)
    total_kwaliteit = sum(month_kwaliteit) / len(month_kwaliteit) if month_kwaliteit else 0.0
    total_woorden = sum(month_woorden)
    total_klachten = sum(month_klachten)
    total_klacht_kwaliteit = sum(month_klacht_kwaliteit) / len(month_klacht_kwaliteit) if month_klacht_kwaliteit else 0.0

    available_width_cm = (doc.pagesize[0] - doc.leftMargin - doc.rightMargin) / cm
    first_col_cm = 4.5
    period_col_count = len(month_labels) + 1
    period_col_cm = max(1.2, (available_width_cm - first_col_cm) / period_col_count)
    full_width_col_sizes = [first_col_cm * cm] + [period_col_cm * cm for _ in range(period_col_count)]

    _append_cover(story, logo_path, month_label, year, generated_at, styles_map)

    story.append(Paragraph("KPI 1 | Continuiteit", kpi_title_style))
    story.append(Paragraph("Aantal opdrachten, niet-leveringen (incl. geannuleerd) en kwaliteitsscore per maand.", kpi_subtitle_style))
    kpi_rows = [
        ["", *month_labels, "Totaal"],
        ["Aantal opdrachten", *[format_int(v) for v in month_opdrachten], format_int(total_opdrachten)],
        ["Niet-leveringen", *[format_int(v) for v in month_niet_leveringen], format_int(total_niet_leveringen)],
        ["Kwaliteitsscore", *[format_pct(v) for v in month_kwaliteit], format_pct(total_kwaliteit)],
    ]
    kpi_table = Table(kpi_rows, colWidths=full_width_col_sizes, hAlign="LEFT")
    _apply_summary_table_style(kpi_table, BRAND_COLORS["red"])
    story.append(kpi_table)
    story.append(Spacer(1, 0.35 * cm))
    story.append(Paragraph(f"Totaal opdrachten (YTD): <b>{format_int(len(df))}</b>", body_style))
    story.append(PageBreak())

    story.append(Paragraph("KPI 2 | Kwaliteit > Leverbetrouwbaarheid vertaalopdracht", kpi_title_style))
    story.append(Paragraph("Leverbetrouwbaarheid op basis van tijdige oplevering; lijn stopt bij de laatste maand met data.", kpi_subtitle_style))
    story.append(Image(str(jobs_chart), width=26.3 * cm, height=8.2 * cm))
    story.append(PageBreak())

    story.append(Paragraph("KPI 3 | Kwaliteit > Klachten op vertaalopdracht", kpi_title_style))
    story.append(Paragraph("Klachten worden handmatig vastgelegd per kenmerk en hier per maand samengevat.", kpi_subtitle_style))
    klacht_rows = [
        ["", *month_labels, "Totaal"],
        ["Status", *["# jobs" for _ in month_labels], "# jobs"],
        ["Aantal opdrachten", *[format_int(v) for v in month_opdrachten], format_int(total_opdrachten)],
        ["Klachten", *[format_int(v) for v in month_klachten], format_int(total_klachten)],
        ["Kwaliteitsscore", *[format_pct(v) for v in month_klacht_kwaliteit], format_pct(total_klacht_kwaliteit)],
    ]
    klacht_table = Table(klacht_rows, colWidths=full_width_col_sizes, hAlign="LEFT")
    _apply_summary_table_style(klacht_table, BRAND_COLORS["navy"])
    story.append(klacht_table)
    story.append(PageBreak())

    story.append(Paragraph("KPI 4 | Aantal woorden vertaald", kpi_title_style))
    story.append(Paragraph("Alleen aantal vertaalde woorden per maand.", kpi_subtitle_style))
    story.append(Image(str(words_chart), width=26.3 * cm, height=8.2 * cm))
    story.append(Paragraph(f"Totaal woorden (YTD): <b>{format_int(total_woorden)}</b>", body_style))
    story.append(PageBreak())

    story.append(Paragraph("Klachtenregister", kpi_title_style))
    story.append(Paragraph("Handmatig vastgelegde klachten gekoppeld aan WordBee kenmerk.", kpi_subtitle_style))
    klachten_rows = [[
        "ID-nummer",
        "Klant",
        "Datum klacht",
        "Ingediend door",
        "Inhoud klacht",
        "Genomen acties",
        "Classificatie",
        "Opgelost op",
    ]]
    if complaints_df.empty:
        klachten_rows.append(["Nog geen handmatige klachtendata", "-", "-", "-", "Nog geen klachten opgeslagen.", "-", "-", "-"])
    else:
        merged_complaints_df = complaints_df.merge(
            df[["kenmerk", "aanvraagnummer", "clientnaam"]].drop_duplicates(subset=["kenmerk"]),
            on="kenmerk",
            how="left",
        )
        for _, row in merged_complaints_df.head(12).iterrows():
            complaint_date = row.get("complaint_dt")
            complaint_date_text = complaint_date.strftime("%d-%m-%Y") if pd.notna(complaint_date) else "-"
            resolved_date = row.get("resolved_date")
            resolved_date_text = resolved_date.strftime("%d-%m-%Y") if pd.notna(resolved_date) else "-"
            klachten_rows.append(
                [
                    truncate_text(row.get("aanvraagnummer") or row.get("kenmerk"), 26),
                    truncate_text(row.get("clientnaam") or row.get("kenmerk"), 24),
                    complaint_date_text,
                    truncate_text(row.get("updated_by_display") or "-", 20),
                    truncate_text(row.get("complaint_text"), 92),
                    truncate_text(row.get("actions_taken"), 84),
                    "Klacht",
                    resolved_date_text,
                ]
            )
    klachten_table = Table(
        klachten_rows,
        colWidths=[2.6 * cm, 2.3 * cm, 2.0 * cm, 3.0 * cm, 5.9 * cm, 6.0 * cm, 1.7 * cm, 2.2 * cm],
        repeatRows=1,
    )
    klachten_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(BRAND_COLORS["red"])),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor(BRAND_COLORS["warm_dark"])),
                ("FONTSIZE", (0, 0), (-1, -1), 6.6),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (2, 1), (2, -1), "CENTER"),
                ("ALIGN", (7, 1), (7, -1), "CENTER"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FBF8F5")]),
                ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor(BRAND_COLORS["navy"])),
            ]
        )
    )
    story.append(klachten_table)
    story.append(PageBreak())

    story.append(Paragraph("Taalanalyse", kpi_title_style))
    story.append(Paragraph("Aantal opdrachten en aantal vertaalde woorden per brontaal.", kpi_subtitle_style))
    story.append(Image(str(language_kpi_chart), width=26.0 * cm, height=14.8 * cm))
    story.append(PageBreak())

    story.append(Paragraph("Overzicht | Statussen vertalingen per maand", kpi_title_style))
    status_overview = build_monthly_status_overview(df, month)
    status_rows = [["Status", *month_labels, "Totaal"]]
    for status_name, counts in status_overview:
        status_rows.append([status_name, *[format_int(v) for v in counts], format_int(sum(counts))])
    status_table = Table(status_rows, colWidths=full_width_col_sizes, hAlign="LEFT")
    status_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(BRAND_COLORS["red"])),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(BRAND_COLORS["warm_dark"])),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FBF8F5")]),
                ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor(BRAND_COLORS["navy"])),
                ("FONTSIZE", (0, 0), (-1, -1), 9.2),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                ("TOPPADDING", (0, 0), (-1, 0), 6),
            ]
        )
    )
    story.append(status_table)

    def draw_page_chrome(canvas, doc_template) -> None:
        page_number = canvas.getPageNumber()
        header_text = PAGE_HEADERS.get(page_number, "SIGV Coöperatie | Rapportage")
        page_width, page_height = doc_template.pagesize
        canvas.saveState()
        canvas.setFillColor(colors.HexColor(BRAND_COLORS["red"]))
        canvas.rect(0, page_height - 0.58 * cm, page_width, 0.58 * cm, stroke=0, fill=1)
        canvas.setFillColor(colors.HexColor(BRAND_COLORS["navy"]))
        canvas.setFont("Helvetica-Bold", 10)
        canvas.drawString(doc_template.leftMargin, page_height - 1.12 * cm, header_text)
        if logo_path and logo_path.exists():
            canvas.drawImage(
                str(logo_path),
                page_width - doc_template.rightMargin - 2.2 * cm,
                page_height - 1.52 * cm,
                width=2.2 * cm,
                height=1.26 * cm,
                preserveAspectRatio=True,
                mask="auto",
            )
        canvas.setFont("Helvetica", 9)
        canvas.setFillColor(colors.HexColor(BRAND_COLORS["muted"]))
        canvas.drawRightString(page_width - doc_template.rightMargin, 0.72 * cm, f"Pagina {page_number}")
        canvas.setStrokeColor(colors.HexColor(BRAND_COLORS["grid"]))
        canvas.setLineWidth(0.6)
        canvas.line(
            doc_template.leftMargin,
            page_height - 1.28 * cm,
            page_width - doc_template.rightMargin - 2.7 * cm,
            page_height - 1.28 * cm,
        )
        canvas.restoreState()

    doc.build(story, onFirstPage=draw_page_chrome, onLaterPages=draw_page_chrome)
