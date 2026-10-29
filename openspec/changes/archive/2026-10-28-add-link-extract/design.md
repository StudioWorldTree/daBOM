# Design — add-link-extract

## Which URLs

The steer left this open. The refinement that stays inside the current skill: a selected line contributes every markdown link target and every bare `http`/`https` URL written on that line. The document path is already `source`. These URLs are additional `sources` entries on the node.

`plain()` may still strip a link out of the part name. The URL has to be captured before that, onto `sources`, not left inside the name.

A line with two URLs contributes both. That is not the two-MPN case. A part number is identity. A URL is a citation.

A URL under a heading the selection did not pick is not a candidate for this tree.

The tree file is the review. Deleting an entry there is the hand-picked list. The POST script sends the file it was given.

The skill does not call POST `/sources`. `add-ingest-evidence` stores the array.
