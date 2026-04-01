from __future__ import annotations

from reportlab.graphics.shapes import Circle, Drawing, Line, PolyLine, Rect, String
from reportlab.lib import colors

from wordbee_report.branding import BRAND_COLORS


def _color(value: str):
    return colors.HexColor(value)


def _safe_max(values, fallback: float = 1.0) -> float:
    numeric = [float(value) for value in values if value is not None]
    return max(numeric) if numeric else fallback


def _add_chart_frame(drawing: Drawing, width: float, height: float, left: float, bottom: float, top: float, right: float):
    plot_width = width - left - right
    plot_height = height - bottom - top
    drawing.add(Line(left, bottom, left, bottom + plot_height, strokeColor=_color(BRAND_COLORS["grid"]), strokeWidth=1))
    drawing.add(Line(left, bottom, left + plot_width, bottom, strokeColor=_color(BRAND_COLORS["grid"]), strokeWidth=1))
    return plot_width, plot_height


def chart_jobs_and_late(stats, width: float = 746, height: float = 232) -> Drawing:
    drawing = Drawing(width, height)
    left, bottom, top, right = 42, 28, 34, 42
    plot_width, plot_height = _add_chart_frame(drawing, width, height, left, bottom, top, right)
    labels = [str(value)[:3] for value in stats["maand"].tolist()]
    jobs = [int(value) for value in stats["opdrachten"].tolist()]
    reliability = [float(value) if int(jobs[idx]) > 0 else None for idx, value in enumerate(stats["leverbetrouwbaarheid_pct"].tolist())]
    max_jobs = max(5, int(_safe_max(jobs, 5)))
    slot_width = plot_width / max(1, len(labels))
    bar_width = slot_width * 0.56

    for idx in range(6):
        y = bottom + (plot_height / 5) * idx
        drawing.add(Line(left, y, left + plot_width, y, strokeColor=_color(BRAND_COLORS["grid"]), strokeWidth=0.7))

    line_points = []
    for idx, label in enumerate(labels):
        center_x = left + slot_width * idx + slot_width / 2
        value = jobs[idx]
        bar_height = (value / max_jobs) * (plot_height - 4)
        bar_x = center_x - bar_width / 2
        drawing.add(
            Rect(
                bar_x,
                bottom,
                bar_width,
                bar_height,
                fillColor=_color(BRAND_COLORS["navy"]),
                strokeColor=_color(BRAND_COLORS["navy"]),
                rx=2,
                ry=2,
            )
        )
        if value > 0:
            label_y = bottom + max(10, bar_height - 14)
            drawing.add(
                String(
                    center_x,
                    label_y,
                    str(value),
                    textAnchor="middle",
                    fontName="Helvetica-Bold",
                    fontSize=8,
                    fillColor=colors.white,
                )
            )
        drawing.add(
            String(
                center_x,
                12,
                label,
                textAnchor="middle",
                fontName="Helvetica",
                fontSize=8,
                fillColor=_color(BRAND_COLORS["text"]),
            )
        )
        reliability_value = reliability[idx]
        if reliability_value is not None:
            point_y = bottom + (reliability_value / 100.0) * (plot_height - 4)
            line_points.extend([center_x, point_y])
            drawing.add(Circle(center_x, point_y, 3.5, fillColor=_color(BRAND_COLORS["red"]), strokeColor=_color(BRAND_COLORS["red"])))
            drawing.add(
                String(
                    center_x,
                    point_y + 8,
                    f"{reliability_value:.1f}%",
                    textAnchor="middle",
                    fontName="Helvetica-Bold",
                    fontSize=7.5,
                    fillColor=_color(BRAND_COLORS["red"]),
                )
            )

    if len(line_points) >= 4:
        drawing.add(PolyLine(line_points, strokeColor=_color(BRAND_COLORS["red"]), strokeWidth=2.5))

    drawing.add(String(0, height - 12, "", fontSize=1))
    drawing.add(String(left, height - 16, "# vertaalopdrachten", fontName="Helvetica", fontSize=8.5, fillColor=_color(BRAND_COLORS["text"])))
    drawing.add(Rect(left - 14, height - 21, 10, 10, fillColor=_color(BRAND_COLORS["navy"]), strokeColor=_color(BRAND_COLORS["navy"])))
    legend_x = width - 178
    drawing.add(Line(legend_x, height - 16, legend_x + 12, height - 16, strokeColor=_color(BRAND_COLORS["red"]), strokeWidth=2.5))
    drawing.add(Circle(legend_x + 6, height - 16, 2.6, fillColor=_color(BRAND_COLORS["red"]), strokeColor=_color(BRAND_COLORS["red"])))
    drawing.add(String(legend_x + 18, height - 20, "% leverbetrouwbaarheid", fontName="Helvetica", fontSize=8.5, fillColor=_color(BRAND_COLORS["text"])))
    return drawing


def chart_words_per_month(stats, width: float = 746, height: float = 232) -> Drawing:
    drawing = Drawing(width, height)
    left, bottom, top, right = 42, 28, 26, 28
    plot_width, plot_height = _add_chart_frame(drawing, width, height, left, bottom, top, right)
    labels = [str(value)[:3] for value in stats["maand"].tolist()]
    words = [int(value) for value in stats["woorden"].tolist()]
    max_words = max(100, int(_safe_max(words, 100)))
    slot_width = plot_width / max(1, len(labels))
    bar_width = slot_width * 0.56

    for idx in range(6):
        y = bottom + (plot_height / 5) * idx
        drawing.add(Line(left, y, left + plot_width, y, strokeColor=_color(BRAND_COLORS["grid"]), strokeWidth=0.7))

    for idx, label in enumerate(labels):
        center_x = left + slot_width * idx + slot_width / 2
        value = words[idx]
        bar_height = (value / max_words) * (plot_height - 4)
        bar_x = center_x - bar_width / 2
        drawing.add(
            Rect(
                bar_x,
                bottom,
                bar_width,
                bar_height,
                fillColor=_color(BRAND_COLORS["red"]),
                strokeColor=_color(BRAND_COLORS["red"]),
                rx=2,
                ry=2,
            )
        )
        if value > 0:
            drawing.add(
                String(
                    center_x,
                    bottom + bar_height + 5,
                    str(value),
                    textAnchor="middle",
                    fontName="Helvetica",
                    fontSize=7.5,
                    fillColor=_color(BRAND_COLORS["text"]),
                )
            )
        drawing.add(
            String(
                center_x,
                12,
                label,
                textAnchor="middle",
                fontName="Helvetica",
                fontSize=8,
                fillColor=_color(BRAND_COLORS["text"]),
            )
        )
    return drawing


def _draw_language_bar_chart(drawing: Drawing, x: float, y: float, width: float, height: float, labels: list[str], values: list[int], title: str, fill_color: str):
    drawing.add(String(x, y + height + 10, title, fontName="Helvetica-Bold", fontSize=11, fillColor=_color(BRAND_COLORS["text"])))
    max_value = max(1, int(_safe_max(values, 1)))
    row_height = height / max(1, len(labels))
    for idx, label in enumerate(labels):
        row_y = y + height - ((idx + 1) * row_height) + 6
        drawing.add(String(x, row_y + 3, label, fontName="Helvetica", fontSize=8, fillColor=_color(BRAND_COLORS["text"])))
        bar_x = x + 110
        bar_max_width = width - 150
        bar_width = (values[idx] / max_value) * bar_max_width if max_value else 0
        drawing.add(Rect(bar_x, row_y, bar_width, 10, fillColor=_color(fill_color), strokeColor=_color(fill_color), rx=2, ry=2))
        drawing.add(String(bar_x + bar_width + 6, row_y + 2, str(values[idx]), fontName="Helvetica", fontSize=8, fillColor=_color(BRAND_COLORS["text"])))


def chart_language_kpis(df, width: float = 738, height: float = 420) -> Drawing:
    drawing = Drawing(width, height)
    lang_df = df.copy()
    lang_df["brontaal"] = (
        lang_df["brontaal"]
        .fillna("(onbekend)")
        .astype(str)
        .str.strip()
        .replace("", "(onbekend)")
    )
    lang_df["aantal_vertaalde_woorden"] = lang_df["aantal_vertaalde_woorden"].fillna(0).astype(int)

    counts = lang_df.groupby("brontaal", dropna=False)["id"].count().sort_values(ascending=False).head(6)
    words = (
        lang_df.groupby("brontaal", dropna=False)["aantal_vertaalde_woorden"]
        .sum()
        .sort_values(ascending=False)
        .head(6)
    )

    count_labels = counts.index.tolist() or ["Geen data"]
    count_values = [int(value) for value in counts.values.tolist()] or [0]
    word_labels = words.index.tolist() or ["Geen data"]
    word_values = [int(value) for value in words.values.tolist()] or [0]

    _draw_language_bar_chart(
        drawing,
        x=18,
        y=220,
        width=width - 36,
        height=150,
        labels=count_labels,
        values=count_values,
        title="Aantal opdrachten per brontaal",
        fill_color=BRAND_COLORS["navy"],
    )
    _draw_language_bar_chart(
        drawing,
        x=18,
        y=24,
        width=width - 36,
        height=150,
        labels=word_labels,
        values=word_values,
        title="Aantal vertaalde woorden per brontaal",
        fill_color=BRAND_COLORS["red"],
    )
    return drawing
