"""Nesting the flat documents back into a tree, without a database."""

from bson import ObjectId

from app.services.seed import load_seed
from app.services.tree import build_tree


def make_docs(subject: str = "POLITY") -> list[dict]:
    """Fake what Mongo would return for one subject, from the real seed."""
    flat = [node for node in load_seed() if node.subject == subject]
    ids = {node.seed_key: ObjectId() for node in flat}
    return [
        {
            "_id": ids[node.seed_key],
            "subject": node.subject,
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


def nested_docs() -> list[dict]:
    """A hand-built section/topic/leaf chain.

    The seed is one flat level now, so the nesting behaviour — which still has
    to hold for custom nodes the user adds under a topic — needs its own
    fixture rather than borrowing whatever shape the seed happens to have.
    """
    ids = [ObjectId() for _ in range(4)]
    shape = [
        (ids[0], None, "Section", 1, 0),
        (ids[1], ids[0], "Topic A", 2, 0),
        (ids[2], ids[1], "Leaf A1", 3, 0),
        (ids[3], ids[0], "Topic B", 2, 1),
    ]
    return [
        {
            "_id": node_id,
            "subject": "POLITY",
            "parent_id": parent,
            "title": title,
            "level": level,
            "order": order,
            "path": f"POLITY/{title}",
            "seed_key": None,
            "pyq_weight": "medium",
            "needs_diagram": False,
            "is_custom": True,
            "is_archived": False,
            "notes": "",
            "gs_linkage": [],
        }
        for node_id, parent, title, level, order in shape
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


def test_a_flat_subject_comes_back_as_roots_with_no_children():
    tree = build_tree(make_docs())
    assert len(tree) == len(make_docs())
    assert all(not node.children for node in tree)


def test_children_hang_off_the_right_parent():
    tree = build_tree(nested_docs())
    for section in tree:
        for topic in section.children:
            assert topic.parent_id == section.id
            assert topic.level == 2
            for leaf in topic.children:
                assert leaf.parent_id == topic.id
                assert leaf.level == 3


def test_siblings_keep_seed_order():
    tree = build_tree(nested_docs())
    for section in tree:
        orders = [child.order for child in section.children]
        assert orders == sorted(orders)


def test_orphans_surface_as_roots_rather_than_vanishing():
    docs = nested_docs()
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
