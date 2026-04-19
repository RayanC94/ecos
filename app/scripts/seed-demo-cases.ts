/**
 * Seed 10 curated patient-simulé demo cases into Supabase.
 *
 * Requires:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY   (bypasses RLS for writes)
 *   - The schema must be applied first — see supabase/migrations/001_initial_schema.sql
 *
 * Writes app/scripts/output/demo-cases.json as a side-effect.
 *
 * Run:  npx tsx scripts/seed-demo-cases.ts
 * Dry run (no DB write):  npx tsx scripts/seed-demo-cases.ts --dry
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const OUTPUT_DIR = path.resolve(__dirname, "output");
const CASES_FILE = path.join(OUTPUT_DIR, "patient-simule-cases-with-annexes.json");
const DEMO_OUT = path.join(OUTPUT_DIR, "demo-cases.json");

// 10 curated IDs: diverse specialties + mix of annex types (ECG, lab tables, imagery, photos)
const DEMO_IDS = [
  "sdd-147-1-sdd-147-epistaxis",                        // ORL — épistaxis
  "sdd-193-1-sdd-193-anomalie-de-l-eps",                // Hémato — myélome (EPS)
  "sdd-161-2-sdd-161-douleur-thoracique-suj",           // Cardio — péricardite (ECG)
  "sdd-283-1-sdd-283-consultation-de-suivi-",           // Pneumo — suivi asthme
  "sdd-50-1-sdd-50-malaise-perte-de-connai",            // Urgences — malaise/PC (ECG + doc)
  "sdd-138-2-des-n-1-chirurgie-t-te-et-cou-",           // Ophtalmo — trouble vision
  "sdd-45-1-des-n-3-m-decine-de-l-aigu-mar",            // Urgences — hypothermie
  "sdd-151-1-des-n-3-m-decine-de-l-aigu-mar",           // Urgences — anaphylaxie
  "sdd-87-2-sdd-87-grosse-jambe-rouge-aigu",            // Vasculaire — grosse jambe rouge
  "sdd-304-1-sdd-304-d-pistage-diab-te-gest",           // Gynéco — diabète gestationnel
];

type RawCase = {
  id: string;
  sdd_number: number | null;
  subject_number: number | null;
  title: string;
  specialty: string;
  des_group: number;
  format: string;
  source_pdf: string;
  metadata: unknown;
  student_instructions: unknown;
  patient: unknown;
  qa_pairs: unknown;
  conditional_responses: unknown;
  evaluation_grid: unknown;
  reference_sheet: string | null;
  iconography: unknown;
};

async function main() {
  const dryRun = process.argv.includes("--dry");
  if (!fs.existsSync(CASES_FILE)) {
    console.error(`ERROR: ${CASES_FILE} not found. Run extract-annexes.ts first.`);
    process.exit(1);
  }
  const allCases = JSON.parse(fs.readFileSync(CASES_FILE, "utf8")) as RawCase[];
  const byId = new Map(allCases.map((c) => [c.id, c]));

  const demoCases: RawCase[] = [];
  for (const id of DEMO_IDS) {
    const c = byId.get(id);
    if (!c) {
      console.warn(`  ⚠  Demo case not found: ${id}`);
      continue;
    }
    demoCases.push(c);
  }
  console.log(`Selected ${demoCases.length}/${DEMO_IDS.length} demo cases\n`);

  fs.writeFileSync(DEMO_OUT, JSON.stringify(demoCases, null, 2));
  console.log(`Wrote ${DEMO_OUT}`);

  if (dryRun) {
    console.log("\n[DRY RUN] Skipping DB insert.");
    printSummary(demoCases);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  console.log(`Connected to Supabase ${url}\n`);

  // Upsert all demo cases in a single batch.
  const rows = demoCases.map((c) => ({
    id: c.id,
    sdd_number: c.sdd_number ?? 0,
    subject_number: c.subject_number ?? 1,
    title: c.title,
    specialty: c.specialty,
    des_group: c.des_group,
    format: c.format,
    source_pdf: c.source_pdf,
    metadata: c.metadata ?? {},
    student_instructions: c.student_instructions ?? {},
    patient: c.patient ?? null,
    qa_pairs: c.qa_pairs ?? [],
    conditional_responses: c.conditional_responses ?? [],
    evaluation_grid: c.evaluation_grid ?? { tasks: [], communication_rubrics: [] },
    reference_sheet: c.reference_sheet ?? null,
    iconography: c.iconography ?? [],
  }));

  const { data, error } = await supabase
    .from("cases")
    .upsert(rows, { onConflict: "id" })
    .select("id");

  if (error) {
    console.error("Upsert error:", error);
    process.exit(1);
  }
  console.log(`Upserted ${(data ?? []).length} case(s).`);

  printSummary(demoCases);
}

function printSummary(demoCases: RawCase[]) {
  console.log("\n=== DEMO CASES ===");
  for (const c of demoCases) {
    const annexes = Array.isArray(c.iconography) ? (c.iconography as unknown[]).length : 0;
    console.log(`  ${c.id}`);
    console.log(`    ${c.title}`);
    console.log(`    format=${c.format}  annexes=${annexes}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
