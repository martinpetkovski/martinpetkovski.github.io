#!/usr/bin/env python3
"""Aggregate the game-state benchmark and generate publication SVGs."""

from __future__ import annotations

import csv
import math
import statistics
import sys
from collections import defaultdict
from pathlib import Path


GROUP_FIELDS = (
    "algorithm", "workload", "variant", "phase", "entities",
    "change_percent", "work_rounds",
)
FLOAT_FIELDS = (
    "mean_ns", "median_ns", "p95_ns", "p99_ns", "maximum_ns",
    "throughput_per_s", "cycles_per_tick",
)
INT_FIELDS = (
    "entities", "change_percent", "work_rounds", "repetition", "samples",
    "changed_entities", "arithmetic_per_tick", "recomputed_entities",
    "miss_100us", "miss_1ms", "miss_16_67ms", "persistent_bytes",
    "temporary_bytes", "event_bytes", "working_bytes", "source_call_depth",
)


def load_rows(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    for row in rows:
        for field in INT_FIELDS:
            row[field] = int(row[field])
        for field in FLOAT_FIELDS:
            row[field] = float(row[field])
    return rows


def t_critical_95(df: int) -> float:
    values = {
        1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
        6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
        11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131,
        16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
        25: 2.060, 30: 2.042,
    }
    if df in values:
        return values[df]
    if df < 25:
        return 2.086
    if df < 30:
        return 2.060
    return 1.960


def aggregate(rows: list[dict]) -> list[dict]:
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for row in rows:
        groups[tuple(row[field] for field in GROUP_FIELDS)].append(row)
    output = []
    for key, values in sorted(groups.items()):
        means = [row["mean_ns"] for row in values]
        mean = statistics.fmean(means)
        if len(means) > 1:
            margin = (t_critical_95(len(means) - 1) *
                      statistics.stdev(means) / math.sqrt(len(means)))
        else:
            margin = 0.0
        total_samples = sum(row["samples"] for row in values)
        item = dict(zip(GROUP_FIELDS, key))
        item.update({
            "repetitions": len(values),
            "total_samples": total_samples,
            "mean_ns": mean,
            "mean_ci95_low_ns": max(0.0, mean - margin),
            "mean_ci95_high_ns": mean + margin,
            "median_ns": statistics.median(row["median_ns"] for row in values),
            "p95_ns": statistics.median(row["p95_ns"] for row in values),
            "p99_ns": statistics.median(row["p99_ns"] for row in values),
            "maximum_ns": max(row["maximum_ns"] for row in values),
            "throughput_per_s": statistics.median(
                row["throughput_per_s"] for row in values),
            "cycles_per_tick": statistics.median(
                row["cycles_per_tick"] for row in values),
            "miss_100us_pct": 100.0 * sum(row["miss_100us"] for row in values) /
                              total_samples,
            "miss_1ms_pct": 100.0 * sum(row["miss_1ms"] for row in values) /
                            total_samples,
            "miss_16_67ms_pct":
                100.0 * sum(row["miss_16_67ms"] for row in values) /
                total_samples,
            "changed_entities": values[0]["changed_entities"],
            "arithmetic_per_tick": values[0]["arithmetic_per_tick"],
            "vector_multiplies_per_tick":
                values[0]["arithmetic_per_tick"] // 6,
            "vector_adds_per_tick":
                values[0]["arithmetic_per_tick"] // 6,
            "persistent_bytes": values[0]["persistent_bytes"],
            "temporary_bytes": values[0]["temporary_bytes"],
            "event_bytes": values[0]["event_bytes"],
            "working_bytes": values[0]["working_bytes"],
            "source_call_depth": values[0]["source_call_depth"],
            "checksum_consistent":
                int(len({row["checksum"] for row in values}) == 1),
        })
        output.append(item)
    return output


def add_comparisons(summaries: list[dict]) -> list[dict]:
    baselines = {}
    for row in summaries:
        key = (row["algorithm"], row["workload"], row["phase"],
               row["entities"], row["change_percent"], row["work_rounds"])
        if row["variant"] == "stateful_event":
            baselines[key] = row
    output = []
    for row in summaries:
        key = (row["algorithm"], row["workload"], row["phase"],
               row["entities"], row["change_percent"], row["work_rounds"])
        base = baselines[key]
        enriched = dict(row)
        enriched["mean_ratio_to_stateful"] = (
            row["mean_ns"] / base["mean_ns"] if base["mean_ns"] else math.inf)
        enriched["p99_increment_over_stateful_ns"] = (
            row["p99_ns"] - base["p99_ns"])
        enriched["working_memory_ratio_to_stateful"] = (
            row["working_bytes"] / base["working_bytes"]
            if base["working_bytes"] else math.inf)
        output.append(enriched)
    return output


def write_csv(path: Path, rows: list[dict]) -> None:
    if not rows:
        return
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def escape(value: str) -> str:
    return (value.replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;"))


def svg_line_plot(path: Path, title: str,
                  series: dict[str, list[tuple[float, float]]],
                  x_label: str, y_label: str,
                  log_x: bool = False, log_y: bool = False,
                  threshold: float | None = None) -> None:
    width, height = 900, 520
    left, right, top, bottom = 100, 30, 60, 80
    plot_w, plot_h = width - left - right, height - top - bottom
    colors = ["#2563eb", "#dc2626", "#16a34a", "#9333ea"]
    points = [(x, y) for values in series.values() for x, y in values]
    xs = [math.log10(x) if log_x else x for x, _ in points]
    ys = [math.log10(max(y, 1.0)) if log_y else y for _, y in points]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    if threshold is not None:
        transformed = math.log10(threshold) if log_y else threshold
        y_min, y_max = min(y_min, transformed), max(y_max, transformed)
    if x_min == x_max:
        x_max += 1.0
    if y_min == y_max:
        y_max += 1.0
    padding = (y_max - y_min) * 0.08
    y_min -= padding
    y_max += padding

    def xp(value: float) -> float:
        transformed = math.log10(value) if log_x else value
        return left + plot_w * (transformed - x_min) / (x_max - x_min)

    def yp(value: float) -> float:
        transformed = math.log10(max(value, 1.0)) if log_y else value
        return top + plot_h * (1.0 - (transformed - y_min) / (y_max - y_min))

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">',
        '<style>text{font-family:Arial,sans-serif;fill:#222}.grid{stroke:#ddd}'
        '.axis{stroke:#222;stroke-width:1.5}.line{fill:none;stroke-width:2.5}'
        '.point{stroke:white;stroke-width:1}</style>',
        f'<rect width="{width}" height="{height}" fill="white"/>',
        f'<text x="{width/2}" y="30" text-anchor="middle" font-size="19">'
        f'{escape(title)}</text>',
    ]
    for tick in range(6):
        y = top + plot_h * tick / 5
        raw = y_max - (y_max - y_min) * tick / 5
        label = 10 ** raw if log_y else raw
        parts.append(f'<line class="grid" x1="{left}" y1="{y:.1f}" '
                     f'x2="{left+plot_w}" y2="{y:.1f}"/>')
        parts.append(f'<text x="{left-10}" y="{y+4:.1f}" text-anchor="end" '
                     f'font-size="12">{label:.3g}</text>')
    unique_x = sorted({x for x, _ in points})
    for value in unique_x:
        parts.append(f'<text x="{xp(value):.1f}" y="{top+plot_h+24}" '
                     f'text-anchor="middle" font-size="11">{value:g}</text>')
    parts.extend([
        f'<line class="axis" x1="{left}" y1="{top}" x2="{left}" y2="{top+plot_h}"/>',
        f'<line class="axis" x1="{left}" y1="{top+plot_h}" '
        f'x2="{left+plot_w}" y2="{top+plot_h}"/>',
        f'<text x="{left+plot_w/2}" y="{height-24}" text-anchor="middle" '
        f'font-size="14">{escape(x_label)}{" (log scale)" if log_x else ""}</text>',
        f'<text x="22" y="{top+plot_h/2}" transform="rotate(-90 22 {top+plot_h/2})" '
        f'text-anchor="middle" font-size="14">{escape(y_label)}'
        f'{" (log scale)" if log_y else ""}</text>',
    ])
    if threshold is not None:
        y = yp(threshold)
        parts.append(f'<line x1="{left}" y1="{y:.1f}" x2="{left+plot_w}" '
                     f'y2="{y:.1f}" stroke="#111" stroke-dasharray="7 5"/>')
        parts.append(f'<text x="{left+plot_w-4}" y="{y-7:.1f}" '
                     f'text-anchor="end" font-size="12">1 ms proxy</text>')
    for index, (name, values) in enumerate(series.items()):
        color = colors[index % len(colors)]
        values = sorted(values)
        coordinates = " ".join(f"{xp(x):.1f},{yp(y):.1f}" for x, y in values)
        parts.append(f'<polyline class="line" stroke="{color}" points="{coordinates}"/>')
        for x, y in values:
            parts.append(f'<circle class="point" fill="{color}" '
                         f'cx="{xp(x):.1f}" cy="{yp(y):.1f}" r="4"/>')
        legend_y = top + 18 + index * 21
        parts.append(f'<line x1="{left+12}" y1="{legend_y-4}" '
                     f'x2="{left+36}" y2="{legend_y-4}" stroke="{color}" '
                     f'stroke-width="3"/>')
        parts.append(f'<text x="{left+43}" y="{legend_y}" font-size="12">'
                     f'{escape(name)}</text>')
    parts.append("</svg>")
    path.write_text("\n".join(parts), encoding="utf-8")


def generate_graphs(directory: Path, rows: list[dict]) -> None:
    density = [row for row in rows
               if row["workload"] == "change_density"
               and row["entities"] == 4096
               and row["phase"] == "frame_total"]
    series: dict[str, list[tuple[float, float]]] = defaultdict(list)
    for row in density:
        series[row["variant"]].append(
            (row["change_percent"], row["mean_ns"] / 1000.0))
    svg_line_plot(directory / "change-density-frame-total.svg",
                  "4,096 game entities: total frame work",
                  dict(series), "Entities changed per frame (%)",
                  "Mean time (microseconds)")

    tick = [row for row in rows
            if row["workload"] == "change_density"
            and row["entities"] == 4096 and row["phase"] == "tick_only"]
    series = defaultdict(list)
    for row in tick:
        series[row["variant"]].append(
            (row["change_percent"], row["p99_ns"] / 1000.0))
    svg_line_plot(directory / "change-density-tick-p99.svg",
                  "4,096 game entities: critical Tick tail",
                  dict(series), "Entities changed per frame (%)",
                  "p99 time (microseconds)")

    calibration = [row for row in rows
                   if row["workload"] == "arithmetic_calibration"
                   and row["phase"] == "frame_total"]
    series = defaultdict(list)
    for row in calibration:
        series[row["variant"]].append(
            (row["arithmetic_per_tick"], row["p99_ns"]))
    svg_line_plot(directory / "arithmetic-calibration-total-p99.svg",
                  "Arithmetic intensity and the 1 ms frame-work proxy",
                  dict(series), "Scalar arithmetic calculations per Tick",
                  "p99 time (ns)", log_x=True, log_y=True,
                  threshold=1_000_000.0)

    calibration_tick = [row for row in rows
                        if row["workload"] == "arithmetic_calibration"
                        and row["phase"] == "tick_only"]
    series = defaultdict(list)
    for row in calibration_tick:
        series[row["variant"]].append(
            (row["arithmetic_per_tick"], row["p99_ns"]))
    svg_line_plot(directory / "arithmetic-calibration-tick-p99.svg",
                  "Arithmetic intensity and critical-Tick placement",
                  dict(series), "Scalar arithmetic calculations per frame",
                  "p99 Tick time (ns)", log_x=True, log_y=True,
                  threshold=1_000_000.0)

    memory = [row for row in rows
              if row["workload"] == "change_density"
              and row["entities"] == 4096
              and row["phase"] == "frame_total"]
    series = defaultdict(list)
    for row in memory:
        series[row["variant"]].append(
            (row["change_percent"], row["working_bytes"] / 1024.0))
    svg_line_plot(directory / "working-memory-4096.svg",
                  "4,096 game entities: allocated working memory",
                  dict(series), "Entities changed per frame (%)",
                  "Working memory (KiB)")


def write_noticeable(path: Path, rows: list[dict]) -> None:
    selected = [row for row in rows
                if row["workload"] == "arithmetic_calibration"]
    baselines = {(row["phase"], row["work_rounds"]): row for row in selected
                 if row["variant"] == "stateful_event"}
    output = []
    for row in selected:
        base = baselines[(row["phase"], row["work_rounds"])]
        item = {
            "variant": row["variant"],
            "phase": row["phase"],
            "work_rounds": row["work_rounds"],
            "entities": row["entities"],
            "vec3_multiplies": row["vector_multiplies_per_tick"],
            "vec3_adds": row["vector_adds_per_tick"],
            "scalar_arithmetic": row["arithmetic_per_tick"],
            "p99_ns": row["p99_ns"],
            "p99_increment_over_stateful_ns":
                row["p99_ns"] - base["p99_ns"],
            "crosses_absolute_1ms_p99": int(row["p99_ns"] >= 1_000_000),
            "crosses_added_1ms_p99":
                int(row["p99_ns"] - base["p99_ns"] >= 1_000_000),
        }
        output.append(item)
    write_csv(path, output)


def write_report(path: Path, rows: list[dict]) -> None:
    density = [row for row in rows
               if row["workload"] == "change_density"
               and row["entities"] == 4096
               and row["phase"] == "frame_total"]
    calibration = [row for row in rows
                   if row["workload"] == "arithmetic_calibration"
                   and row["phase"] == "frame_total"]
    lines = [
        "# Generated game benchmark summary", "",
        "The 1 ms line is an engineering proxy for a material subsystem spike, "
        "not a universal human-perception threshold.", "",
        "## Change density at 4,096 entities and 16 vector rounds", "",
        "| Changed | Model | Mean us | p99 us | Max us | Scalar arithmetic | Working KiB |",
        "|---:|---|---:|---:|---:|---:|---:|",
    ]
    for row in density:
        lines.append(
            f'| {row["change_percent"]}% | {row["variant"]} | '
            f'{row["mean_ns"]/1000:.3f} | {row["p99_ns"]/1000:.3f} | '
            f'{row["maximum_ns"]/1000:.3f} | {row["arithmetic_per_tick"]} | '
            f'{row["working_bytes"]/1024:.1f} |')
    lines.extend([
        "", "## Total-frame arithmetic calibration at 4,096 entities and 100% change", "",
        "| Rounds | Model | Vec3 multiplies | Vec3 adds | Scalar arithmetic | "
        "Mean us | p99 us | Max us |",
        "|---:|---|---:|---:|---:|---:|---:|---:|",
    ])
    for row in calibration:
        lines.append(
            f'| {row["work_rounds"]} | {row["variant"]} | '
            f'{row["vector_multiplies_per_tick"]} | '
            f'{row["vector_adds_per_tick"]} | {row["arithmetic_per_tick"]} | '
            f'{row["mean_ns"]/1000:.3f} | {row["p99_ns"]/1000:.3f} | '
            f'{row["maximum_ns"]/1000:.3f} |')
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: analyze.py RAW.csv OUTPUT_DIRECTORY", file=sys.stderr)
        return 2
    raw_path = Path(sys.argv[1])
    output_directory = Path(sys.argv[2])
    output_directory.mkdir(parents=True, exist_ok=True)
    summaries = add_comparisons(aggregate(load_rows(raw_path)))
    write_csv(output_directory / "summary.csv", summaries)
    write_noticeable(output_directory / "noticeable-threshold.csv", summaries)
    generate_graphs(output_directory, summaries)
    write_report(output_directory / "summary.md", summaries)
    print(f"Wrote {len(summaries)} aggregate rows and five SVG figures "
          f"to {output_directory}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
