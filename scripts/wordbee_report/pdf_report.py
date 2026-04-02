from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pandas as pd
from reportlab.graphics import renderPDF
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


def calculate_quality_score(total_issues: int, total_items: int) -> float:
    if not total_items:
        return 0.0
    return max(0.0, 100.0 - ((total_issues / total_items) * 100.0))


def build_monthly_status_overview(df: pd.DataFrame, month: int) -> tuple[list[tuple[str, list[int]]], pd.DataFrame]:
    statuses = [
        "Verzoek",
        "In uitvoering",
        "Werk klaar",
        "Resultaten goedgekeurd",
        "Geannuleerd",
    ]
    comments = df["comments"].fillna("").astype(str).str.strip() if "comments" in df.columns else pd.Series("", index=df.index)
    status_values = df["status"].fillna("").astype(str).str.strip().str.lower()
    ari_request_mask = status_values.eq("verzoek") & comments.str.upper().eq("ARI")
    ari_request_df = df.loc[ari_request_mask].copy()
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
        if status_name == "Verzoek":
            ari_counts = []
            for month_idx in range(1, 13):
                if month_idx > month:
                    ari_counts.append(0)
                    continue
                month_ari_count = int(ari_request_df[ari_request_df["period_month"] == month_idx].shape[0])
                ari_counts.append(month_ari_count)
            overview.append(("Verzoek (ARI)", ari_counts))
    return overview, ari_request_df


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


def _apply_single_header_table_style(table: Table, header_color: str, emphasize_last_row: bool = False) -> None:
    style_commands = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(header_color)),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(BRAND_COLORS["warm_dark"])),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FBF8F5")]),
        ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor(BRAND_COLORS["navy"])),
        ("FONTSIZE", (0, 0), (-1, -1), 8.4),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
    ]
    if emphasize_last_row:
        style_commands.extend([
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#EFE7DF")),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ])
    table.setStyle(TableStyle(style_commands))


def _build_language_table_rows(rows: list[dict], month_labels: list[str]) -> list[list[str]]:
    totals_per_month = [0 for _ in month_labels]
    total_all = 0
    body_rows = []
    for row in rows:
        values = [int(value) for value in row["values"]]
        for index, value in enumerate(values):
            totals_per_month[index] += value
        total_all += int(row["total"])
        body_rows.append([row["label"], *[format_int(value) for value in values], format_int(row["total"])])
    return [
        ["Brontaal", *month_labels, "Totaal"],
        *body_rows,
        ["Totaal", *[format_int(value) for value in totals_per_month], format_int(total_all)],
    ]


def _build_ari_request_rows(df: pd.DataFrame) -> list[list[str]]:
    rows = [["Maand", "Kenmerk", "Aanvraagnummer", "Status", "Comments"]]
    if df.empty:
        rows.append(["-", "-", "-", "-", "Geen verzoekregels met comment 'ARI'."])
        return rows
    month_lookup = {1: "Jan", 2: "Feb", 3: "Maa", 4: "Apr", 5: "Mei", 6: "Jun", 7: "Jul", 8: "Aug", 9: "Sep", 10: "Okt", 11: "Nov", 12: "Dec"}
    sorted_df = df.sort_values(["period_month", "aanvraagnummer", "kenmerk"], ascending=[True, True, True])
    for _, row in sorted_df.iterrows():
        rows.append([
            month_lookup.get(int(row.get("period_month") or 0), "-"),
            truncate_text(row.get("kenmerk"), 24),
            truncate_text(row.get("aanvraagnummer"), 20),
            truncate_text(row.get("status"), 24),
            truncate_text(row.get("comments"), 70),
        ])
    return rows


def build_pdf_report(
    output_pdf: Path,
    year: int,
    month: int,
    stats: pd.DataFrame,
    complaint_stats: pd.DataFrame,
    complaints_df: pd.DataFrame,
    df: pd.DataFrame,
    jobs_chart,
    words_chart,
    language_stats: dict,
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
    total_kwaliteit = calculate_quality_score(total_niet_leveringen, total_opdrachten)
    total_woorden = sum(month_woorden)
    total_klachten = sum(month_klachten)
    total_klacht_kwaliteit = calculate_quality_score(total_klachten, total_opdrachten)

    available_width_cm = (doc.pagesize[0] - doc.leftMargin - doc.rightMargin) / cm
    first_col_cm = 4.5
    period_col_count = len(month_labels) + 1
    period_col_cm = max(1.2, (available_width_cm - first_col_cm) / period_col_count)
    full_width_col_sizes = [first_col_cm * cm] + [period_col_cm * cm for _ in range(period_col_count)]
    language_month_labels = language_stats.get("month_labels", []) or month_labels
    language_period_col_count = len(language_month_labels) + 1
    language_first_col_cm = 3.4
    language_period_col_cm = max(1.0, (available_width_cm - language_first_col_cm) / max(1, language_period_col_count))
    language_col_sizes = [language_first_col_cm * cm] + [language_period_col_cm * cm for _ in range(language_period_col_count)]

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
    story.append(renderPDF.GraphicsFlowable(jobs_chart))
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
    story.append(renderPDF.GraphicsFlowable(words_chart))
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
    top_n = int(language_stats.get("top_n", 0) or 0)
    includes_other = bool(language_stats.get("includes_other"))
    language_scope_text = f"Top {top_n} brontalen" if top_n else "Brontalen"
    if includes_other:
        language_scope_text += " plus 'Overige'"
    story.append(Paragraph(f"{language_scope_text}, uitgesplitst per maand.", kpi_subtitle_style))
    language_jobs_rows = _build_language_table_rows(language_stats.get("job_rows", []), language_month_labels)
    language_jobs_table = Table(language_jobs_rows, colWidths=language_col_sizes, hAlign="LEFT")
    _apply_single_header_table_style(language_jobs_table, BRAND_COLORS["navy"], emphasize_last_row=True)
    story.append(Paragraph("Aantal opdrachten per brontaal", body_style))
    story.append(language_jobs_table)
    story.append(Spacer(1, 0.25 * cm))
    language_words_rows = _build_language_table_rows(language_stats.get("word_rows", []), language_month_labels)
    language_words_table = Table(language_words_rows, colWidths=language_col_sizes, hAlign="LEFT")
    _apply_single_header_table_style(language_words_table, BRAND_COLORS["red"], emphasize_last_row=True)
    story.append(Paragraph("Aantal vertaalde woorden per brontaal", body_style))
    story.append(language_words_table)
    story.append(PageBreak())

    story.append(Paragraph("Overzicht | Statussen vertalingen per maand", kpi_title_style))
    status_overview, ari_request_df = build_monthly_status_overview(df, month)
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
    story.append(Spacer(1, 0.22 * cm))
    story.append(Paragraph("Details | Verzoek (ARI)", body_style))
    ari_rows = _build_ari_request_rows(ari_request_df)
    ari_table = Table(
        ari_rows,
        colWidths=[1.5 * cm, 3.4 * cm, 2.8 * cm, 3.2 * cm, available_width_cm * cm - (1.5 + 3.4 + 2.8 + 3.2) * cm],
        repeatRows=1,
        hAlign="LEFT",
    )
    _apply_single_header_table_style(ari_table, BRAND_COLORS["navy"])
    story.append(ari_table)

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
