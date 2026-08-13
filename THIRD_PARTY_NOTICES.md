# Third-party notices

This file records third-party and externally authored material associated with Writ. It is
informational and does not modify the Apache License 2.0. The Apache license covers original Writ
code and documentation contributed to this repository; it does not relicense the materials listed
below. Copyright and other rights remain with their respective owners.

## Political, legal, and research sources

Writ corpora contain source metadata, anchored excerpts, and source-reported judgments derived from
externally published laws, policies, standards, reports, and research. Their inclusion preserves
provenance and does not assert Writ ownership or grant reuse rights in the underlying material.
Users must consult each source publisher's current terms.

Known tracked source-document files include:

- `archive/compatibility/g7/2025-ai-sme/sources/g7-2025-ai-sme-chapter.pdf`, published by the G7
  Research Group;
- `archive/compatibility/g20/2024-rio/sources/2024-g20-compliance-final-excerpt.pdf` and
  `2024-g20-compliance-interim-excerpt.pdf`, published by the G20 Research Group.

The EU and US jurisdictional corpora and the archived EU-US pilot also preserve passages or metadata
from the Publications Office of the European Union, the United States Office of Management and
Budget, the National Institute of Standards and Technology, and the White House. The repository does
not contain a separate license grant from those publishers for the source texts. The archived
deep-research report contains citations and excerpts whose reuse remains subject to the original
sources.

Published G7 and G20 ratings and judgments are source-reported data. Their representation in Writ
does not transfer ownership or relicense the publishers' reports or analytical judgments.

## Software dependencies and copied components

JavaScript and Python dependencies are not relicensed under Apache-2.0. Their own license files and
package metadata govern them; exact JavaScript versions are recorded in `bun.lock`, while Python
requirements are declared in `apps/ingest/pyproject.toml` and resolved at installation time.

Items requiring particular attention when distributing Writ or bundled artifacts include:

- PyMuPDF, a direct Python dependency, declares a choice of GNU Affero General Public License 3.0
  or an Artifex commercial license;
- Psycopg and its binary and pool packages declare LGPL-3.0-only;
- JavaScript packages recorded in `bun.lock` retain their upstream licenses and notices.

These dependencies do not change the license of original Writ source files, but a distributed
combined application may carry additional source, notice, attribution, or commercial-license
obligations. Dependency licenses must be reviewed again against the resolved versions before a
release.
