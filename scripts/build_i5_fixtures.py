import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "frontend" / "tests" / "fixtures"
FIXTURES = (
    ("sgg_isolation_index.jsonl", "sgg_isolation_index_202512.jsonl",
     lambda row: row["month"] == "202512"),
    ("dong_isolation_index.jsonl", "dong_isolation_index_seoul_202512.jsonl",
     lambda row: row["month"] == "202512" and row["region_code"].startswith("11")),
)


def main(source_dir: Path, output_dir: Path = DEFAULT_OUTPUT) -> dict[str, int]:
    output_dir.mkdir(parents=True, exist_ok=True)
    counts = {}
    for source, target, keep in FIXTURES:
        with (source_dir / source).open(encoding="utf-8") as lines:
            rows = [line if line.endswith("\n") else line + "\n" for line in lines if line.strip() and keep(json.loads(line))]
        (output_dir / target).write_text("".join(rows), encoding="utf-8")
        counts[target] = len(rows)
        print(f"{target}: {len(rows)}")
    return counts


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        raise SystemExit("usage: build_i5_fixtures.py <i5_bundle_dir> [output_dir]")
    main(Path(sys.argv[1]), Path(sys.argv[2]) if len(sys.argv) == 3 else DEFAULT_OUTPUT)
