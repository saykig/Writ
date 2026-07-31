# Build source acquisition and provenance

## Instruction

Implement connector interfaces and verification gates using the source registry. Start with the G7 site, one official source per member, one EU source, Federal Register, Regulations.gov, and one international organization. Store raw bytes and WARC metadata, then parse HTML and PDF into relocatable passage anchors. Add candidate extraction behind a review queue.

Acceptance: replay from stored bytes is network-free; every claim links to an immutable passage; changed pages create new versions; parser confidence and failures are visible; media-only discovery does not become accepted evidence automatically.

## Non-goals

Do not redesign settled ADRs without opening a replacement ADR. Do not add broad infrastructure that is not required by the acceptance criteria. Do not hide incomplete behavior behind mocks in production paths.
