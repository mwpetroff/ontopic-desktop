export interface FeatureFlags {
  actionItems?: boolean;
  followUpQuestions?: boolean;
  similarProjects?: boolean;
  bantTracking?: boolean;
  methodologyTracking?: boolean;
  // SA
  competitorMentions?: boolean;
  // PM
  timelineSignals?: boolean;
  riskFlags?: boolean;
  // BA
  requirements?: boolean;
  painPoints?: boolean;
}

export function featuresForRole(role: string, salesMethodology?: string | null): FeatureFlags {
  const base: FeatureFlags = {
    actionItems: true,
    followUpQuestions: true,
    similarProjects: true,
  };
  switch (role) {
    case "host":
      return { ...base, competitorMentions: true };
    case "engineer":
      return { ...base };
    case "producer":
      return { ...base, timelineSignals: true, riskFlags: true };
    case "correspondent":
      return { ...base, requirements: true, painPoints: true };
    case "account-executive":
      return {
        ...base,
        bantTracking: true,
        methodologyTracking: !!(salesMethodology),
      };
    default:
      return base;
  }
}

export const HOST_ROLE_LABELS: Record<string, string> = {
  host: "PreSales Solutions Architect",
  producer: "Project Manager",
  engineer: "Technical Resource / Solutions Engineer",
  correspondent: "Business Analyst",
  "account-executive": "Account Executive",
};

export const HOST_ROLE_ACTION_FOCUS: Record<string, string> = {
  host: "Focus on technical discovery actions: POCs, demos, architecture reviews, vendor evaluations, competitive analysis tasks, and solution validation steps.",
  producer: "Focus on project management actions: timeline milestones, resource assignments, risk mitigations, status updates, stakeholder approvals, and delivery commitments.",
  engineer: "Focus on technical implementation actions: architecture decisions, integration tasks, performance benchmarks, technical debt remediation, and infrastructure changes.",
  correspondent: "Focus on business analysis actions: requirements documentation, process mapping, stakeholder interviews, ROI calculations, and gap analysis tasks.",
  "account-executive": "Focus on deal progression actions: sending proposals, scheduling discovery calls, arranging demos, securing executive meetings, getting pricing approved, and confirming next steps with the prospect.",
};

export const HOST_ROLE_FOLLOWUP_FOCUS: Record<string, string> = {
  host: "Think like a senior PreSales Solutions Architect. Ask questions about scalability, integration complexity, timeline risks, licensing implications, security gaps, migration path details, or TCO considerations. Be specific to what was discussed.",
  producer: "Think like an experienced Project Manager. Ask questions about timelines, resource availability, dependencies, risk factors, milestone definitions, budget constraints, and stakeholder sign-off requirements.",
  engineer: "Think like a seasoned Solutions Engineer. Ask questions about system architecture, API compatibility, performance requirements, data migration complexity, testing strategies, and infrastructure prerequisites.",
  correspondent: "Think like a sharp Business Analyst. Ask questions about business process impacts, user adoption, ROI expectations, compliance requirements, change management needs, and success metrics.",
  "account-executive": "Think like a strategic Account Executive focused on deal qualification. Ask questions to uncover or confirm BANT: probe for budget constraints, identify all decision makers and their authority, quantify the business pain and personal impact, and nail down hard timeline commitments and consequences of missing them. If a BANT element hasn't been confirmed yet, prioritize a question to uncover it.",
};

export const HOST_ROLE_SUMMARY_FOCUS: Record<string, string> = {
  host: "Emphasize technical discovery findings, solution fit, competitive positioning, and next steps for presales engagement.",
  producer: "Emphasize project timelines, resource needs, risk factors, deliverables, and stakeholder alignment.",
  engineer: "Emphasize architecture decisions, integration points, technical challenges, performance considerations, and implementation approaches.",
  correspondent: "Emphasize business requirements, process gaps, ROI implications, user impact, and stakeholder needs.",
  "account-executive": "Emphasize BANT qualification status (what has been confirmed and what remains unknown), the prospect's core pain and business impact, decision-making dynamics, and the agreed next steps to advance the deal.",
};

export interface MethodologyStageDefinition {
  id: string;
  name: string;
  description: string;
}

export const METHODOLOGY_STAGES: Record<string, MethodologyStageDefinition[]> = {
  sandler: [
    { id: "rapport", name: "Rapport & Upfront Contract", description: "Established rapport and set mutual expectations for the call structure and outcome" },
    { id: "pain-surface", name: "Surface Pain", description: "Prospect mentioned specific problems, frustrations, or challenges with the current situation" },
    { id: "pain-business", name: "Business Impact", description: "Pain was tied to measurable business consequences such as lost revenue, costs, or missed targets" },
    { id: "pain-personal", name: "Personal Impact", description: "The pain was connected to personal stakes for the decision maker (career, reputation, or pressure from leadership)" },
    { id: "budget", name: "Budget Discussion", description: "Budget range, allocated spend, or financial authority was discussed or confirmed" },
    { id: "decision", name: "Decision Process", description: "Decision makers, approval chain, evaluation process, or procurement steps were clarified" },
    { id: "fulfillment", name: "Fulfillment", description: "A solution was proposed that directly and specifically addresses the confirmed pain" },
    { id: "post-sell", name: "Post-Sell", description: "Concrete next steps were agreed upon to advance the deal (demo, POC, proposal, executive meeting)" },
  ],
  meddic: [
    { id: "metrics", name: "Metrics", description: "Quantified business impact identified — specific numbers, ROI, cost savings, or success criteria stated by the prospect" },
    { id: "economic-buyer", name: "Economic Buyer", description: "The person who controls the budget and can make or veto the final purchase decision was identified" },
    { id: "decision-criteria", name: "Decision Criteria", description: "The prospect's evaluation criteria, must-haves, or key requirements for choosing a vendor were understood" },
    { id: "decision-process", name: "Decision Process", description: "The formal procurement steps, approval chain, legal/security review, or timeline for a decision was mapped" },
    { id: "identify-pain", name: "Identify Pain", description: "A compelling, specific business challenge that creates urgency to act was confirmed from the prospect" },
    { id: "champion", name: "Champion", description: "An internal advocate who has influence, access to the economic buyer, and is actively selling internally on your behalf was identified" },
  ],
  spin: [
    { id: "situation", name: "Situation Questions", description: "Background facts about the prospect's current environment, tools, processes, and team were established" },
    { id: "problem", name: "Problem Questions", description: "Specific problems, difficulties, or dissatisfactions with the current situation were uncovered" },
    { id: "implication", name: "Implication Questions", description: "The downstream consequences and ripple effects of the problem were explored to build urgency" },
    { id: "need-payoff", name: "Need-Payoff Questions", description: "The prospect articulated the value of solving the problem, confirming that the solution is worth pursuing" },
  ],
  challenger: [
    { id: "warmer", name: "The Warmer", description: "Demonstrated specific knowledge of the prospect's business, industry trends, and challenges to establish credibility" },
    { id: "reframe", name: "The Reframe", description: "Introduced an unexpected insight or perspective that changes how the prospect thinks about their problem or opportunity" },
    { id: "rational-drowning", name: "Rational Drowning", description: "Backed the reframe with data, research, or ROI logic that makes the cost of inaction undeniable" },
    { id: "emotional-impact", name: "Emotional Impact", description: "Connected the business insight to a personal consequence for the decision maker, making it feel urgent and real" },
    { id: "new-way", name: "A New Way", description: "Presented a new approach or capability as the logical answer to the reframed problem" },
    { id: "your-solution", name: "Your Solution", description: "Mapped the specific solution to the reframed need, showing it as uniquely suited to address the insight" },
  ],
};

export const METHODOLOGY_LABELS: Record<string, string> = {
  sandler: "Sandler Selling",
  meddic: "MEDDIC",
  spin: "SPIN Selling",
  challenger: "Challenger Sale",
};
