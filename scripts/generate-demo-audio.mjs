/**
 * One-time script: generates TTS MP3 files for the demo voiceovers.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/generate-demo-audio.mjs
 *   # or, if you have a .env file:
 *   npx dotenv -e .env -- node scripts/generate-demo-audio.mjs
 *
 * Output: public/demo-audio/demo-{0-7}.mp3  and  ae-demo-{0-7}.mp3
 * These are served statically by Vite (dev) and bundled in dist/ (prod).
 */

import OpenAI from "openai";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, "../public/demo-audio");

const apiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
if (!apiKey) {
  console.error("Error: OPENAI_API_KEY environment variable is not set.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

// ── Demo chunks (Cloud Migration Review) ──────────────────────────────────────
const DEMO_CHUNKS = [
  "Hi everyone, I'm Sarah Chen, the project lead. Let's kick off this cloud migration review. The first thing we need to address is our current on-prem infrastructure. We've been running VMware vSphere for virtualization, but the license costs are getting out of hand and it's really frustrating.",
  "Thanks Sarah. I'm Mark Rodriguez from infrastructure. I agree, the costs are unsustainable. We've been evaluating both AWS and Azure for the migration. Our CloudBridge Solutions team has done a proof of concept with Azure Kubernetes Service, and the results look very promising for containerizing our legacy workloads.",
  "Good points, Mark. This is Priya Patel from security. Before we go further on the cloud side, I want to flag some serious security concerns. Our CISO wants us to implement zero trust architecture across all services. That means we need to completely rethink how we handle identity and access management.",
  "I hear you, Priya. SecureOps Group recommended we deploy CrowdStrike for endpoint detection and response across the fleet, and integrate Splunk as our SIEM solution for centralized threat monitoring. I feel much more confident with those tools in place.",
  "Hey team, James Park here from DevOps. On the DevOps side, we're excited to replace our aging Jenkins pipelines with GitHub Actions. The team has already prototyped matrix builds that cut our CI/CD pipeline time from forty-five minutes down to twelve. That's a huge win!",
  "Great progress, James. Sarah again. We should also talk about observability. I think we need Datadog for APM and infrastructure monitoring, plus Grafana dashboards for the ops team. We can use Terraform to provision everything as infrastructure as code.",
  "This is Lisa Wang from the data team. For the database layer, we're pushing for Snowflake as our cloud data warehouse. DataFlow Analytics, our partner, has been building the ETL pipelines using Databricks and they're seeing great performance. Really excited about the possibilities.",
  "Last item from me — Sarah here. We need to set up proper incident management. I'm worried we don't have a good process right now. I'm thinking PagerDuty for alerting integrated with our Jira boards, and we should adopt the SRE model with defined SLOs and error budgets for each service.",
];

// Sarah=nova, Mark=onyx, Priya=shimmer, unnamed=fable, James=echo, Lisa=alloy
const DEMO_VOICES = ["nova", "onyx", "shimmer", "fable", "echo", "nova", "alloy", "nova"];

// ── AE demo chunks (Meridian Financial Sales Discovery) ───────────────────────
const AE_DEMO_CHUNKS = [
  "Good morning Jennifer, Raj — thank you both for making the time today. I'm Alex Park, PreSales Architect at NRI North America. Before we dive in, I want to let my colleague introduce himself, and then we'd love to hear from your side as well. Our plan for today is introductions, then we'll spend most of our time understanding Meridian's current landscape and where you're looking to go. Does that agenda work for everyone?",
  "Thanks Alex. Hi everyone, I'm David Chen, Account Executive at NRI. I cover financial services clients across the Northeast, and I've been looking forward to this conversation. We've done quite a bit of work in the wealth management and banking space, so I'm genuinely excited to learn more about what Meridian is working through.",
  "Thank you both. Jennifer Walsh, CTO at Meridian Financial. We're a mid-size wealth management and lending firm — around eighteen hundred employees across twelve offices. I'll let Raj introduce himself as well, and then I'll walk you through why we reached out.",
  "Raj Patel, CISO at Meridian. I'm joining primarily from a security and compliance angle. Any cloud migration we undertake has to meet our FedRAMP and SOC 2 obligations, so I'll be involved in evaluating any vendor or architecture decisions we move forward with.",
  "So — the reason we reached out is that our on-premises data infrastructure has become a serious liability. We're running a fifteen-year-old Oracle data warehouse on aging HPE hardware, and the maintenance cost and risk of failure have honestly reached a tipping point. We had an unplanned outage in January that took our entire reporting environment down for six hours. For a financial services firm, that is simply not acceptable. On top of that, we're under increasing OCC and SEC scrutiny, and our current environment makes producing audit trails incredibly painful — our compliance team spends weeks manually pulling data for each examination.",
  "Jennifer, that context is really helpful. The January outage and the compliance exposure sound like the key drivers here. I want to make sure we understand the decision and investment landscape correctly — who else is at the table for a project of this scope? And has the board given any direction on budget or appetite for this kind of migration?",
  "The board approved a digital infrastructure modernization budget right after the January outage. I own the technology roadmap and the vendor selection — that's within my remit. We've earmarked six hundred thousand dollars for the platform migration in this fiscal year, with a phase two budget of similar size for the analytics layer. Raj has final sign-off on any cloud architecture from a security standpoint. On timeline — we have an OCC examination scheduled for September, which means we need to be fully operational and auditable by end of July. That means a signed engagement by end of May at the absolute latest.",
  "Sorry to jump in here — I'm joining from the finance team. I just want to flag that any spend above five hundred thousand typically goes through an additional board approval cycle, so the six hundred K figure may need to be structured carefully across fiscal quarters to stay within delegated authority limits.",
  "That's a really important point, and I appreciate you flagging it. We can absolutely work with you on phasing the engagement to fit within those approval thresholds — that's something we've navigated before with other clients in regulated industries. Jennifer, Raj — given the hard July deadline, I'd like to propose a four-week architecture assessment as a concrete first step. It gives us something to bring back to the board, with compliance and data lineage baked in from day one. Before we close out today, are there any other stakeholders we should loop in for the assessment kickoff?",
  "Before we go any further on document sharing — and I appreciate the offer of the architecture documentation — I need to flag that any exchange of sensitive infrastructure details, including our Oracle schema or the OCC exam report, will require a mutual NDA to be in place first. That is a hard requirement from our legal team. I don't want it to slow things down, but it can't be an afterthought either.",
  "Raj, completely understood, and we wouldn't have it any other way. Let's make getting the mutual NDA signed action item number one. David will reach out to your legal contact by end of this week to get that process started. We've done this with other regulated clients and we can typically turn it around within a few business days. Once it's signed we are ready to move immediately on the architecture documentation.",
  "Perfect. So our action items: number one, mutual NDA — David and Raj's legal team to coordinate by end of week. Number two, Raj sends the security questionnaire once the NDA is in place. Number three, I'll share the architecture documentation and the OCC exam report. Number four, Alex delivers a brief scope document for the four-week assessment. And let's reconnect next Thursday to confirm everything is in motion before end of month. Thanks everyone — this was a productive first conversation.",
];

// Alex Park=onyx, David Chen=echo, Jennifer Walsh=nova, Raj Patel=fable, Speaker 1=alloy
const AE_DEMO_VOICES = ["onyx", "echo", "nova", "fable", "nova", "onyx", "nova", "alloy", "onyx", "fable", "onyx", "nova"];

// ── Generation ────────────────────────────────────────────────────────────────
async function generateChunk(text, voice, filename) {
  const filePath = path.join(outputDir, filename);
  if (existsSync(filePath)) {
    console.log(`  skip  ${filename} (already exists)`);
    return;
  }
  console.log(`  gen   ${filename} (voice: ${voice}, ${text.length} chars)`);
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice,
    input: text,
    response_format: "mp3",
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, buffer);
}

await mkdir(outputDir, { recursive: true });

console.log("\nGenerating Cloud Migration Review voiceovers…");
for (let i = 0; i < DEMO_CHUNKS.length; i++) {
  await generateChunk(DEMO_CHUNKS[i], DEMO_VOICES[i], `demo-${i}.mp3`);
}

console.log("\nGenerating Meridian Financial Sales Discovery voiceovers…");
for (let i = 0; i < AE_DEMO_CHUNKS.length; i++) {
  await generateChunk(AE_DEMO_CHUNKS[i], AE_DEMO_VOICES[i], `ae-demo-${i}.mp3`);
}

console.log("\nDone. Files written to public/demo-audio/");
