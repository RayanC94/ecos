/**
 * Extract patient biometrics + vital signs from the source PDF and
 * merge into each case's `patient.clinical_data` when missing.
 *
 * Uses Claude Sonnet 4.6 reading the PDF text (pdftotext -layout).
 *
 * Run: npx tsx scripts/enrich-clinical-data.ts [--only <id>] [--force]
 *
 * Writes the same patient-simule-cases-with-annexes.json in place.
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { execSync } from "child_process";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const PDF_ROOT = path.resolve(__dirname, "../../Banque de sujets ECOS");
const OUTPUT_DIR = path.resolve(__dirname, "output");
const CASES_FILE = path.join(OUTPUT_DIR, "patient-simule-cases-with-annexes.json");
const REPORT_FILE = path.join(OUTPUT_DIR, "annexes-report.json");

const MODEL = "claude-sonnet-4-6";

type ClinicalData = {
  biometrics?: { height_cm?: number | null; weight_kg?: number | null; bmi?: number | null };
  vital_signs?: {
    blood_pressure?: string | null;
    heart_rate?: string | null;
    respiratory_rate?: string | null;
    spo2?: string | null;
    temperature?: string | null;
    blood_glucose?: string | null;
  };
  vital_signs_note?: string | null;
};

type Patient = { clinical_data?: ClinicalData | null; [k: string]: unknown };
type RawCase = { id: string; source_pdf: string; patient?: Patient; [k: string]: unknown };
type AnnexReport = { caseId: string; pdfPath: string | null };

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const ONLY_ID = argValue("--only");
const FORCE = process.argv.includes("--force");

function pdfText(pdfPath: string): string {
  try {
    return execSync(`pdftotext -layout ${JSON.stringify(pdfPath)} -`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

const SYSTEM_PROMPT = `Tu extrais des données patient depuis un sujet d'ECOS médical français.

Renvoie STRICTEMENT un JSON avec ces clés (null si la donnée n'est pas présente dans le texte) :
{
  "biometrics": {
    "height_cm": <nombre en cm, ex: 165 pour "1m65">,
    "weight_kg": <nombre en kg>,
    "bmi": <nombre ou null>
  },
  "vital_signs": {
    "blood_pressure": "<ex: 120/80 mmHg>",
    "heart_rate": "<ex: 75/min>",
    "respiratory_rate": "<ex: 16/min>",
    "spo2": "<ex: 98% en air ambiant>",
    "temperature": "<ex: 37,2°C>",
    "blood_glucose": "<ex: 5 mmol/L>"
  },
  "vital_signs_note": "<note courte si la fiche précise que les constantes ne sont pas données spontanément ou autre>"
}

Règles:
- N'invente JAMAIS. Si une valeur n'apparaît pas littéralement, mets null.
- Cherche dans les sections "Identité du patient", "Données patient", "Constantes", "Paramètres vitaux", annexes.
- "1m65" = 165 cm. "1,70m" = 170 cm.
- Préserve les unités textuelles originales pour vital_signs (strings).
- Pas de markdown, pas de texte avant/après le JSON.`;

async function enrichCase(
  anthropic: Anthropic,
  c: RawCase,
  pdfAbs: string
): Promise<ClinicalData | null> {
  const text = pdfText(pdfAbs);
  if (!text || text.length < 100) return null;
  // Truncate very long PDFs to keep tokens reasonable.
  const snippet = text.slice(0, 30000);

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 700,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Texte du sujet (source PDF) :\n\n${snippet}` }],
  });
  const block = resp.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  const raw = block.text.trim();
  const jsonText = raw.startsWith("```")
    ? raw.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/, "")
    : raw;
  try {
    return JSON.parse(jsonText) as ClinicalData;
  } catch (e) {
    console.error("  parse error:", (e as Error).message);
    console.error("  raw:", raw.slice(0, 400));
    return null;
  }
}

function hasAnyData(cd: ClinicalData | null | undefined): boolean {
  if (!cd) return false;
  const b = cd.biometrics;
  const v = cd.vital_signs;
  const hasB = !!(b && (b.height_cm || b.weight_kg || b.bmi));
  const hasV = !!(
    v &&
    (v.blood_pressure ||
      v.heart_rate ||
      v.respiratory_rate ||
      v.spo2 ||
      v.temperature ||
      v.blood_glucose)
  );
  return hasB || hasV;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY missing");
    process.exit(1);
  }
  const anthropic = new Anthropic({ apiKey });

  const cases = JSON.parse(fs.readFileSync(CASES_FILE, "utf8")) as RawCase[];
  const report = JSON.parse(fs.readFileSync(REPORT_FILE, "utf8")) as AnnexReport[];
  const byId = new Map(report.map((r) => [r.caseId, r]));

  let processed = 0;
  for (const c of cases) {
    if (ONLY_ID && c.id !== ONLY_ID) continue;
    const rep = byId.get(c.id);
    if (!rep?.pdfPath) continue;
    const pdfAbs = path.join(PDF_ROOT, rep.pdfPath);
    if (!fs.existsSync(pdfAbs)) continue;

    const p = (c.patient ?? {}) as Patient;
    if (!FORCE && hasAnyData(p.clinical_data)) continue;

    processed++;
    console.log(`\n[${processed}] ${c.id}`);
    const cd = await enrichCase(anthropic, c, pdfAbs);
    if (!cd) {
      console.log(`    no data extracted`);
      continue;
    }
    // Clean nulls so the JSON stays tidy.
    const bio = cd.biometrics ?? {};
    const vs = cd.vital_signs ?? {};
    const cleanedBio = {
      height_cm: bio.height_cm ?? undefined,
      weight_kg: bio.weight_kg ?? undefined,
      bmi: bio.bmi ?? undefined,
    };
    const cleanedVs = {
      blood_pressure: vs.blood_pressure ?? undefined,
      heart_rate: vs.heart_rate ?? undefined,
      respiratory_rate: vs.respiratory_rate ?? undefined,
      spo2: vs.spo2 ?? undefined,
      temperature: vs.temperature ?? undefined,
      blood_glucose: vs.blood_glucose ?? undefined,
    };
    const hasBio = Object.values(cleanedBio).some((v) => v !== undefined);
    const hasVs = Object.values(cleanedVs).some((v) => v !== undefined);
    const merged: ClinicalData = {};
    if (hasBio) merged.biometrics = cleanedBio;
    if (hasVs) merged.vital_signs = cleanedVs;
    if (cd.vital_signs_note) merged.vital_signs_note = cd.vital_signs_note;

    if (hasBio || hasVs) {
      (c.patient ??= {}).clinical_data = merged;
      console.log(
        `    biometrics=${hasBio ? JSON.stringify(cleanedBio) : "-"} ; vitals=${hasVs ? Object.keys(cleanedVs).filter((k) => cleanedVs[k as keyof typeof cleanedVs]).join(",") : "-"}`
      );
      fs.writeFileSync(CASES_FILE, JSON.stringify(cases, null, 2));
    } else {
      console.log(`    nothing extractable`);
    }
  }

  console.log(`\nDone. Processed ${processed} case(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
