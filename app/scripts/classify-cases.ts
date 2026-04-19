/**
 * Classify ECOS cases from extracted-cases.json
 *
 * Splits the 171 cases into 3 buckets and produces a detailed annex report:
 *   - output/patient-simule-cases.json  — cases playable with simulated patient
 *   - output/non-patient-cases.json     — TUT'ECOS, tacfa_no_patient (interpretation, etc.)
 *   - output/annexes-report.json        — per-case annex inventory (separate files + PDF embedded)
 *
 * Run:  npx tsx scripts/classify-cases.ts
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const PDF_ROOT = path.resolve(__dirname, "../../Banque de sujets ECOS");
const OUTPUT_DIR = path.resolve(__dirname, "output");
const INPUT_FILE = path.join(OUTPUT_DIR, "extracted-cases.json");

type RawCase = {
  id: string;
  source_pdf: string;
  title?: string;
  sdd_number?: number | null;
  subject_number?: number | null;
  format?: string;
  des_group?: number;
  specialty?: string;
  metadata?: { requires_simulated_patient?: boolean } & Record<string, unknown>;
  patient?: {
    identity?: { name?: string; first_name?: string } | null;
    opening_line?: string | null;
  } | null;
  iconography?: Array<unknown>;
  [k: string]: unknown;
};

type PdfIndexEntry = { pdfPath: string; folderPath: string };

type AnnexReport = {
  caseId: string;
  title: string;
  sddNumber: number | null;
  format: string;
  sourceFolder: string | null;
  pdfPath: string | null;
  hasSeparateImages: boolean;
  separateImageFiles: string[];
  pdfEmbeddedImageCount: number;
  pdfPageCount: number | null;
};

// -------- helpers --------

function isPatientSimule(c: RawCase): boolean {
  if (c.format !== "tacfa_patient") return false;
  const opening = c.patient?.opening_line;
  if (!opening || typeof opening !== "string" || opening.trim().length === 0) return false;
  const name = c.patient?.identity?.name;
  if (!name || typeof name !== "string" || name.trim().length === 0) return false;
  return true;
}

function buildPdfIndex(): Map<string, PdfIndexEntry> {
  const index = new Map<string, PdfIndexEntry>();
  function scan(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(fullPath);
      else if (entry.name.toLowerCase().endsWith(".pdf")) {
        index.set(entry.name, { pdfPath: fullPath, folderPath: dir });
      }
    }
  }
  scan(PDF_ROOT);
  return index;
}

function findImageFiles(folder: string): string[] {
  const exts = new Set([".jpg", ".jpeg", ".png", ".gif"]);
  try {
    return fs
      .readdirSync(folder, { withFileTypes: true })
      .filter((e) => e.isFile() && exts.has(path.extname(e.name).toLowerCase()))
      .map((e) => path.join(folder, e.name));
  } catch {
    return [];
  }
}

function pdfInfo(pdfPath: string): { pages: number | null; embeddedImages: number } {
  let pages: number | null = null;
  let embeddedImages = 0;
  try {
    const info = execSync(`pdfinfo ${JSON.stringify(pdfPath)}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const m = info.match(/Pages:\s+(\d+)/);
    if (m) pages = parseInt(m[1], 10);
  } catch {
    // ignore — some PDFs fail on pdfinfo
  }
  try {
    const list = execSync(`pdfimages -list ${JSON.stringify(pdfPath)}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    // First 2 lines are header; count image rows
    const lines = list.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length >= 2) embeddedImages = Math.max(0, lines.length - 2);
  } catch {
    // ignore
  }
  return { pages, embeddedImages };
}

// -------- main --------

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`ERROR: ${INPUT_FILE} not found`);
    process.exit(1);
  }

  console.log("Loading extracted-cases.json...");
  const cases = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8")) as RawCase[];
  console.log(`Loaded ${cases.length} cases`);

  console.log("Indexing PDF files from Banque de sujets ECOS/...");
  const pdfIndex = buildPdfIndex();
  console.log(`Indexed ${pdfIndex.size} PDFs\n`);

  const patientSimule: RawCase[] = [];
  const nonPatient: RawCase[] = [];
  const annexReports: AnnexReport[] = [];

  let missingPdf = 0;
  let patientWithAnnex = 0;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const idx = pdfIndex.get(c.source_pdf);
    const folder = idx?.folderPath ?? null;
    const pdfPath = idx?.pdfPath ?? null;
    if (!idx) missingPdf++;

    let separateImageFiles: string[] = [];
    if (folder) {
      separateImageFiles = findImageFiles(folder).map((p) => path.basename(p));
    }

    let pdfPages: number | null = null;
    let embeddedImages = 0;
    if (pdfPath) {
      const info = pdfInfo(pdfPath);
      pdfPages = info.pages;
      embeddedImages = info.embeddedImages;
    }

    const report: AnnexReport = {
      caseId: c.id,
      title: c.title ?? "",
      sddNumber: c.sdd_number ?? null,
      format: c.format ?? "",
      sourceFolder: folder ? path.relative(PDF_ROOT, folder) : null,
      pdfPath: pdfPath ? path.relative(PDF_ROOT, pdfPath) : null,
      hasSeparateImages: separateImageFiles.length > 0,
      separateImageFiles,
      pdfEmbeddedImageCount: embeddedImages,
      pdfPageCount: pdfPages,
    };
    annexReports.push(report);

    if (isPatientSimule(c)) {
      patientSimule.push(c);
      if (separateImageFiles.length > 0 || embeddedImages > 0) patientWithAnnex++;
    } else {
      nonPatient.push(c);
    }

    if ((i + 1) % 20 === 0) {
      console.log(`  Processed ${i + 1}/${cases.length}`);
    }
  }

  // Write outputs
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "patient-simule-cases.json"),
    JSON.stringify(patientSimule, null, 2)
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "non-patient-cases.json"),
    JSON.stringify(nonPatient, null, 2)
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "annexes-report.json"),
    JSON.stringify(annexReports, null, 2)
  );

  // Summary
  const byFormat: Record<string, number> = {};
  for (const c of cases) byFormat[c.format ?? "unknown"] = (byFormat[c.format ?? "unknown"] ?? 0) + 1;

  const withSeparate = annexReports.filter((r) => r.hasSeparateImages).length;
  const withEmbedded = annexReports.filter((r) => r.pdfEmbeddedImageCount > 0).length;

  console.log("\n=== CLASSIFICATION SUMMARY ===");
  console.log(`Total cases:               ${cases.length}`);
  console.log(`  Patient simulé:          ${patientSimule.length}`);
  console.log(`  Non-patient:             ${nonPatient.length}`);
  console.log(`By format:                 ${JSON.stringify(byFormat)}`);
  console.log(`PDF not found in bank:     ${missingPdf}`);
  console.log(`Cases w/ separate images:  ${withSeparate}`);
  console.log(`Cases w/ embedded images:  ${withEmbedded}`);
  console.log(`Patient simulé w/ annex:   ${patientWithAnnex}`);
  console.log("\nOutputs written:");
  console.log(`  ${path.join(OUTPUT_DIR, "patient-simule-cases.json")}`);
  console.log(`  ${path.join(OUTPUT_DIR, "non-patient-cases.json")}`);
  console.log(`  ${path.join(OUTPUT_DIR, "annexes-report.json")}`);
}

main();
