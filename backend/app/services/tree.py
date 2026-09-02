"""Turn the flat node documents into the nested tree the UI renders.

Kept out of the router so it can be tested without a database: nesting and
ordering are where tree bugs actually live.
"""

from typing import Any

from app.models.syllabus import TreeNode


def build_tree(docs: list[dict[str, Any]]) -> list[TreeNode]:
    """Nest documents by `parent_id`, sorted by `order` then title.

    Nodes whose parent is missing from `docs` — an archived parent, say — are
    returned as roots rather than dropped, so nothing disappears silently.
    """
    nodes = {str(doc["_id"]): TreeNode(**doc) for doc in docs}
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
    return roots
