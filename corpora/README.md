# Active corpora

`corpora/` contains Writ's source-of-truth native corpora. The catalog at `corpora/catalog.yaml`
resolves stable corpus IDs to leaf paths and manifests; questions and topics do not determine
corpus identity.

The implemented families are:

- `legal-policy/<jurisdiction>/<issuing-authority>/<instrument-corpus>/` for legal instruments,
  policies, guidance, and dataset-backed legal collections;
- `institutional/<jurisdiction>/<root-institution>/` for atomic institutional facts.

Directories between a family/jurisdiction and a leaf corpus are organizational namespaces. Only
cataloged leaves are corpora. A legal-policy publication issued by NIST and an institutional fact
about NIST therefore live in different families and different source-of-truth files.

Legacy references may retain historical `ai-governance` strings, but no active corpus path or ID
uses that subject as its corpus boundary.
