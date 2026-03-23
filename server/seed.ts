import { db } from "./db";
import { sessions, topics, partners } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existingSessions = await db.select().from(sessions);
  if (existingSessions.length > 0) return;

  const [partner1] = await db.insert(partners).values({
    name: "CloudBridge Solutions",
    specialties: ["AWS", "Azure", "GCP", "cloud migration", "Kubernetes"],
    contactInfo: "partnerships@cloudbridge.io",
    notes: "Primary cloud infrastructure partner. Strong Kubernetes and multi-cloud expertise.",
  }).returning();

  const [partner2] = await db.insert(partners).values({
    name: "SecureOps Group",
    specialties: ["Splunk", "CrowdStrike", "SIEM", "penetration testing", "compliance", "zero trust"],
    contactInfo: "team@secureopsgroup.com",
    notes: "Cybersecurity partner. Certified Splunk and CrowdStrike reseller.",
  }).returning();

  const [partner3] = await db.insert(partners).values({
    name: "DataFlow Analytics",
    specialties: ["Snowflake", "Databricks", "Power BI", "Tableau", "data engineering"],
    contactInfo: "hello@dataflowanalytics.com",
    notes: "Data & analytics partner. Snowflake Elite Services partner.",
  }).returning();

  const [session1] = await db.insert(sessions).values({
    title: "Azure Migration Planning",
    clientName: "Acme Corp",
    status: "completed",
    totalTopics: 8,
    transcript: "[Sarah Chen] We need to discuss migrating the on-premises infrastructure to Azure. The team has proposed using Azure Kubernetes Service for container orchestration and Azure DevOps for the CI/CD pipeline.\n\n[Mark Rodriguez] I agree with Sarah. Security concerns were raised about identity management, so we should implement Azure Active Directory with conditional access policies. The database layer will use Azure SQL with geo-replication for disaster recovery.\n\n[Sarah Chen] Good points, Mark. We also need to use Terraform for infrastructure as code to ensure reproducible deployments across environments. The monitoring solution will leverage Datadog for observability across the stack.\n\n[Mark Rodriguez] That sounds like a solid plan. I'm optimistic about the timeline if we can get CloudBridge Solutions involved early.",
    overallSentiment: 35,
    sentimentData: [
      { chunkIndex: 0, score: 20, label: "positive", speaker: "Sarah Chen" },
      { chunkIndex: 1, score: 30, label: "positive", speaker: "Mark Rodriguez" },
      { chunkIndex: 2, score: 40, label: "positive", speaker: "Sarah Chen" },
      { chunkIndex: 3, score: 50, label: "positive", speaker: "Mark Rodriguez" },
    ],
    summary: "The discussion centered on migrating Acme Corp's on-premises infrastructure to Microsoft Azure, with Azure Kubernetes Service identified as the primary container orchestration platform. Sarah Chen led the conversation, proposing Azure DevOps for CI/CD automation while Mark Rodriguez emphasized the importance of Azure Active Directory with conditional access for identity management.\n\nTerraform was selected as the Infrastructure as Code tool to ensure reproducible deployments, and Datadog will serve as the observability platform across the stack. The database strategy will rely on Azure SQL with geo-replication for disaster recovery, reflecting a thoughtful approach to resilience.\n\nBoth participants expressed optimism about the timeline, particularly if CloudBridge Solutions can be brought in early as a partner for the cloud migration work. The overall tone was constructive and forward-looking, with strong alignment on the technical direction.",
    endedAt: new Date(Date.now() - 86400000),
  }).returning();

  const [session2] = await db.insert(sessions).values({
    title: "Security Audit Review",
    clientName: "TechStart Inc",
    status: "completed",
    totalTopics: 7,
    transcript: "[Priya Patel] The security audit revealed several critical findings. We need to implement zero trust architecture across all microservices immediately. This is a serious gap in our security posture.\n\n[David Kim] That's concerning, Priya. The team recommended adopting SASE for network security and moving to a Splunk-based SIEM solution for better threat detection.\n\n[Priya Patel] CrowdStrike was discussed for endpoint protection across the fleet. I'm worried about the current exposure. OAuth 2.0 implementation needs updating to support PKCE flow for public clients.\n\n[David Kim] On a more positive note, API gateway rate limiting should be straightforward to configure. SecureOps Group has been very responsive and I think they can help us close these gaps quickly.",
    overallSentiment: -15,
    sentimentData: [
      { chunkIndex: 0, score: -40, label: "negative", speaker: "Priya Patel" },
      { chunkIndex: 1, score: -25, label: "negative", speaker: "David Kim" },
      { chunkIndex: 2, score: -30, label: "negative", speaker: "Priya Patel" },
      { chunkIndex: 3, score: 35, label: "positive", speaker: "David Kim" },
    ],
    summary: "A security audit of TechStart Inc's infrastructure uncovered several critical vulnerabilities that demand immediate attention. Priya Patel expressed serious concern about the absence of a zero trust architecture across the organization's microservices, describing it as a significant gap in their security posture.\n\nThe team evaluated multiple remediation strategies, including adopting SASE for network security and deploying a Splunk-based SIEM solution for improved threat detection. CrowdStrike emerged as the leading candidate for endpoint protection across the fleet, and an overdue update to OAuth 2.0 with PKCE flow for public clients was flagged.\n\nDespite the gravity of the findings, David Kim struck an optimistic note about API gateway rate limiting and praised SecureOps Group's responsiveness as a partner capable of helping close the security gaps quickly.",
    endedAt: new Date(Date.now() - 172800000),
  }).returning();

  const [session3] = await db.insert(sessions).values({
    title: "DevOps Pipeline Optimization",
    clientName: "GlobalTech Solutions",
    status: "completed",
    totalTopics: 6,
    transcript: "[James Park] The current Jenkins pipeline has build times exceeding 45 minutes and it's really hurting our velocity. We're evaluating GitHub Actions as a replacement with matrix builds for parallel testing.\n\n[Lisa Wang] That's exciting, James. Container image scanning with Trivy will be integrated into the pipeline. The team also discussed implementing GitOps with ArgoCD for Kubernetes deployments.\n\n[James Park] We'll be using Helm charts for application packaging. I'm really excited about the performance improvements we're seeing in the prototypes.\n\n[Lisa Wang] Agreed! Jira integration needs improvement for tracking deployment tickets, but overall I think this is going to be a huge improvement for the team.",
    overallSentiment: 45,
    sentimentData: [
      { chunkIndex: 0, score: -10, label: "neutral", speaker: "James Park" },
      { chunkIndex: 1, score: 50, label: "positive", speaker: "Lisa Wang" },
      { chunkIndex: 2, score: 60, label: "very_positive", speaker: "James Park" },
      { chunkIndex: 3, score: 55, label: "positive", speaker: "Lisa Wang" },
    ],
    summary: "GlobalTech Solutions' development team is tackling a significant bottleneck in their CI/CD process, with Jenkins build times exceeding 45 minutes and severely impacting developer velocity. James Park proposed migrating to GitHub Actions with matrix builds for parallel testing, a move that both participants greeted with enthusiasm.\n\nThe modernization plan extends beyond the build system. Container image scanning with Trivy will be embedded directly in the pipeline, and ArgoCD was selected to implement a GitOps workflow for Kubernetes deployments. Helm charts will handle application packaging, providing versioned and repeatable deployment processes.\n\nWhile Jira integration for tracking deployment tickets still needs improvement, the team is energized by early prototype results showing substantial performance gains. The conversation had a distinctly upbeat trajectory, shifting from initial frustration with Jenkins to genuine excitement about the new toolchain.",
    endedAt: new Date(Date.now() - 259200000),
  }).returning();

  await db.insert(topics).values([
    { sessionId: session1.id, term: "Azure Kubernetes Service", definition: "Microsoft's managed Kubernetes offering that simplifies deploying, managing, and scaling containerized applications using Kubernetes in Azure cloud.", category: "cloud", type: "tool", capabilitySource: "partner", partnerName: "CloudBridge Solutions", mentionCount: 3 },
    { sessionId: session1.id, term: "Azure DevOps", definition: "Microsoft's suite of development tools providing CI/CD pipelines, version control, project tracking, and artifact management.", category: "devops", type: "tool", capabilitySource: "in-house", mentionCount: 2 },
    { sessionId: session1.id, term: "CI/CD Pipeline", definition: "Continuous Integration and Continuous Delivery/Deployment automation that enables frequent, reliable software releases through build, test, and deployment automation.", category: "devops", type: "concept", capabilitySource: "in-house", mentionCount: 2 },
    { sessionId: session1.id, term: "Azure Active Directory", definition: "Microsoft's cloud-based identity and access management service for managing user authentication and authorization across applications.", category: "security", type: "tool", capabilitySource: "in-house", mentionCount: 2 },
    { sessionId: session1.id, term: "Terraform", definition: "Infrastructure as Code tool by HashiCorp that enables defining and provisioning data center infrastructure using a declarative configuration language.", category: "infrastructure", type: "tool", capabilitySource: "in-house", mentionCount: 1 },
    { sessionId: session1.id, term: "Azure SQL", definition: "Fully managed relational database service in Azure that provides SQL Server compatibility with built-in intelligence and security.", category: "cloud", type: "tool", capabilitySource: "partner", partnerName: "CloudBridge Solutions", mentionCount: 1 },
    { sessionId: session1.id, term: "Geo-replication", definition: "Database feature that maintains readable secondary databases in different geographic regions for disaster recovery and read scaling.", category: "data", type: "concept", capabilitySource: "unknown", mentionCount: 1 },
    { sessionId: session1.id, term: "Datadog", definition: "Cloud-scale monitoring and analytics platform providing infrastructure monitoring, APM, log management, and security monitoring.", category: "monitoring", type: "tool", capabilitySource: "in-house", mentionCount: 1 },

    { sessionId: session2.id, term: "Zero Trust Architecture", definition: "Security model that requires strict identity verification for every person and device trying to access resources, regardless of network location.", category: "security", type: "concept", capabilitySource: "partner", partnerName: "SecureOps Group", mentionCount: 4 },
    { sessionId: session2.id, term: "Splunk", definition: "Data analytics and SIEM platform for searching, monitoring, and analyzing machine-generated data for security and operational intelligence.", category: "monitoring", type: "tool", capabilitySource: "partner", partnerName: "SecureOps Group", mentionCount: 2 },
    { sessionId: session2.id, term: "CrowdStrike", definition: "Cloud-native endpoint protection platform providing next-gen antivirus, endpoint detection and response (EDR), and threat intelligence.", category: "security", type: "tool", capabilitySource: "partner", partnerName: "SecureOps Group", mentionCount: 2 },
    { sessionId: session2.id, term: "SASE", definition: "Secure Access Service Edge - a network architecture combining WAN capabilities with cloud-native security functions like SWG, CASB, and ZTNA.", category: "networking", type: "concept", capabilitySource: "unknown", mentionCount: 2 },
    { sessionId: session2.id, term: "OAuth 2.0 PKCE", definition: "Proof Key for Code Exchange - an OAuth 2.0 extension that protects authorization code flow for public clients like mobile and SPA applications.", category: "security", type: "concept", capabilitySource: "in-house", mentionCount: 1 },
    { sessionId: session2.id, term: "API Gateway", definition: "Server that acts as a single entry point for API requests, providing routing, rate limiting, authentication, and monitoring capabilities.", category: "infrastructure", type: "concept", capabilitySource: "in-house", mentionCount: 1 },
    { sessionId: session2.id, term: "SIEM", definition: "Security Information and Event Management - software that aggregates and analyzes security data from across an organization for threat detection.", category: "security", type: "concept", capabilitySource: "partner", partnerName: "SecureOps Group", mentionCount: 2 },

    { sessionId: session3.id, term: "GitHub Actions", definition: "CI/CD platform integrated into GitHub that automates build, test, and deployment workflows directly from repositories.", category: "devops", type: "tool", capabilitySource: "in-house", mentionCount: 3 },
    { sessionId: session3.id, term: "ArgoCD", definition: "Declarative GitOps continuous delivery tool for Kubernetes that automates application deployment by syncing desired state from Git repositories.", category: "devops", type: "tool", capabilitySource: "in-house", mentionCount: 2 },
    { sessionId: session3.id, term: "Trivy", definition: "Open-source vulnerability scanner for containers, filesystems, and Git repositories that detects security issues in OS packages and application dependencies.", category: "security", type: "tool", capabilitySource: "in-house", mentionCount: 1 },
    { sessionId: session3.id, term: "Helm Charts", definition: "Package manager for Kubernetes that bundles related resources into charts for repeatable, versioned application deployments.", category: "devops", type: "tool", capabilitySource: "in-house", mentionCount: 1 },
    { sessionId: session3.id, term: "Jira", definition: "Atlassian's project management and issue tracking tool widely used for agile software development, sprint planning, and workflow management.", category: "collaboration", type: "tool", capabilitySource: "in-house", mentionCount: 1 },
    { sessionId: session3.id, term: "Jenkins", definition: "Open-source automation server for building, testing, and deploying software through continuous integration and continuous delivery pipelines.", category: "devops", type: "tool", capabilitySource: "in-house", mentionCount: 1 },
  ]);

  console.log("Database seeded with sample sessions, topics, and partners");
}
