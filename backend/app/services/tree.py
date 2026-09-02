"""Turn the flat node documents into the nested tree the UI renders.

Kept out of the router so it can be tested without a database: nesting and
ordering are where tree bugs actually live.
"""

from typing import Any

from app.models.syllabus import TreeNode

#: A topic counts as revised for the coverage figure at two revisions, not one.
#: Once is reading it again; twice is the start of actually retaining it.
REVISED_THRESHOLD = 2


def build_tree(
    docs: list[dict[str, Any]],
    stats: dict[str, dict[str, Any]] | None = None,
) -> list[TreeNode]:
    """Nest documents by `parent_id`, sorted by `order` then title.

    Nodes whose parent is missing from `docs` — an archived parent, say — are
    returned as roots rather than dropped, so nothing disappears silently.

    `stats` carries each node's own log-derived counts; the subtree totals a
    section row needs are summed here, on the way back up.
    """
    stats = stats or {}
    nodes: dict[str, TreeNode] = {}
    for doc in docs:
        node_id = str(doc["_id"])
        nodes[node_id] = TreeNode(**doc, **stats.get(node_id, {}))

    roots: list[TreeNode] = []
    for doc in docs:
        node = nodes[str(doc["_id"])]
        parent = nodes.get(str(doc.get("parent_id"))) if doc.get("parent_id") else None
        if parent is None:
            roots.append(node)
        else:
            parent.children.append(node)

    def sort_level(items: list[TreeNode]) -> None:
        items.sort(key=lambda n: (n.order, n.title))
        for item in items:
            sort_level(item.children)

    sort_level(roots)
    for root in roots:
        _roll_up(root)
    return roots


def _roll_up(node: TreeNode) -> None:
    """Sum leaf coverage into every ancestor, depth first.

    A section's progress is the share of its leaves that have been touched, not
    an average of percentages — otherwise a section with one small finished
    subtopic and one huge untouched one reads as half done.
    """
    if not node.children:
        node.leaf_count = 1
        node.leaf_started = 1 if (node.read_count or node.revise_count) else 0
        node.leaf_revised = 1 if node.revise_count >= REVISED_THRESHOLD else 0
        return

    for child in node.children:
        _roll_up(child)

    node.leaf_count = sum(child.leaf_count for child in node.children)
    node.leaf_started = sum(child.leaf_started for child in node.children)
    node.leaf_revised = sum(child.leaf_revised for child in node.children)
