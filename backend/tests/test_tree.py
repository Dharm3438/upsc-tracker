"""Nesting the flat documents back into a tree, without a database."""

from bson import ObjectId

from app.services.seed import load_seed
from app.services.tree import build_tree


def make_docs(paper: str = "GS2") -> list[dict]:
    """Fake what Mongo would return for one paper, from the real seed."""
    flat = [node for node in load_seed() if node.paper == paper]
    ids = {node.seed_key: ObjectId() for node in flat}
    return [
        {
            "_id": ids[node.seed_key],
            "paper": node.paper,
            "parent_id": ids[node.parent_key] if node.parent_key else None,
            "title": node.title,
            "level": node.level,
            "order": node.order,
            "path": node.path,
            "seed_key": node.seed_key,
            "pyq_weight": node.pyq_weight,
            "needs_diagram": node.needs_diagram,
            "is_custom": False,
            "is_archived": False,
            "notes": "",
            "gs_linkage": [],
        }
        for node in flat
    ]


def test_every_node_appears_exactly_once():
    docs = make_docs()

    def walk(nodes):
        for node in nodes:
            yield node
            yield from walk(node.children)

    tree = build_tree(docs)
    assert len({n.id for n in walk(tree)}) == len(docs)


def test_roots_are_the_level_one_sections():
    tree = build_tree(make_docs())
    assert {node.level for node in tree} == {1}


def test_children_hang_off_the_right_parent():
    tree = build_tree(make_docs())
    for section in tree:
        for topic in section.children:
            assert topic.parent_id == section.id
            assert topic.level == 2
            for leaf in topic.children:
                assert leaf.parent_id == topic.id
                assert leaf.level == 3


def test_siblings_keep_seed_order():
    tree = build_tree(make_docs())
    for section in tree:
        orders = [child.order for child in section.children]
        assert orders == sorted(orders)


def test_orphans_surface_as_roots_rather_than_vanishing():
    docs = make_docs()
    # Drop a level-1 section but keep its children, as an archive filter would.
    section = next(d for d in docs if d["level"] == 1)
    remaining = [d for d in docs if d["_id"] != section["_id"]]

    tree = build_tree(remaining)
    orphans = [node for node in tree if node.parent_id == str(section["_id"])]
    assert orphans, "children of a filtered-out parent must still be reachable"


def test_rollups_default_to_untouched():
    tree = build_tree(make_docs())
    assert tree[0].read_count == 0
    assert tree[0].revise_count == 0
    assert tree[0].mcq_accuracy is None
