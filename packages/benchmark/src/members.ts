// The reviewed action catalog for the 2025 G7 "AI adoption for SMEs" benchmark.
//
// Every entry is a REAL action taken from the frozen source chapter
// (`benchmark/2025-ai-sme/sources/g7-2025-ai-sme-chapter.pdf`, sha256
// 9e88bb36…, report pages 170-192). Each carries the analyst's reviewed
// classification (`strong` | `weak` | `counter`), a distinct underlying
// instrument id, an announcement date inside the compliance window, and a page
// anchor + short factual quote for provenance.
//
// `interpretation_sensitive` marks the general, non-SME-targeted AI
// legislation / strategy documents whose weak-vs-strong reading is an explicit
// analyst interpretation call (see the two interpretation profiles). Their
// baseline (published) classification here is `weak`; the generous profile
// re-reads them as `strong`.
//
// The per-member strong/weak totals reproduce `benchmark/2025-ai-sme/
// reviewed-tally.md` exactly.

/** Reviewed classification under the rubric (Scoring Guidelines, p.172-173). */
export type Classification = "strong" | "weak" | "counter";

/** One reviewed action, cited to a page of the frozen report. */
export interface ActionSeed {
  /** Unique instrument slug; becomes `<code>-<slug>` as underlying_instrument_id. */
  readonly slug: string;
  /** Human-readable action label. */
  readonly label: string;
  /** Announcement / entry-into-force date (ISO date), inside the window. */
  readonly date: string;
  /** Report page number the action is described on. */
  readonly page: number;
  /** Report footnote number backing the action. */
  readonly footnote: number;
  /** Instrument kind (free-form, mirrors the evidence `action.kind`). */
  readonly kind: string;
  /** Evidence `action.implementation_stage`. */
  readonly stage:
    | "proposed"
    | "announced"
    | "authorized"
    | "budgeted"
    | "funded"
    | "contracted"
    | "launched"
    | "operational"
    | "disbursing"
    | "evaluated"
    | "completed"
    | "suspended"
    | "repealed";
  /** Evidence `action.beneficiary_targeting`. */
  readonly targeting:
    "explicit" | "materially_inclusive" | "indirect" | "general" | "absent" | "contested";
  /** Evidence `action.attribution`. */
  readonly attribution:
    "unilateral" | "joint" | "collective" | "implementing_partner" | "external" | "disputed";
  /** The analyst's baseline (published) reviewed classification. */
  readonly classification: Classification;
  /** Short factual quote / description anchored to the page. */
  readonly quote: string;
  /** True for a general non-SME AI measure whose reading is profile-sensitive. */
  readonly interpretation_sensitive?: boolean;
  /** Optional headline amount. */
  readonly amount?: {
    readonly value: string;
    readonly currency: string;
    readonly bound: "exact" | "up_to" | "at_least" | "approximate";
  };
}

/** A G7 member (or the EU) with its reviewed action list. */
export interface MemberSeed {
  /** Snapshot key / subject id, e.g. `canada`. */
  readonly id: string;
  /** Two/three letter instrument-id prefix. */
  readonly code: string;
  /** Display name / evidence `action.jurisdiction` + actor. */
  readonly name: string;
  /** Published cell from the report Assessment table (p.170). */
  readonly published: "-1" | "0" | "+1";
  /** The report's named analyst for this member. */
  readonly analyst: string;
  /** Report page where the member section begins. */
  readonly sectionPage: number;
  readonly actions: readonly ActionSeed[];
}

// --- Canada: +1  (16 strong, 4 weak) ----------------------------------------
const canada: MemberSeed = {
  id: "canada",
  code: "ca",
  name: "Canada",
  published: "+1",
  analyst: "Mai Linh Pham Dac",
  sectionPage: 173,
  actions: [
    {
      slug: "ai-compute-access-fund",
      label: "AI Compute Access Fund (up to CAD300M to SMEs)",
      date: "2025-06-25",
      page: 173,
      footnote: 915,
      kind: "compute_funding_program",
      stage: "funded",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "Canada opened applications for the AI Compute Access Fund, up to CAD300 million to SMEs developing Canadian-based AI products.",
      amount: { value: "300000000", currency: "CAD", bound: "up_to" },
    },
    {
      slug: "japan-canada-tech-accelerator",
      label: "Japan-Canada Technology Accelerator + NRC IRAP AI Solutions program",
      date: "2025-08-19",
      page: 173,
      footnote: 916,
      kind: "talent_exchange",
      stage: "announced",
      targeting: "explicit",
      attribution: "joint",
      classification: "strong",
      quote:
        "The Japan-Canada Technology Accelerator and NRC IRAP announced an AI Solutions for Manufacturing and Clean Technologies program introducing Canadian SMEs to Japanese firms.",
    },
    {
      slug: "toronto-region-ai-business-catalyst",
      label: "Toronto Region Board of Trade AI Business Catalyst (CAD2.4M)",
      date: "2025-10-22",
      page: 173,
      footnote: 917,
      kind: "funding_program",
      stage: "funded",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "A CAD2.4 million investment for the Toronto Region Board of Trade AI Business Catalyst program to give Toronto businesses tools to adopt AI.",
      amount: { value: "2400000", currency: "CAD", bound: "exact" },
    },
    {
      slug: "fcac-gri-workshop",
      label: "FCAC + Global Risk Institute AI workshop",
      date: "2025-11-13",
      page: 173,
      footnote: 918,
      kind: "workshop",
      stage: "announced",
      targeting: "indirect",
      attribution: "unilateral",
      classification: "weak",
      quote:
        "The Financial Consumer Agency of Canada and the Global Risk Institute organized a workshop examining how emerging AI affects financial well-being and consumer protection.",
    },
    {
      slug: "canada-germany-digital-alliance",
      label: "Canada-Germany Digital Alliance joint statement",
      date: "2025-12-08",
      page: 174,
      footnote: 919,
      kind: "partnership",
      stage: "announced",
      targeting: "materially_inclusive",
      attribution: "joint",
      classification: "strong",
      quote:
        "Ministers Solomon and Wildberger advanced a Canada-Germany Digital Alliance committing to a Joint Declaration of Intent on AI covering compute infrastructure, AI adoption and talent mobility, including SMEs.",
    },
    {
      slug: "national-ai-compute-925m",
      label: "CAD925.6M national AI compute capacity expansion",
      date: "2025-12-08",
      page: 174,
      footnote: 919,
      kind: "compute_infrastructure",
      stage: "budgeted",
      targeting: "materially_inclusive",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "Canada highlighted a CAD925.6 million commitment to expand national AI compute capacity and establish sovereign public supercomputing infrastructure, broadening compute available to Canadian SMEs.",
      amount: { value: "925600000", currency: "CAD", bound: "exact" },
    },
    {
      slug: "g7-ai-adoption-roadmap-declaration",
      label: "G7 Ministerial declaration on the AI Adoption Roadmap",
      date: "2025-12-09",
      page: 174,
      footnote: 920,
      kind: "training_program",
      stage: "announced",
      targeting: "explicit",
      attribution: "collective",
      classification: "strong",
      quote:
        "The G7 Industry, Digital and Technology Ministers' declaration commits members to expanding training and talent-exchange initiatives and encouraging open-source AL to help SMEs build skills.",
    },
    {
      slug: "sme-ai-adoption-blueprint",
      label: "SME AI Adoption Blueprint (G7 statement)",
      date: "2025-12-09",
      page: 174,
      footnote: 921,
      kind: "policy_framework",
      stage: "announced",
      targeting: "explicit",
      attribution: "collective",
      classification: "strong",
      quote:
        "The G7 SME AI Adoption Blueprint set out policy recommendations on infrastructure, datasets, open-source tools, AI literacy, workforce development and financial supports for resilient SME-focused AI ecosystems.",
    },
    {
      slug: "g7-sme-ai-toolkit",
      label: "Toolkit for SMEs Deploying AI",
      date: "2025-12-09",
      page: 174,
      footnote: 922,
      kind: "toolkit",
      stage: "operational",
      targeting: "explicit",
      attribution: "collective",
      classification: "strong",
      quote:
        "The G7 published the Toolkit for Small- and Medium-Sized Enterprises Deploying Artificial Intelligence, tailored implementation-focused resources for SME AI deployers.",
    },
    {
      slug: "quebec-vector-amii-case-studies",
      label: "Quebec AI / Vector / Amii comparative case-study report",
      date: "2025-12-09",
      page: 175,
      footnote: 923,
      kind: "case_studies",
      stage: "operational",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "Canada released a comparative report by the Quebec AI Institute, the Vector Institute and the Alberta Machine Intelligence Institute synthesizing SME AI adoption case studies from all G7 members.",
    },
    {
      slug: "italy-canada-jag-declaration",
      label: "Italy-Canada Joint Advisory Group declaration",
      date: "2025-12-10",
      page: 175,
      footnote: 924,
      kind: "declaration",
      stage: "announced",
      targeting: "indirect",
      attribution: "joint",
      classification: "weak",
      quote:
        "A declaration between Italy and Canada reaffirmed their Joint Advisory Group commitment, which is developing a collaborative project on AI in SMEs.",
    },
    {
      slug: "feddev-coralus-toronto-resiliency",
      label: "CAD6.7M FedDev Ontario support for Toronto small business + Coralus",
      date: "2025-12-15",
      page: 175,
      footnote: 925,
      kind: "funding_program",
      stage: "funded",
      targeting: "materially_inclusive",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "A CAD6.7 million FedDev Ontario investment supported the Toronto Economic Resiliency Initiative and Coralus to help small businesses adapt, upgrade and remain competitive.",
      amount: { value: "6700000", currency: "CAD", bound: "exact" },
    },
    {
      slug: "feddev-ai-growth-19m",
      label: "CAD19M FedDev Ontario AI growth package",
      date: "2025-12-17",
      page: 175,
      footnote: 925,
      kind: "funding_program",
      stage: "funded",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "A funding package of over CAD19 million through FedDev Ontario helps 20 AI-focused businesses develop new AI technologies and accelerate adoption.",
      amount: { value: "19000000", currency: "CAD", bound: "at_least" },
    },
    {
      slug: "cannor-ai-entrepreneurship-centre",
      label: "CAD2.8M CanNor AI-Driven Entrepreneurship and Business Support Centre",
      date: "2026-02-06",
      page: 175,
      footnote: 926,
      kind: "sme_support_centre",
      stage: "funded",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "Over CAD2.8 million supports an AI-Driven Entrepreneurship and Business Support Centre helping northern SMEs develop and integrate AI tools.",
      amount: { value: "2800000", currency: "CAD", bound: "at_least" },
    },
    {
      slug: "canada-germany-jdi-sovereign-alliance",
      label: "Canada-Germany Joint Declaration of Intent on AI + Sovereign Technology Alliance",
      date: "2026-02-14",
      page: 175,
      footnote: 927,
      kind: "partnership",
      stage: "announced",
      targeting: "materially_inclusive",
      attribution: "joint",
      classification: "strong",
      quote:
        "Canada and Germany signed a Joint Declaration of Intent on AI and launched the Sovereign Technology Alliance for cooperation on AI infrastructure, research, commercialization and talent.",
    },
    {
      slug: "acoa-regional-ai-initiative",
      label: "ACOA Regional Artificial Intelligence Initiative (CAD200M to SMEs)",
      date: "2026-03-18",
      page: 176,
      footnote: 928,
      kind: "funding_program",
      stage: "disbursing",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "ACOA's plan pledged tailored assistance to SMEs, expanding the Regional Artificial Intelligence Initiative with CAD200 million to grant chosen SMEs for AI adoption.",
      amount: { value: "200000000", currency: "CAD", bound: "up_to" },
    },
    {
      slug: "nrc-emerging-tech-900m",
      label: "NRC CAD900M emerging-technologies investment",
      date: "2026-03-19",
      page: 176,
      footnote: 930,
      kind: "research_investment",
      stage: "announced",
      targeting: "general",
      attribution: "unilateral",
      classification: "weak",
      quote:
        "The National Research Council announced investing over CAD900 million in emerging technologies including quantum computing, sensing and communications.",
      amount: { value: "900000000", currency: "CAD", bound: "at_least" },
    },
    {
      slug: "canada-finland-joint-statement",
      label: "Canada-Finland joint statement on sovereign technology and AI",
      date: "2026-04-14",
      page: 176,
      footnote: 931,
      kind: "joint_statement",
      stage: "announced",
      targeting: "indirect",
      attribution: "joint",
      classification: "weak",
      quote:
        "Canada and Finland reaffirmed a commitment to enhance bilateral cooperation including promoting the integration of AI into SMEs.",
    },
    {
      slug: "ai-sovereign-compute-infrastructure-program",
      label: "AI Sovereign Compute Infrastructure Program",
      date: "2026-04-15",
      page: 176,
      footnote: 932,
      kind: "compute_infrastructure",
      stage: "launched",
      targeting: "materially_inclusive",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "Canada launched the AI Sovereign Compute Infrastructure Program, opening applications to develop large-scale Canadian-based supercomputing systems.",
    },
    {
      slug: "siemens-ai-manufacturing-centre",
      label: "CAD23M Siemens Canada Global AI Manufacturing R&D Centre",
      date: "2026-04-21",
      page: 176,
      footnote: 933,
      kind: "rd_investment",
      stage: "funded",
      targeting: "materially_inclusive",
      attribution: "joint",
      classification: "strong",
      quote:
        "Minister Joly announced a CAD23 million investment to Siemens Canada to expand a Global AI Manufacturing Technologies R&D Centre for battery production.",
      amount: { value: "23000000", currency: "CAD", bound: "exact" },
    },
  ],
};

// --- France: +1  (7 strong, 0 weak) -----------------------------------------
const france: MemberSeed = {
  id: "france",
  code: "fr",
  name: "France",
  published: "+1",
  analyst: "Mai Linh Pham Dac",
  sectionPage: 177,
  actions: [
    {
      slug: "ai-pioneers",
      label: "AI Pioneers program (EUR3-8M per enterprise)",
      date: "2025-09-18",
      page: 177,
      footnote: 934,
      kind: "funding_program",
      stage: "launched",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "France launched the AI Pioneers program financing domestic project proposals, providing between EUR3 million and EUR8 million to selected enterprises over three years.",
      amount: { value: "8000000", currency: "EUR", bound: "up_to" },
    },
    {
      slug: "osez-lia",
      label: "Osez l'IA plan for SME AI adoption",
      date: "2025-09-18",
      page: 177,
      footnote: 935,
      kind: "training_program",
      stage: "launched",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The Osez l'IA plan accelerates AI adoption in SMEs through networking events, an AI academy training professionals, and help identifying relevant AI solutions.",
    },
    {
      slug: "ai-academy-small-business",
      label: "AI Academy small-business revitalization plan",
      date: "2025-11-07",
      page: 177,
      footnote: 936,
      kind: "training_program",
      stage: "announced",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "An action plan to revitalize small businesses added an AI Academy letting SMEs access user-friendly AI tools with a network of ambassadors.",
    },
    {
      slug: "piiec-ai-innovation",
      label: "Important Projects of Common European Interest (PIIEC) AI framework",
      date: "2025-11-26",
      page: 177,
      footnote: 937,
      kind: "funding_program",
      stage: "launched",
      targeting: "explicit",
      attribution: "joint",
      classification: "strong",
      quote:
        "France launched the PIIEC framework letting EU member states finance private AI innovation projects, helping local French SMEs access funding for advanced AI technology.",
    },
    {
      slug: "data-center-sme-deployment",
      label: "Data-center support for 52 SMEs deploying AI",
      date: "2026-01-30",
      page: 178,
      footnote: 938,
      kind: "compute_infrastructure",
      stage: "operational",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "Minister Le Henanff reconvened stakeholders on increasing AI adoption in SMEs through data center sites, providing support to 52 companies implementing AI.",
    },
    {
      slug: "bull-acquisition",
      label: "EUR404M state acquisition of AI computing brand Bull",
      date: "2026-03-31",
      page: 178,
      footnote: 939,
      kind: "compute_infrastructure",
      stage: "contracted",
      targeting: "materially_inclusive",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "France announced the state's EUR404 million acquisition of the AI computing brand Bull to facilitate AI integration into SMEs.",
      amount: { value: "404000000", currency: "EUR", bound: "exact" },
    },
    {
      slug: "amd-compute-loi",
      label: "France-AMD letter of intent on AI compute + Alice Recoque supercomputer",
      date: "2026-04-16",
      page: 178,
      footnote: 940,
      kind: "compute_infrastructure",
      stage: "announced",
      targeting: "materially_inclusive",
      attribution: "joint",
      classification: "strong",
      quote:
        "France and AMD signed a letter of intent to expand access to AI compute, supporting the Alice Recoque exascale supercomputer with hardware, software and training for startups.",
    },
  ],
};

// --- Germany: +1  (7 strong, 4 weak) ----------------------------------------
const germany: MemberSeed = {
  id: "germany",
  code: "de",
  name: "Germany",
  published: "+1",
  analyst: "Ece Onal",
  sectionPage: 179,
  actions: [
    {
      slug: "bmz-data-strategy",
      label: "BMZ Data Strategy (based on Sept 2024 data)",
      date: "2025-09-30",
      page: 179,
      footnote: 941,
      kind: "strategy_document",
      stage: "announced",
      targeting: "general",
      attribution: "unilateral",
      classification: "weak",
      quote:
        "The BMZ Data Strategy announced a ministry-wide plan to introduce AI in administration and data analysis, but was based on data collected in September 2024, indicating limited recent progress.",
    },
    {
      slug: "mittelstand-digital-congress",
      label: "Mittelstand Digital Congress 2025",
      date: "2025-11-13",
      page: 179,
      footnote: 942,
      kind: "training_program",
      stage: "operational",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The Mittelstand Digital Congress had AI experts educate SMEs on how to safely integrate AI technology into their businesses.",
    },
    {
      slug: "european-digital-sovereignty-summit",
      label: "European Summit on Digital Sovereignty (Berlin)",
      date: "2025-11-18",
      page: 179,
      footnote: 943,
      kind: "conference",
      stage: "operational",
      targeting: "general",
      attribution: "joint",
      classification: "weak",
      quote:
        "Germany and France co-hosted the European Summit on Digital Sovereignty in Berlin with over 1,000 participants including digital ministers from 23 EU member states.",
    },
    {
      slug: "canada-germany-digital-alliance",
      label: "Canada-Germany Digital Alliance joint statement",
      date: "2025-12-08",
      page: 179,
      footnote: 944,
      kind: "partnership",
      stage: "announced",
      targeting: "materially_inclusive",
      attribution: "joint",
      classification: "strong",
      quote:
        "Minister Wildberger and Minister Solomon advanced a Canada-Germany Digital Alliance committing to a Joint Declaration of Intent on AI covering compute infrastructure, AI adoption and talent mobility, including SMEs.",
    },
    {
      slug: "sme-ai-adoption-blueprint",
      label: "SME AI Adoption Blueprint (G7 statement)",
      date: "2025-12-09",
      page: 179,
      footnote: 945,
      kind: "policy_framework",
      stage: "announced",
      targeting: "explicit",
      attribution: "collective",
      classification: "strong",
      quote:
        "The G7 SME AI Adoption Blueprint set out coordinated measures and financial supports for resilient SME-focused AI adoption ecosystems.",
    },
    {
      slug: "g7-sme-ai-toolkit",
      label: "Toolkit for SMEs Deploying AI",
      date: "2025-12-09",
      page: 180,
      footnote: 946,
      kind: "toolkit",
      stage: "operational",
      targeting: "explicit",
      attribution: "collective",
      classification: "strong",
      quote:
        "The G7 published the Toolkit for Small- and Medium-Sized Enterprises Deploying Artificial Intelligence with tailored resources for SME AI deployers.",
    },
    {
      slug: "eif-german-equity",
      label: "EIF German Equity program (EUR1.6B for startups + SMEs)",
      date: "2026-01-13",
      page: 180,
      footnote: 947,
      kind: "financing_program",
      stage: "funded",
      targeting: "explicit",
      attribution: "joint",
      classification: "strong",
      quote:
        "The BMWE and the European Investment Fund expanded the EIF German Equity program, providing EUR1.6 billion in additional financing for technology-based startups and SMEs.",
      amount: { value: "1600000000", currency: "EUR", bound: "at_least" },
    },
    {
      slug: "canada-germany-jdi-sovereign-alliance",
      label: "Canada-Germany Joint Declaration of Intent on AI + Sovereign Technology Alliance",
      date: "2026-02-14",
      page: 180,
      footnote: 948,
      kind: "partnership",
      stage: "announced",
      targeting: "indirect",
      attribution: "joint",
      classification: "weak",
      quote:
        "Canada and Germany signed a Joint Declaration of Intent on AI and launched the Sovereign Technology Alliance, although they do not provide direct, targeted support for SME AI adoption.",
    },
    {
      slug: "india-germany-ai-pact",
      label: "India-Germany AI Pact",
      date: "2026-02-18",
      page: 180,
      footnote: 949,
      kind: "partnership",
      stage: "announced",
      targeting: "materially_inclusive",
      attribution: "joint",
      classification: "strong",
      quote:
        "Ministers Wildberger and Vaishnaw agreed to establish the India-Germany AI Pact, aiming to increase the rapid adoption of AI for start-ups, tech firms and SMEs.",
    },
    {
      slug: "ai-funding-guideline-consultation",
      label: "Public consultation on an AI funding guideline",
      date: "2026-03-02",
      page: 181,
      footnote: 950,
      kind: "consultation",
      stage: "proposed",
      targeting: "indirect",
      attribution: "unilateral",
      classification: "weak",
      quote:
        "The Federal Ministry for Digital Affairs initiated a public consultation for SMEs, research centers and public institutions to create a funding guideline promoting AI for commercial applications.",
    },
    {
      slug: "zukunftstag-mittelstand",
      label: "Zukunftstag Mittelstand 2026",
      date: "2026-04-15",
      page: 181,
      footnote: 951,
      kind: "training_program",
      stage: "operational",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The Zukunftstag Mittelstand 2026 showcased practical AI and data solutions and digital transformation tools tailored to SMEs to advance adoption of AI, cloud computing and digital infrastructure.",
    },
  ],
};

// --- Italy: +1  (8 strong, 3 weak) ------------------------------------------
const italy: MemberSeed = {
  id: "italy",
  code: "it",
  name: "Italy",
  published: "+1",
  analyst: "Anson Hu",
  sectionPage: 181,
  actions: [
    {
      slug: "congo-mou-startups",
      label: "MoU with the Republic of Congo on AI for startups",
      date: "2025-06-19",
      page: 181,
      footnote: 952,
      kind: "partnership",
      stage: "announced",
      targeting: "explicit",
      attribution: "joint",
      classification: "strong",
      quote:
        "Minister Urso signed a Memorandum of Understanding with the Republic of Congo to support local startups incorporating AI, helping SMEs reduce barriers to AI.",
    },
    {
      slug: "ai-hub-sustainable-development",
      label: "AI Hub for Sustainable Development (Mattei Plan)",
      date: "2025-06-20",
      page: 181,
      footnote: 953,
      kind: "compute_infrastructure",
      stage: "operational",
      targeting: "explicit",
      attribution: "implementing_partner",
      classification: "strong",
      quote:
        "Italy and the UNDP opened the AI Hub for Sustainable Development to strengthen energy-efficient AI infrastructure so that African SMEs may use it to promote economic growth.",
    },
    {
      slug: "ai4industry-virkkunen-meeting",
      label: "Urso-Virkkunen meeting on AI4Industry",
      date: "2025-07-17",
      page: 182,
      footnote: 954,
      kind: "meeting",
      stage: "announced",
      targeting: "indirect",
      attribution: "joint",
      classification: "weak",
      quote:
        "Minister Urso met Executive Vice-President Virkkunen, highlighting the AI4Industry foundation in Turin and reaffirming Italy's commitment to SME AI adoption.",
    },
    {
      slug: "smau-2025-innovation-award",
      label: "SMAU 2025 Innovation Award",
      date: "2025-11-07",
      page: 182,
      footnote: 955,
      kind: "award",
      stage: "completed",
      targeting: "indirect",
      attribution: "unilateral",
      classification: "weak",
      quote:
        "MIMIT announced recipients of the SMAU 2025 Innovation Award, with the Turin tech hub CTE Next recognized for leveraging AI to optimize vehicle mobility.",
    },
    {
      slug: "ai-match-pilot",
      label: "AI Match national pilot programme",
      date: "2025-11-10",
      page: 182,
      footnote: 956,
      kind: "training_program",
      stage: "launched",
      targeting: "explicit",
      attribution: "implementing_partner",
      classification: "strong",
      quote:
        "AI4I, the Chamber of Commerce of Turin and Piemonte Innova launched AI Match, a national pilot making AI accessible to SMEs with training, matching and voucher-based financial support.",
    },
    {
      slug: "lobito-corridor-dialogue",
      label: "Lobito corridor AI infrastructure dialogue",
      date: "2025-11-24",
      page: 182,
      footnote: 957,
      kind: "dialogue",
      stage: "announced",
      targeting: "general",
      attribution: "joint",
      classification: "weak",
      quote:
        "Prime Minister Meloni discussed building AI infrastructure value chains throughout the Lobito corridor at the African Union-European Union Business Forum.",
    },
    {
      slug: "it4lia-ai-factory",
      label: "IT4LIA AI Factory operational opening",
      date: "2025-09-05",
      page: 182,
      footnote: 958,
      kind: "compute_infrastructure",
      stage: "operational",
      targeting: "explicit",
      attribution: "implementing_partner",
      classification: "strong",
      quote:
        "The operational opening of the IT4LIA AI Factory, one of Europe's first AI-dedicated factories, promotes AI adoption in SMEs through better access to compute and digital infrastructure.",
    },
    {
      slug: "italy-canada-jag-declaration",
      label: "Italy-Canada Joint Advisory Group declaration",
      date: "2025-12-10",
      page: 183,
      footnote: 959,
      kind: "partnership",
      stage: "announced",
      targeting: "explicit",
      attribution: "joint",
      classification: "strong",
      quote:
        "A declaration between Italy and Canada is developing a collaborative project fostering the adoption of AI solutions in SMEs, to be presented at a 2026 workshop hosted in Italy.",
    },
    {
      slug: "nairobi-harmonic-africa",
      label: "Harmonic Africa Startup Acceleration Program (EUR50M)",
      date: "2026-02-10",
      page: 183,
      footnote: 960,
      kind: "financing_program",
      stage: "funded",
      targeting: "explicit",
      attribution: "implementing_partner",
      classification: "strong",
      quote:
        "At the Nairobi AI Forum, Italy, Kenya and the UNDP launched the Harmonic Africa Startup Acceleration Program with a EUR50 million endowment and an Italian incubator to fund African AI startups.",
      amount: { value: "50000000", currency: "EUR", bound: "at_least" },
    },
    {
      slug: "innoconnect-greece-italy",
      label: "InnoConnect SME-centred Interreg project",
      date: "2026-03-16",
      page: 183,
      footnote: 961,
      kind: "partnership",
      stage: "operational",
      targeting: "explicit",
      attribution: "joint",
      classification: "strong",
      quote:
        "Interreg reviewed the SME-centred InnoConnect project, an AI-based matchmaking platform pairing SMEs with investors to provide access to funding and partnerships.",
    },
    {
      slug: "ai4i-accenture-partnership",
      label: "AI4I-Accenture strategic partnership",
      date: "2026-03-24",
      page: 183,
      footnote: 962,
      kind: "partnership",
      stage: "announced",
      targeting: "explicit",
      attribution: "joint",
      classification: "strong",
      quote:
        "AI4I announced a strategic partnership with Accenture to accelerate AI adoption across Italian SMEs, offloading document management, inventory forecasting and demand prediction.",
    },
  ],
};

// --- Japan: 0  (3 strong, 4 weak; two interpretation-sensitive) -------------
const japan: MemberSeed = {
  id: "japan",
  code: "jp",
  name: "Japan",
  published: "0",
  analyst: "Ece Onal",
  sectionPage: 184,
  actions: [
    {
      slug: "ai-act",
      label: "Act on Promotion of R&D and Utilization of AI-related Technology",
      date: "2025-09-01",
      page: 184,
      footnote: 963,
      kind: "legislation",
      stage: "operational",
      targeting: "general",
      attribution: "unilateral",
      classification: "weak",
      interpretation_sensitive: true,
      quote:
        "Japan fully enforced the Act on Promotion of Research and Development, and Utilization of AI-related Technology, a general AI law formulating AI regulations and supporting responsible AI integration within SMEs and the wider private sector.",
    },
    {
      slug: "ai-strategy-headquarters",
      label: "AI Strategy Headquarters",
      date: "2025-09-11",
      page: 184,
      footnote: 964,
      kind: "institution",
      stage: "operational",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "Japan established the AI Strategy Headquarters to promote secure integration of AI into businesses, particularly SMEs, addressing labor shortages, supply-chain analytics and market access.",
    },
    {
      slug: "oecd-labour-market-report",
      label: "OECD report on AI in Japan's labour market",
      date: "2025-11-28",
      page: 184,
      footnote: 965,
      kind: "report",
      stage: "completed",
      targeting: "indirect",
      attribution: "external",
      classification: "weak",
      quote:
        "An OECD report identified barriers to SME AI adoption and listed Japanese measures ranging from 2015 to 2025, indicating limited recent progress and not fulfilling compute access.",
    },
    {
      slug: "sme-ai-adoption-blueprint",
      label: "SME AI Adoption Blueprint (G7 statement)",
      date: "2025-12-09",
      page: 184,
      footnote: 966,
      kind: "policy_framework",
      stage: "announced",
      targeting: "explicit",
      attribution: "collective",
      classification: "strong",
      quote:
        "The G7 SME AI Adoption Blueprint set out coordinated measures for resilient SME-focused AI adoption ecosystems.",
    },
    {
      slug: "g7-sme-ai-toolkit",
      label: "Toolkit for SMEs Deploying AI",
      date: "2025-12-09",
      page: 185,
      footnote: 967,
      kind: "toolkit",
      stage: "operational",
      targeting: "explicit",
      attribution: "collective",
      classification: "strong",
      quote:
        "The G7 published the Toolkit for Small- and Medium-Sized Enterprises Deploying Artificial Intelligence with tailored resources for SME AI deployers.",
    },
    {
      slug: "first-basic-ai-plan",
      label: "First basic plan on AI",
      date: "2025-12-22",
      page: 185,
      footnote: 968,
      kind: "strategy_document",
      stage: "announced",
      targeting: "general",
      attribution: "unilateral",
      classification: "weak",
      interpretation_sensitive: true,
      quote:
        "Japan approved its first basic plan on AI, a national framework to expand AI use including measures supporting the uptake of AI tools within enterprises.",
    },
    {
      slug: "gennai-government-pilot",
      label: "GENNAI government AI system pilot",
      date: "2026-03-06",
      page: 185,
      footnote: 969,
      kind: "pilot",
      stage: "launched",
      targeting: "indirect",
      attribution: "unilateral",
      classification: "weak",
      quote:
        "The Digital Agency launched a large-scale pilot for the government AI system GENNAI across ministries, whose impact on private-sector SMEs remains indirect.",
    },
  ],
};

// --- United Kingdom: +1  (11 strong, 3 weak) --------------------------------
const unitedKingdom: MemberSeed = {
  id: "united_kingdom",
  code: "uk",
  name: "United Kingdom",
  published: "+1",
  analyst: "Anson Hu",
  sectionPage: 185,
  actions: [
    {
      slug: "made-in-uk-awards",
      label: "Made in the UK, Sold to the World Awards",
      date: "2025-06-24",
      page: 186,
      footnote: 970,
      kind: "award",
      stage: "completed",
      targeting: "indirect",
      attribution: "unilateral",
      classification: "weak",
      quote:
        "The Department for Business and Trade announced 12 SMEs as recipients of the 2025 Made in the UK, Sold to the World Awards, including firms utilizing AI in their products.",
    },
    {
      slug: "regulatory-innovation-office",
      label: "Regulatory Innovation Office AI regulation work",
      date: "2025-07-01",
      page: 186,
      footnote: 971,
      kind: "regulation",
      stage: "announced",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "Technology Secretary Kyle announced plans for the Regulatory Innovation Office to reduce stringent regulations on AI adoption for SMEs in fintech via a unified digital library.",
    },
    {
      slug: "compute-roadmap",
      label: "Compute Roadmap (AI Research Resource 20x)",
      date: "2025-07-17",
      page: 186,
      footnote: 972,
      kind: "compute_infrastructure",
      stage: "announced",
      targeting: "materially_inclusive",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The DSIT and UKRI Compute Roadmap pledges to expand the UK's AI Research Resource system twenty-fold over the next five years, supporting SME access to compute and AI.",
    },
    {
      slug: "uk-us-tech-prosperity-deal",
      label: "UK-US Tech Prosperity Deal + North East AI Growth Zone",
      date: "2025-09-16",
      page: 186,
      footnote: 973,
      kind: "partnership",
      stage: "announced",
      targeting: "explicit",
      attribution: "joint",
      classification: "strong",
      quote:
        "The UK and US agreed the Tech Prosperity Deal to boost data centres and AI startups and create a North East AI Growth Zone expanding SME access to affordable compute.",
    },
    {
      slug: "regional-tech-booster",
      label: "Regional Tech Booster programme",
      date: "2025-10-01",
      page: 186,
      footnote: 974,
      kind: "funding_program",
      stage: "launched",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The DSIT launched the Regional Tech Booster programme supporting projects that help SMEs adopt AI through investment events and a start-up support scheme.",
    },
    {
      slug: "local-innovation-partnerships-fund",
      label: "Local Innovation Partnerships Fund (GBP20M each for AI SMEs)",
      date: "2025-10-19",
      page: 186,
      footnote: 975,
      kind: "funding_program",
      stage: "funded",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "Science and Technology Secretary Kendall announced GBP20 million each for Greater Manchester, the West Midlands and Glasgow for AI-based SMEs.",
      amount: { value: "20000000", currency: "GBP", bound: "exact" },
    },
    {
      slug: "ai-growth-lab",
      label: "AI Growth Lab regulatory pilot",
      date: "2025-10-21",
      page: 187,
      footnote: 976,
      kind: "pilot",
      stage: "launched",
      targeting: "indirect",
      attribution: "unilateral",
      classification: "weak",
      quote:
        "Technology Secretary Kendall announced the AI Growth Lab to cut red tape by piloting responsible AI to be adopted by people and businesses.",
    },
    {
      slug: "ai-skills-framework",
      label: "Skills England AI Skills Framework, Adoption Pathway and Employer Checklist",
      date: "2025-10-29",
      page: 187,
      footnote: 977,
      kind: "toolkit",
      stage: "operational",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "Skills England announced the AI Skills Framework, Adoption Pathway and Employer Checklist to support AI adoption in various sectors, including for SMEs.",
    },
    {
      slug: "dawn-supercomputer",
      label: "GBP36M Cambridge DAWN supercomputer injection",
      date: "2026-01-26",
      page: 187,
      footnote: 978,
      kind: "compute_infrastructure",
      stage: "funded",
      targeting: "materially_inclusive",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The DSIT announced a GBP36 million injection into Cambridge's DAWN supercomputer under the AI Opportunities Action Plan to help SMEs access supercomputing capabilities.",
      amount: { value: "36000000", currency: "GBP", bound: "exact" },
    },
    {
      slug: "free-ai-foundations-training",
      label: "Free AI foundations training (2M+ SME employees)",
      date: "2026-01-28",
      page: 187,
      footnote: 979,
      kind: "training_program",
      stage: "operational",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The DSIT expanded free AI foundations training for all workers, including at least 2 million employees from SMEs.",
    },
    {
      slug: "youth-employment-ai-apprenticeship",
      label: "GBP1B youth employment AI apprenticeship",
      date: "2026-03-16",
      page: 187,
      footnote: 980,
      kind: "employment_program",
      stage: "announced",
      targeting: "general",
      attribution: "unilateral",
      classification: "weak",
      quote:
        "Work and Pensions Secretary McFadden announced a GBP1 billion youth employment investment including an 18-month AI and automation practitioner apprenticeship.",
      amount: { value: "1000000000", currency: "GBP", bound: "at_least" },
    },
    {
      slug: "ai-upskilling-challenge-fund",
      label: "AI Upskilling Challenge Fund (GBP800k) + Healthcare Living Lab",
      date: "2026-03-25",
      page: 187,
      footnote: 981,
      kind: "training_program",
      stage: "funded",
      targeting: "explicit",
      attribution: "joint",
      classification: "strong",
      quote:
        "The DSIT launched an GBP800,000 AI Upskilling Challenge Fund and a Healthcare Living Lab with Cisco to provide SME workers with training in the usage of AI technology.",
      amount: { value: "800000", currency: "GBP", bound: "exact" },
    },
    {
      slug: "frontier-ai-discovery",
      label: "Frontier AI Discovery funding competition (GBP2.5M)",
      date: "2026-04-14",
      page: 188,
      footnote: 982,
      kind: "funding_program",
      stage: "launched",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "Innovate UK launched the Frontier AI Discovery funding competition, making up to GBP2.5 million available to UK organizations including SMEs for AI feasibility studies.",
      amount: { value: "2500000", currency: "GBP", bound: "up_to" },
    },
    {
      slug: "sovereign-ai-initiative",
      label: "GBP500M Sovereign AI initiative",
      date: "2026-04-16",
      page: 188,
      footnote: 983,
      kind: "funding_program",
      stage: "launched",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The DSIT launched the GBP500 million Sovereign AI initiative supporting domestic AI companies including startups and SMEs with direct investment, supercomputing access and one million GPU hours.",
      amount: { value: "500000000", currency: "GBP", bound: "up_to" },
    },
  ],
};

// --- United States: 0  (3 strong, 3 weak; three interpretation-sensitive) ---
const unitedStates: MemberSeed = {
  id: "united_states",
  code: "us",
  name: "United States",
  published: "0",
  analyst: "Jeanne Brownewell",
  sectionPage: 188,
  actions: [
    {
      slug: "ai-technology-stack-export-eo",
      label: "Executive Order: Promoting the Export of the American Technology Stack",
      date: "2025-07-23",
      page: 188,
      footnote: 984,
      kind: "executive_order",
      stage: "authorized",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "An Executive Order established the AI Exports Program and coordinates with the Small Business Administration's Office of Investment and Innovation to channel investment into US small businesses developing AI technology.",
    },
    {
      slug: "americas-ai-action-plan",
      label: "America's AI Action Plan",
      date: "2025-07-23",
      page: 188,
      footnote: 985,
      kind: "strategy_document",
      stage: "announced",
      targeting: "general",
      attribution: "unilateral",
      classification: "weak",
      interpretation_sensitive: true,
      quote:
        "America's AI Action Plan, a general strategy to accelerate US AI innovation, suggests supporting SME participation in open-source models and encourages SME access to large-scale computing power.",
    },
    {
      slug: "genesis-mission",
      label: "Genesis Mission AI platform",
      date: "2025-11-24",
      page: 189,
      footnote: 986,
      kind: "strategy_document",
      stage: "announced",
      targeting: "general",
      attribution: "unilateral",
      classification: "weak",
      interpretation_sensitive: true,
      quote:
        "The White House launched the Genesis Mission, an integrated AI platform using Federal scientific datasets, which will help private-sector businesses like SMEs automate research workflows.",
    },
    {
      slug: "dol-ai-literacy-framework",
      label: "Department of Labor AI Literacy Framework",
      date: "2026-02-13",
      page: 189,
      footnote: 987,
      kind: "training_program",
      stage: "operational",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The Department of Labor released an AI Literacy Framework with five content areas and seven delivery principles to guide AI literacy across workforce systems, including SMEs.",
    },
    {
      slug: "india-summit-world-bank-fund",
      label: "India AI Impact Summit initiatives + World Bank SME fund",
      date: "2026-02-20",
      page: 189,
      footnote: 988,
      kind: "financing_program",
      stage: "announced",
      targeting: "explicit",
      attribution: "joint",
      classification: "strong",
      quote:
        "Michael Kratsios announced sending the US Tech Corps to partner nations and opening a World Bank fund to help countries overcome barriers to adopting AI in SMEs.",
    },
    {
      slug: "national-policy-framework-ai",
      label: "National Policy Framework for Artificial Intelligence",
      date: "2026-03-20",
      page: 189,
      footnote: 989,
      kind: "strategy_document",
      stage: "proposed",
      targeting: "general",
      attribution: "unilateral",
      classification: "weak",
      interpretation_sensitive: true,
      quote:
        "The National Policy Framework for AI calls for Congress to provide grants, tax incentives and technical assistance to support AI adoption; these measures remain in the recommendation phase.",
    },
  ],
};

// --- European Union: +1  (8 strong, 3 weak) ---------------------------------
const europeanUnion: MemberSeed = {
  id: "european_union",
  code: "eu",
  name: "European Union",
  published: "+1",
  analyst: "Jeanne Brownewell",
  sectionPage: 190,
  actions: [
    {
      slug: "ai-act-advisory-forum",
      label: "AI Act Advisory Forum call",
      date: "2025-07-17",
      page: 190,
      footnote: 990,
      kind: "advisory_forum",
      stage: "announced",
      targeting: "indirect",
      attribution: "unilateral",
      classification: "weak",
      quote:
        "The European Commission launched a call for stakeholders to join the AI Act Advisory Forum, a platform for SMEs to voice concerns and suggestions.",
    },
    {
      slug: "apply-ai-strategy",
      label: "Apply AI Strategy",
      date: "2025-10-08",
      page: 190,
      footnote: 991,
      kind: "strategy_document",
      stage: "launched",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The Commission launched the Apply AI Strategy with sector-specific investment initiatives to support SMEs implementing and scaling AI solutions using European open-source AI.",
    },
    {
      slug: "ai-in-science-raise",
      label: "AI in Science strategy + RAISE (EUR600M Horizon compute)",
      date: "2025-10-08",
      page: 190,
      footnote: 992,
      kind: "compute_funding_program",
      stage: "funded",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The AI in Science strategy uses the RAISE virtual institute, with EUR600 million from Horizon Europe to support startup access to computational power.",
      amount: { value: "600000000", currency: "EUR", bound: "at_least" },
    },
    {
      slug: "ai-act-service-desk",
      label: "AI Act Service Desk and Single Information Platform",
      date: "2025-10-08",
      page: 190,
      footnote: 993,
      kind: "toolkit",
      stage: "operational",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The Commission launched the AI Act Service Desk and Single Information Platform with a Compliance Checker and AI Act Explorer to help SMEs navigate AI regulations.",
    },
    {
      slug: "ai-factories-six-new",
      label: "Six new AI Factories",
      date: "2025-10-10",
      page: 190,
      footnote: 994,
      kind: "compute_infrastructure",
      stage: "announced",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The Commission announced building six new AI Factories providing AI-optimized supercomputers and technical support to startups and SMEs.",
    },
    {
      slug: "seventh-ai-pact-webinar",
      label: "Seventh AI Pact webinar for SMEs",
      date: "2025-10-21",
      page: 191,
      footnote: 995,
      kind: "webinar",
      stage: "operational",
      targeting: "indirect",
      attribution: "unilateral",
      classification: "weak",
      quote:
        "The Commission announced the seventh AI Pact webinar on AI Innovation for SMEs and startups, explaining how to navigate regulatory compliance.",
    },
    {
      slug: "european-data-union-strategy",
      label: "European Data Union Strategy",
      date: "2025-11-19",
      page: 191,
      footnote: 996,
      kind: "data_infrastructure",
      stage: "launched",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The European Data Union Strategy increases the availability of cheap, high-quality data sets to train AI tools in SMEs and streamlines data regulations.",
    },
    {
      slug: "apply-ai-manufacturing-tef",
      label: "Apply AI manufacturing actions + Testing and Experimentation Facilities",
      date: "2025-11-28",
      page: 191,
      footnote: 997,
      kind: "compute_infrastructure",
      stage: "operational",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The Commission funded Acceleration Pipelines and Testing and Experimentation Facilities allowing SMEs to trial, validate and certify AI-enabled technologies.",
    },
    {
      slug: "eesc-commercialization-call",
      label: "EESC call for AI commercialization measures",
      date: "2026-01-21",
      page: 191,
      footnote: 998,
      kind: "advisory_opinion",
      stage: "proposed",
      targeting: "indirect",
      attribution: "external",
      classification: "weak",
      quote:
        "The European Economic and Social Committee called for rapid measures to accelerate AI commercialization for SMEs, endorsing the Apply AI Strategy.",
    },
    {
      slug: "apply-ai-framework-innovation-hubs",
      label: "Apply AI Strategy framework + European Digital Innovation Hubs",
      date: "2026-03-27",
      page: 191,
      footnote: 999,
      kind: "policy_framework",
      stage: "operational",
      targeting: "explicit",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The Commission advanced the Apply AI Strategy with sector-specific measures, European Digital Innovation Hubs, AI Factories and regulatory sandboxes to boost AI adoption among SMEs.",
    },
    {
      slug: "ai-continent-action-plan",
      label: "AI Continent Action Plan",
      date: "2026-04-09",
      page: 192,
      footnote: 1000,
      kind: "compute_infrastructure",
      stage: "announced",
      targeting: "materially_inclusive",
      attribution: "unilateral",
      classification: "strong",
      quote:
        "The AI Continent Action Plan expands AI computing infrastructure through AI Factories and Gigafactories and supports AI adoption among enterprises via the AI Skills Academy and Digital Innovation Hubs.",
    },
  ],
};

/** All eight subjects, in the report's Assessment-table order. */
export const MEMBERS: readonly MemberSeed[] = [
  canada,
  france,
  germany,
  italy,
  japan,
  unitedKingdom,
  unitedStates,
  europeanUnion,
];
