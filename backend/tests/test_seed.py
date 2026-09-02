"""The seed files are content, so the tests here guard their shape."""

from collections import Counter

import pytest

from app.models.common import Paper, PyqWeight
from app.services.seed import load_seed, slugify


@pytest.fixture(scope="module")
def flat():
    return load_seed()


def test_every_paper_is_seeded(flat):
    seeded = {node.paper for node in flat}
    assert seeded == {p.value for p in Paper}


def test_seed_keys_are_unique_within_a_paper(flat):
    counts = Counter((node.paper, node.seed_key) for node in flat)
    assert [key for key, n in counts.items() if n > 1] == []


def test_levels_are_well_formed(flat):
    for node in flat:
        assert 1 <= node.level <= 3
        # Only a level-1 node may be parentless.
        assert (node.parent_key is None) == (node.level == 1)


def test_seed_key_is_the_slug_chain(flat):
    for node in flat:
        assert node.seed_key.endswith(slugify(node.title))
        if node.parent_key:
            assert node.seed_key.startswith(f"{node.parent_key}/")


def test_path_starts_with_the_paper(flat):
    for node in flat:
        assert node.path.startswith(f"{node.paper}/")


def test_weights_are_valid(flat):
    valid = {w.value for w in PyqWeight}
    assert {node.pyq_weight for node in flat} <= valid


def test_seed_is_large_enough_to_be_useful(flat):
    leaves = [node for node in flat if node.level == 3]
    assert len(leaves) > 300


def test_slugify_handles_punctuation_and_accents():
    assert slugify("Mauryan art — pillars, stupas") == "mauryan-art-pillars-stupas"
    assert slugify("Levi-Strauss") == "levi-strauss"
    assert slugify("!!!") == "node"
