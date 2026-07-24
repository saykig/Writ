import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Playground } from "@/components/playground/playground";
import { PageHeader } from "@/components/site/page-header";
import { g7AssessmentPreview, g7AssessmentPreviews, g7EvidenceView } from "@/lib/g7-assessments";
import { analyze, compile, evaluateMember, loadExamples } from "@/lib/toolchain";

export function generateStaticParams() {
  return g7AssessmentPreviews().map((member) => ({ member: member.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ member: string }>;
}): Promise<Metadata> {
  const { member } = await params;
  const assessment = g7AssessmentPreview(member);
  if (!assessment) return {};
  return {
    title: `${assessment.name}’s assessment · Writ`,
    description: `See how the G7 methodology was translated into Writ and applied to ${assessment.name}’s reviewed evidence.`,
  };
}

export default async function G7MemberLabPage({ params }: { params: Promise<{ member: string }> }) {
  const { member } = await params;
  const assessment = g7AssessmentPreview(member);
  if (!assessment) notFound();

  const examples = loadExamples();
  const resolvedExample = examples.find((example) => example.id === "resolved");
  const receipt = evaluateMember(assessment.id, "published");
  const evidence = g7EvidenceView(assessment.id);
  if (!resolvedExample || !receipt || !evidence) notFound();
  const compiled = compile(resolvedExample.source);
  const analyzed = analyze(resolvedExample.source);
  const initialCompile = {
    ...compiled,
    diagnostics: [...compiled.diagnostics],
    schemaErrors: [...compiled.schemaErrors],
  };
  const initialAnalysis = {
    ...analyzed,
    diagnostics: [...analyzed.diagnostics],
    findings: [...analyzed.findings],
  };

  return (
    <main>
      <PageHeader
        eyebrow="2025 G7 assessment · Writ Lab"
        title={`${assessment.name}’s assessment`}
        description={`See how the G7 methodology was translated into Writ and applied to ${assessment.name}’s reviewed evidence.`}
      />
      <Playground
        initialExample="resolved"
        initialExamples={examples}
        initialMember={assessment.id}
        initialReceipt={receipt}
        initialEvidence={evidence}
        lockInitialMember
        initialResultTab="receipt"
        initialCompile={initialCompile}
        initialAnalysis={initialAnalysis}
      />
    </main>
  );
}
