"""Regenerate `data/syllabus/*.json` from the lecture counts and the book contents.

    python scripts/build_syllabus_seed.py

Run this only when the syllabus itself changes — a corrected chapter list, a
different lecture count. It overwrites every seed file, so anything hand-edited
there is lost; the seeded topics are meant to be renamed in the app instead,
where the `seed_key` keeps the rename attached to the right row.

The two contents files under `data/sources/` are the user's own transcriptions
and are copied faithfully, typos included — this script does not correct them.
"""

import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "syllabus"
DOCS = ROOT / "data" / "sources"

# Words the caser must not touch or must fully upper-case. Anything short and
# shouted that is NOT listed here is an ordinary word ("EVE"), so the preserve
# list has to be explicit rather than a length heuristic.
ACRONYMS = {"ina", "inc", "upa", "nda", "msme"}
KEEP_AS_IS = {"II", "III", "IV"}
SMALL = {"a", "an", "and", "the", "of", "in", "on", "for", "to", "with", "before", "after",
         "against", "under", "versus", "at", "by", "from", "as", "into", "over"}


def title_case(text: str) -> str:
    """Spectrum's TOC is shouted; render it as a sentence a person would write.

    Works on runs of letters rather than whitespace-separated words, so a word
    wearing a bracket ("(JUNE") or sitting behind a hyphen ("1977-JANUARY")
    still gets its own capital.
    """

    def fix(match: re.Match[str]) -> str:
        word = match.group(0)
        low = word.lower()
        if low in ACRONYMS:
            return word.upper()
        if word in KEEP_AS_IS:
            return word
        # Opening the title, or opening a clause after a colon or a hyphen: a
        # small word is capitalised there even though it would not be mid-title.
        before = text[: match.start()].rstrip()
        leads = not before or before.endswith((":", "-"))
        if low in SMALL and not leads:
            return low
        return low[:1].upper() + low[1:]

    return re.sub(r"[A-Za-z][A-Za-z']*", fix, text)


def lectures(n: int) -> list[dict]:
    return [{"title": f"Lecture {i}"} for i in range(1, n + 1)]


def spectrum() -> list[dict]:
    """Chapters in reading order; the TOC's priority bands become PYQ weight."""
    weight = "medium"
    found: dict[int, tuple[str, str]] = {}
    for line in (DOCS / "Spectrum Table of Contents.txt").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        low = line.lower()
        if low.endswith("priority topics"):
            weight = low.split()[0]
            continue
        match = re.match(r"CHAPTER:\s*(\d+)\s*-\s*(.+)", line)
        if match:
            number, title = int(match.group(1)), match.group(2).strip()
            found[number] = (title_case(title), weight)
    return [
        {"title": f"Chapter {n} — {found[n][0]}", "pyq_weight": found[n][1]}
        for n in sorted(found)
    ]


def singhania() -> list[dict]:
    """The TOC's numbering is uneven — '6-', '9 ', '30 & 31' — so parse loosely.

    Chapter 12 is missing from the file the user supplied and is filled in here.
    """
    topics: list[tuple[str, str]] = []
    for line in (DOCS / "Nitin Singhania Economics.txt").read_text(encoding="utf-8").splitlines():
        line = line.strip().rstrip(":")
        # The number can be a merged pair ("30 & 31"), and the dash after it is
        # not always there ("Chapter 9 Money and Banking").
        match = re.match(r"Chapter\s*(\d+(?:\s*&\s*\d+)?)\s*[-–]?\s*(\D.*)", line)
        if not match:
            continue
        number = re.sub(r"\s+", " ", match.group(1)).strip()
        topics.append((number, match.group(2).strip()))
    topics.insert(11, ("12", "Co-operative Sector in India (New Chapter)"))
    return [{"title": f"Chapter {n} — {t}"} for n, t in topics]


def arihant() -> list[dict]:
    """Placeholders until the real Arihant TOC lands; the user renames in-app."""
    return [{"title": f"Chapter {i}"} for i in range(1, 11)]


SUBJECTS: dict[str, list[dict]] = {
    "ANCIENT_MEDIEVAL": lectures(42),
    "MODERN_HISTORY": spectrum(),
    "GEOGRAPHY": lectures(48),
    "ECONOMICS": singhania(),
    "POLITY": lectures(65),
    "SCIENCE": lectures(31),
    "CSAT": arihant(),
    "DISASTER_MGMT": lectures(4),
    "IR": lectures(22),
    "SECURITY": lectures(10),
    "WORLD_HISTORY": lectures(12),
    "ETHICS": lectures(24),
    "ANTHROPOLOGY": lectures(90),
}

if __name__ == "__main__":
    for old in OUT.glob("*.json"):
        old.unlink()
    for subject, topics in SUBJECTS.items():
        path = OUT / f"{subject.lower()}.json"
        path.write_text(
            json.dumps({"subject": subject, "topics": topics}, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"{subject}: {len(topics)} topics -> {path.name}")
