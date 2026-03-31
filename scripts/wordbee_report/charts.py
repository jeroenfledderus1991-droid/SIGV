from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

from wordbee_report.branding import BRAND_COLORS


def chart_jobs_and_late(stats: pd.DataFrame, output_path: Path) -> None:
    fig, ax1 = plt.subplots(figsize=(13.4, 4.2))
    ax2 = ax1.twinx()
    x_labels = [m[:3] for m in stats["maand"]]
    x_positions = list(range(len(x_labels)))
    reliability_values = stats["leverbetrouwbaarheid_pct"].astype(float).where(
        stats["opdrachten"].astype(float) > 0,
        float("nan"),
    )
    bars = ax1.bar(
        x_positions,
        stats["opdrachten"],
        color=BRAND_COLORS["navy"],
        alpha=0.96,
        label="# opdrachten",
        width=0.62,
    )
    line, = ax2.plot(
        x_positions,
        reliability_values,
        color=BRAND_COLORS["red"],
        marker="o",
        linewidth=2.6,
        markersize=6.0,
        label="% leverbetrouwbaarheid",
    )

    ax1.set_xticks(x_positions, x_labels)
    ax1.set_ylabel("# opdrachten", color=BRAND_COLORS["text"])
    ax2.set_ylabel("% leverbetrouwbaarheid", color=BRAND_COLORS["text"])
    ax1.set_title(
        "Kwaliteit > Leverbetrouwbaarheid vertaalopdracht",
        color=BRAND_COLORS["text"],
        loc="left",
        pad=24,
        fontsize=15,
        fontweight="bold",
    )
    ax1.grid(axis="y", alpha=0.38, color=BRAND_COLORS["grid"], linestyle="--")
    ax1.set_axisbelow(True)
    ax2.set_ylim(bottom=0, top=104)
    ax1.spines["top"].set_visible(False)
    ax2.spines["top"].set_visible(False)
    ax1.spines["right"].set_visible(False)
    ax2.spines["left"].set_visible(False)
    ax1.spines["left"].set_color(BRAND_COLORS["grid"])
    ax1.spines["bottom"].set_color(BRAND_COLORS["grid"])
    ax2.spines["right"].set_color(BRAND_COLORS["grid"])
    ax1.tick_params(axis="x", labelrotation=0, colors=BRAND_COLORS["text"], pad=6)
    ax1.tick_params(axis="y", colors=BRAND_COLORS["text"])
    ax2.tick_params(axis="y", colors=BRAND_COLORS["text"])

    for rect in bars:
        value = int(rect.get_height())
        if value <= 0:
            continue
        y_position = max(0.6, rect.get_height() - max(1.2, rect.get_height() * 0.15))
        ax1.annotate(
            f"{value}",
            xy=(rect.get_x() + rect.get_width() / 2, y_position),
            ha="center",
            va="center",
            fontsize=8.5,
            color="#FFFFFF",
            fontweight="bold",
        )

    for x_pos, pct_value in zip(x_positions, reliability_values):
        if pd.isna(pct_value) or float(pct_value) <= 0:
            continue
        ax2.annotate(
            f"{pct_value:.1f}%",
            xy=(x_pos, pct_value),
            xytext=(0, 6),
            textcoords="offset points",
            ha="center",
            va="bottom",
            fontsize=8,
            color=BRAND_COLORS["red"],
            fontweight="bold",
            clip_on=False,
        )

    legend = ax1.legend(
        [bars, line],
        ["# vertaalopdrachten", "% leverbetrouwbaarheid"],
        loc="upper right",
        bbox_to_anchor=(0.985, 1.11),
        frameon=True,
        ncol=2,
        fontsize=8.5,
        borderpad=0.5,
    )
    legend.get_frame().set_facecolor("#FFFFFF")
    legend.get_frame().set_edgecolor(BRAND_COLORS["grid"])
    fig.tight_layout(rect=(0, 0, 1, 0.95))
    fig.savefig(output_path, dpi=150)
    plt.close(fig)


def chart_words_per_month(stats: pd.DataFrame, output_path: Path) -> None:
    fig, ax = plt.subplots(figsize=(13.4, 4.2))
    x_labels = [m[:3] for m in stats["maand"]]
    x_positions = list(range(len(x_labels)))
    bars = ax.bar(x_positions, stats["woorden"], color=BRAND_COLORS["red"], alpha=0.92, width=0.62)
    ax.set_xticks(x_positions, x_labels)
    ax.set_ylabel("Aantal woorden", color=BRAND_COLORS["text"])
    ax.set_title(
        "Aantal vertaalde woorden per maand",
        color=BRAND_COLORS["text"],
        loc="left",
        pad=10,
        fontsize=15,
        fontweight="bold",
    )
    ax.grid(axis="y", alpha=0.38, color=BRAND_COLORS["grid"], linestyle="--")
    ax.set_axisbelow(True)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(BRAND_COLORS["grid"])
    ax.spines["bottom"].set_color(BRAND_COLORS["grid"])
    ax.tick_params(axis="x", labelrotation=0, colors=BRAND_COLORS["text"], pad=6)
    ax.tick_params(axis="y", colors=BRAND_COLORS["text"])
    for rect in bars:
        value = int(rect.get_height())
        if value <= 0:
            continue
        ax.annotate(
            f"{value}",
            xy=(rect.get_x() + rect.get_width() / 2, rect.get_height()),
            xytext=(0, 5),
            textcoords="offset points",
            ha="center",
            va="bottom",
            fontsize=8,
            color=BRAND_COLORS["text"],
        )
    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.close(fig)


def chart_language_kpis(df: pd.DataFrame, output_path: Path) -> None:
    lang_df = df.copy()
    lang_df["brontaal"] = (
        lang_df["brontaal"]
        .fillna("(onbekend)")
        .astype(str)
        .str.strip()
        .replace("", "(onbekend)")
    )
    lang_df["aantal_vertaalde_woorden"] = pd.to_numeric(
        lang_df["aantal_vertaalde_woorden"], errors="coerce"
    ).fillna(0)

    counts = lang_df.groupby("brontaal", dropna=False)["id"].count().sort_values(ascending=False).head(6)
    words = (
        lang_df.groupby("brontaal", dropna=False)["aantal_vertaalde_woorden"]
        .sum()
        .sort_values(ascending=False)
        .head(6)
    )

    if counts.empty:
        counts = pd.Series([0], index=["Geen data"])
    if words.empty:
        words = pd.Series([0], index=["Geen data"])

    word_order = [name for name in counts.index if name in words.index]
    word_order += [name for name in words.index if name not in word_order]
    words = words.reindex(word_order).fillna(0)

    fig, axes = plt.subplots(nrows=2, ncols=1, figsize=(13.4, 7.6))
    labels_counts = counts.index.tolist()
    x_counts = list(range(len(labels_counts)))
    bars_counts = axes[0].bar(x_counts, counts.values, color=BRAND_COLORS["navy"], alpha=0.94, width=0.62)
    axes[0].set_xticks(x_counts, labels_counts)
    axes[0].set_title(
        "Aantal opdrachten per brontaal",
        color=BRAND_COLORS["text"],
        loc="left",
        pad=8,
        fontsize=14,
        fontweight="bold",
    )
    axes[0].grid(axis="y", alpha=0.35, color=BRAND_COLORS["grid"])
    axes[0].set_axisbelow(True)
    axes[0].spines["top"].set_visible(False)
    axes[0].spines["right"].set_visible(False)
    axes[0].spines["left"].set_color(BRAND_COLORS["grid"])
    axes[0].spines["bottom"].set_color(BRAND_COLORS["grid"])
    axes[0].tick_params(axis="x", labelrotation=0, colors=BRAND_COLORS["text"])
    axes[0].tick_params(axis="y", colors=BRAND_COLORS["text"])
    for rect in bars_counts:
        value = int(rect.get_height())
        axes[0].annotate(
            f"{value}",
            xy=(rect.get_x() + rect.get_width() / 2, rect.get_height()),
            xytext=(0, 4),
            textcoords="offset points",
            ha="center",
            va="bottom",
            fontsize=8,
            color=BRAND_COLORS["text"],
        )

    labels_words = words.index.tolist()
    x_words = list(range(len(labels_words)))
    bars_words = axes[1].bar(x_words, words.values, color=BRAND_COLORS["red"], alpha=0.94, width=0.62)
    axes[1].set_xticks(x_words, labels_words)
    axes[1].set_title(
        "Aantal vertaalde woorden per brontaal",
        color=BRAND_COLORS["text"],
        loc="left",
        pad=8,
        fontsize=14,
        fontweight="bold",
    )
    axes[1].grid(axis="y", alpha=0.35, color=BRAND_COLORS["grid"])
    axes[1].set_axisbelow(True)
    axes[1].spines["top"].set_visible(False)
    axes[1].spines["right"].set_visible(False)
    axes[1].spines["left"].set_color(BRAND_COLORS["grid"])
    axes[1].spines["bottom"].set_color(BRAND_COLORS["grid"])
    axes[1].tick_params(axis="x", labelrotation=0, colors=BRAND_COLORS["text"])
    axes[1].tick_params(axis="y", colors=BRAND_COLORS["text"])
    for rect in bars_words:
        value = int(rect.get_height())
        axes[1].annotate(
            f"{value}",
            xy=(rect.get_x() + rect.get_width() / 2, rect.get_height()),
            xytext=(0, 4),
            textcoords="offset points",
            ha="center",
            va="bottom",
            fontsize=8,
            color=BRAND_COLORS["text"],
        )

    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.close(fig)
