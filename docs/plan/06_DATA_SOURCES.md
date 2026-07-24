# Data Sources and Source Registry

## 1. Principle

Evidence collection must be driven by a versioned source registry, not ad hoc search alone. The registry says which sources exist, what they are authoritative for, how they can be queried, how often they should be checked, and what legal or technical constraints apply.

The G7 compliance coding manual prioritizes national government sources, then international organizations, then reliable major news sources. Writ preserves that hierarchy while allowing issue-specific exceptions.

The canonical machine-readable registry is in `config/source_registry.yml`.
`data/source-registry.json` is a generated compatibility projection for existing consumers.

## 2. Source classes

### 2.1 Normative G7 sources

Use these to identify commitments and methodology:

- G7 Information Centre summit documents and communiqués.
- Official host-presidency summit sites.
- Leaders' statements, annexes, declarations, action plans, roadmaps, and fact sheets.
- G7 ministerial statements where the methodology permits them.
- G7 Research Group commitment lists.
- G7 Research Group compliance coding manual.
- G7 Research Group interim and final compliance reports.
- G7 Research Group historical compliance datasets.

The source registry should distinguish original G7 documents from research-group methodology and evaluations.

### 2.2 National executive sources

Use for policies, programs, announcements, strategies, departmental guidance, grants, and implementation updates.

### 2.3 Law and regulation sources

Use for enacted legislation, regulations, legal effect dates, official journals, and repeals.

### 2.4 Budget and expenditure sources

Use for authorization, appropriations, allocations, contracts, grants, disbursement, public accounts, and audit findings.

### 2.5 Legislative and oversight sources

Use for bills, debates, committee reports, parliamentary questions, auditor reports, and implementation scrutiny.

### 2.6 Procurement and grants sources

Use for actual tendering, awards, contract status, grant notices, and recipient information.

### 2.7 Official statistical and open-data sources

Use for program outputs, economic indicators, sector coverage, and machine-readable records.

### 2.8 International organizations

Use where the action is implemented through, reported by, financed with, or independently monitored by an international organization.

### 2.9 Major media

Use for discovery, timing, independent corroboration, reversals, and facts not available through official sources. Do not treat a media report as weaker merely because it contradicts a government press release. Evaluate directness, evidence, and source role.

### 2.10 Research and civil society

Use for issue-specific monitoring, technical interpretation, and leads. Establish approved organizations by issue area rather than treating all NGOs or academic sources as one tier.

### 2.11 Archives

Use to preserve pages that change or disappear and to reconstruct what was publicly available by a cutoff date.

## 3. G7 Research Group corpus

Minimum connectors:

```text
Compliance index
https://www.g7.utoronto.ca/compliance/index.html

Historical compliance dataset index
https://www.g7.utoronto.ca/compliance/dataset/index.html

Compliance Coding Manual 2020
https://www.g7.utoronto.ca/compliance/Compliance_Coding_Manual_2020.pdf

2025 final compliance report index
https://www.g7.utoronto.ca/evaluations/2025compliance-final/index.html
```

Crawler behavior:

- preserve index HTML and linked PDF bytes;
- infer summit year, report stage, commitment number, title, and file URL;
- parse score matrices and compare them with chapter-level values;
- retain PDF page geometry;
- record broken links and index inconsistencies;
- do not assume filename numbering is semantically stable.

## 4. Member source map

The entries below are starting points. Connector activation requires verification of current API documentation, authentication, rate limits, terms, robots rules, and pagination.

### 4.1 Canada

Executive and programs:

- `canada.ca/en/news.html`
- department and agency collections under `canada.ca`
- departmental plans and results reports

Law and official publication:

- Canada Gazette: `gazette.gc.ca`
- Justice Laws: `laws-lois.justice.gc.ca`
- LEGISinfo: `parl.ca/legisinfo`
- House of Commons debates and committee publications

Budget and expenditure:

- Department of Finance budget publications
- Public Accounts of Canada
- GC InfoBase
- departmental transfer-payment and results data

Procurement and grants:

- CanadaBuys
- Government of Canada proactive-disclosure datasets

Open data:

- Open Government Portal and CKAN-compatible endpoints where available

### 4.2 France

Executive and programs:

- `gouvernement.fr`
- ministry press and policy pages

Law and official publication:

- Légifrance
- Journal officiel records through Légifrance
- PISTE APIs, including Légifrance services where authorized

Budget and expenditure:

- `budget.gouv.fr`
- performance publique publications
- Cour des comptes reports

Procurement:

- BOAMP
- PLACE

Legislature and open data:

- Assemblée nationale open data
- Sénat open data
- `data.gouv.fr`

### 4.3 Germany

Executive and programs:

- `bundesregierung.de`
- federal ministry sites

Law and official publication:

- `recht.bund.de`
- `gesetze-im-internet.de`

Budget and audit:

- `bundeshaushalt.de`
- Bundesrechnungshof reports

Procurement:

- e-Vergabe
- `service.bund.de`

Legislature and open data:

- Bundestag DIP and its API
- Bundesrat documents
- GovData
- Destatis and GENESIS-Online

### 4.4 Italy

Executive and programs:

- `governo.it`
- ministry sites

Law and official publication:

- Gazzetta Ufficiale
- Normattiva

Budget and expenditure:

- Ragioneria Generale dello Stato
- BDAP and OpenBDAP
- Corte dei conti reports

Procurement:

- ANAC BDNCP and ANAC open data
- Acquisti in Rete PA

Legislature and open data:

- Camera open data
- Senato open data
- `dati.gov.it`

### 4.5 Japan

Executive and programs:

- Prime Minister's Office and Cabinet Secretariat
- Cabinet Office
- ministry sites

Law and regulation:

- e-Gov law search
- e-Gov public-comment and administrative information

Budget and audit:

- Ministry of Finance budget materials
- Board of Audit reports

Procurement:

- Government Electronic Procurement System and procurement portal

Legislature and open data:

- National Diet Library proceedings database
- `data.go.jp`
- Digital Agency datasets and policy-evaluation resources

### 4.6 United Kingdom

Executive and programs:

- GOV.UK
- GOV.UK Content API
- department publication and announcement collections

Law and regulation:

- `legislation.gov.uk`
- statutory instrument records

Budget and expenditure:

- HM Treasury budget collections
- Whole of Government Accounts
- National Audit Office

Procurement:

- Contracts Finder API
- Find a Tender

Legislature and open data:

- UK Parliament developer APIs
- Hansard
- bills and committee publications
- `data.gov.uk`
- Office for National Statistics APIs

### 4.7 United States

Executive and programs:

- White House and Office of Management and Budget
- department and agency sites

Law and regulation:

- Federal Register API
- official Federal Register PDFs through GovInfo
- Regulations.gov API
- GovInfo API
- Congress.gov API

Budget, spending, and grants:

- USAspending API
- OMB budget data
- Grants.gov
- agency financial reports
- Government Accountability Office

Procurement and open data:

- SAM.gov data and APIs where licensed
- Data.gov catalog API

### 4.8 European Union

Executive and programs:

- European Commission Press Corner
- Council of the European Union press releases
- European External Action Service
- directorate-general policy pages

Law and official publication:

- EUR-Lex
- Publications Office CELLAR and data services
- Official Journal identifiers and European Legislation Identifier metadata

Budget and expenditure:

- EU budget publications
- Financial Transparency System
- European Court of Auditors

Procurement:

- Tenders Electronic Daily and its Search API

Legislature and open data:

- European Parliament Legislative Observatory
- European Parliament open data
- `data.europa.eu`
- Eurostat APIs

## 5. International and issue-specific sources

The source registry should map commitments to source packs.

### 5.1 Development finance and infrastructure

- World Bank projects, procurement, documents, and indicators.
- OECD Development Assistance Committee Creditor Reporting System.
- International Aid Transparency Initiative data.
- Regional development banks.
- G7 Partnership for Global Infrastructure and Investment announcements.
- Export credit agency disclosures.
- Open Contracting Data Standard feeds.

### 5.2 Macroeconomics, debt, and finance

- International Monetary Fund data, country reports, and debt materials.
- World Bank International Debt Statistics.
- OECD data.
- Paris Club statements.
- national debt-management offices and budget documents.
- central-bank publications where relevant.

### 5.3 Trade and critical minerals

- World Trade Organization documents and notifications.
- UN Comtrade.
- national customs and trade statistics.
- International Energy Agency critical-minerals data.
- geological surveys.
- licensing and environmental-regulator records.
- procurement and strategic-stockpile records.

### 5.4 Climate, environment, and biodiversity

- UNFCCC decisions, national communications, and NDC registry.
- Convention on Biological Diversity decisions and national reports.
- OECD environmental data.
- national environment ministries and regulators.
- protected-area and conservation-finance datasets.

### 5.5 Health

- World Health Organization IRIS, Global Health Observatory, resolutions, and emergency reporting.
- national health ministries and public-health agencies.
- procurement and grant databases.
- clinical or research registries only where directly relevant to the commitment.

### 5.6 Security, crime, and non-proliferation

- United Nations Security Council documents.
- UNODC publications and treaty implementation resources.
- IAEA resolutions and safeguards reporting.
- Financial Action Task Force materials.
- national justice, interior, sanctions, and export-control sources.

### 5.7 Labor, gender, and human rights

- ILO NORMLEX and supervisory materials.
- UN treaty-body databases.
- Universal Periodic Review records.
- national equality bodies, labor ministries, and statistical agencies.

### 5.8 Artificial intelligence and digital policy

- national digital and innovation ministries.
- official compute, cloud, grant, procurement, and SME-program records.
- OECD AI Policy Observatory.
- legislation and regulatory guidance.
- public funding and award data.

## 6. Interoperability standards useful as source adapters

### Open Contracting Data Standard

Use for procurement planning, tender, award, contract, and implementation records. Preserve the original release and record package identifiers.

### International Aid Transparency Initiative

Use for development and humanitarian activities, participating organizations, transactions, budgets, sectors, locations, and results.

### OECD DAC and CRS

Use for official development assistance, purpose codes, recipients, commitments, and disbursements.

### SDMX

Use for statistical series and metadata from international and national statistical organizations.

### XBRL

Use where government budgets, financial statements, or regulatory filings are available in XBRL.

### DCAT and DCAT-AP

Use to import dataset catalog metadata.

### European Legislation Identifier

Use to normalize European and national legal identifiers where published.

### Akoma Ntoso

Use as an optional structural interchange for legislation and parliamentary documents.

## 7. Search and discovery sources

Search engines and model-assisted browsing are discovery tools, not evidence records by themselves.

For every discovered page:

1. resolve the original publisher;
2. capture the source object;
3. classify the publisher and source type;
4. create passage anchors;
5. record the search query and discovery time;
6. review whether a higher-tier source exists.

## 8. Media policy

Store no more copyrighted content than the research and citation workflow requires.

Recommended record:

```text
publisher
title
author
published_at
canonical_uri
retrieved_at
short relevant passage where legally permitted
hash of captured page or licensed feed object
claim links
```

Prefer licensed feeds or links. Do not redistribute full articles in public release bundles without permission.

## 9. Archive strategy

Recommended order:

1. Store original bytes in controlled object storage where terms permit.
2. Write web captures to WARC.
3. Use Internet Archive availability and capture services where permitted.
4. Record official persistent identifiers such as DOI, CELEX, ELI, report number, or gazette citation.
5. For restricted content, store metadata, hashes, and anchors without redistributing bytes.

A source snapshot should make it possible to prove what evidence was evaluated even if the public URL later changes.

## 10. Source connector contract

Every connector implements:

```text
discover(query_context) -> candidate_resource_refs[]
fetch(resource_ref) -> raw_source_object
normalize(raw_source_object) -> document_metadata
extract(raw_source_object) -> structured_document
checkpoint() -> connector_cursor
health() -> connector_health
```

The contract also declares:

```text
idempotency key
pagination model
rate-limit policy
retry policy
authentication type
content rights
robots behavior
supported languages
expected update cadence
```

## 11. Source coverage matrix

For each commitment and member, track:

```text
required source packs
queried sources
last successful fetch
queries used
date range covered
languages covered
known gaps
negative-search sufficiency
```

A non-compliance conclusion based on absence should display the coverage matrix prominently.

## 12. Connector priorities

Build connectors in this order:

1. G7 Research Group corpus.
2. Generic official HTML, RSS, sitemap, and PDF connector.
3. United States Federal Register, GovInfo, Congress, USAspending, and Regulations.gov.
4. UK GOV.UK, Parliament, Contracts Finder, and legislation.
5. EU EUR-Lex, Commission/Council press, TED, and data.europa.eu.
6. Canada Open Government, Gazette, Parliament, CanadaBuys, and budget sources.
7. France, Germany, Italy, and Japan official portals.
8. World Bank, OECD, IATI, UN, IMF, WTO, WHO, UNFCCC, and CBD source packs.
9. Licensed media and archival integrations.

Priorities should be adjusted based on the selected 2025 commitments and the source coverage required to reproduce their reports.
