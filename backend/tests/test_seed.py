"""The seed files are content, so the tests here guard their shape."""

from collections import Counter

import pytest

from app.models.common import Subject, PyqWeight
from app.services.seed import load_seed, slugify


@pytest.fixture(scope="module")
def flat():
    return load_seed()


def test_every_subject_is_seeded(flat):
    seeded = {node.subject for node in flat}
    assert seeded == {p.value for p in Subject}


def test_seed_keys_are_unique_within_a_subject(flat):
    counts = Counter((node.subject, node.seed_key) for node in flat)
    assert [key for key, n in counts.items() if n > 1] == []


def test_levels_are_well_formed(flat):
    for node in flat:
        assert 1 <= node.level <= 3
        # Only a level-1 node may be parentless.
        assert (node.parent_key is None) == (node.level == 1)


def test_the_seed_is_one_flat_level_of_topics(flat):
    """Subjects hold topics and nothing under them — that is the whole model."""
    assert {node.level for node in flat} == {1}


def test_seed_key_is_the_slug_chain(flat):
    for node in flat:
        assert node.seed_key.endswith(slugify(node.title))
        if node.parent_key:
            assert node.seed_key.startswith(f"{node.parent_key}/")


def test_path_starts_with_the_subject(flat):
    for node in flat:
        assert node.path.startswith(f"{node.subject}/")


def test_weights_are_valid(flat):
    valid = {w.value for w in PyqWeight}
    assert {node.pyq_weight for node in flat} <= valid


def test_every_subject_has_the_topic_count_it_was_specified_with(flat):
    """The counts are the specification, so a miscount is a content bug."""
    counted = Counter(node.subject for node in flat)
    assert counted == {
        "ANCIENT_MEDIEVAL": 42,
        "MODERN_HISTORY": 49,  # Spectrum chapters 1-49
        "GEOGRAPHY": 48,
        "ECONOMICS": 30,  # Singhania 1-29 plus the merged "30 & 31"
        "POLITY": 65,
        "SCIENCE": 31,
        "CSAT": 10,  # placeholders until the Arihant contents land
        "DISASTER_MGMT": 4,
        "IR": 22,
        "SECURITY": 10,
        "WORLD_HISTORY": 12,
        "ETHICS": 24,
        "ANTHROPOLOGY": 90,
    }


def test_slugify_handles_punctuation_and_accents():
    assert slugify("Mauryan art — pillars, stupas") == "mauryan-art-pillars-stupas"
    assert slugify("Levi-Strauss") == "levi-strauss"
    assert slugify("!!!") == "node"
