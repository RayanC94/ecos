/**
 * Render PDF pages that contain tabular / annex data (patient sheets, bilans, tables).
 *
 * Runs AFTER extract-annexes.ts. For each patient-simulé case:
 *   - Scan each PDF page with pdftotext
 *   - If page text contains "ANNEXE", "Bilan biologique", "Résultats", or has
 *     heavy tabular whitespace (ratio of >= N columns detected on >= M lines),
 *     rasterize that page to PNG via pdftoppm and add to iconography.
 *
 * Updates patient-simule-cases-with-annexes.json in-place (merges new annexes).
 *
 * Run: npx tsx scripts/render-annexe-pages.ts
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const PDF_ROOT = path.resolve(__dirname, "../../Banque de sujets ECOS");
const OUTPUT_DIR = path.resolve(__dirname, "output");
const ANNEXES_PUBLIC_DIR = path.resolve(__dirname, "../public/annexes");
const CASES_FILE = path.join(OUTPUT_DIR, "patient-simule-cases-with-annexes.json");
const REPORT_FILE = path.join(OUTPUT_DIR, "annexes-report.json");

// Patterns that mark a page as part of the ECOS evaluation grid rather
// than a real clinical annex. Such pages must be dropped even when they
// look tabular — they're the rubric, not data about the patient.
const EVAL_GRID_PATTERNS: RegExp[] = [
  /GRILLE\s+D['’]?\s*[ÉE]VALUATION/i,
  /ECOS\s+TACFA/i,
  /Tutorat\s+associatif/i,
  /APTITUDE[S]?\s+[ÀA]\s+(STRUCTURER|MENER)/i,
  /Performance\s+(Insuffisante|Limite|Satisfaisante|Remarquable)/i,
  /Aptitudes\s+cliniques/,
  /Consigne[s]?\s+[àa]?\s*l['’]?\s*[ée]valuateur/i,
  /\bTOTAL\s+[XNxn]?\s*\/\s*\d+\s+points?/i,
  /Communications?\s+et\s+attitudes?/i,
];

function gridItemLineCount(text: string): number {
  const re = /^\s*\d+\s*\.?\s+.+\s+\d+\s+points?\s*(si|cit[ée]s?|☐|□|\s|$)/gim;
  const m = text.match(re);
  return m ? m.length : 0;
}

function isEvalGridPage(text: string): boolean {
  if (EVAL_GRID_PATTERNS.some((re) => re.test(text))) return true;
  return gridItemLineCount(text) >= 3;
}

// Regex patterns that signal an annex/table page
const ANNEX_HEADERS = [
  /\bANNEXE\b/,
  /\bAnnexe\s*\d*\b/i,
  /\bBilan\s+(biologique|sanguin|lipidique|h[ée]patique|r[ée]nal)\b/i,
  /\bR[ée]sultats?\s+(du\s+)?bilan\b/i,
  /\bH[ée]mogramme\b/i,
  /\bECG\b.{0,60}\b(rythme|fr[ée]quence|onde)\b/i,
  /\bNFS\b/,
  /\bIonogramme\b/i,
  /\bGaz\s+du\s+sang\b/i,
  /\bDonn[ée]es\s+(du\s+)?patient\b/i,
];

function pagesCount(pdfPath: string): number {
  try {
    const info = execSync(`pdfinfo ${JSON.stringify(pdfPath)}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const m = info.match(/Pages:\s+(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  } catch {
    return 0;
  }
}

function pageText(pdfPath: string, pageNum: number): string {
  try {
    return execSync(
      `pdftotext -layout -f ${pageNum} -l ${pageNum} ${JSON.stringify(pdfPath)} -`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
  } catch {
    return "";
  }
}

function hasAnnexKeyword(text: string): boolean {
  return ANNEX_HEADERS.some((re) => re.test(text));
}

function hasTabularDensity(text: string): boolean {
  // Heuristic: >= 4 lines in which >= 3 groups are separated by 3+ spaces
  const lines = text.split("\n");
  let tabular = 0;
  for (const line of lines) {
    if (line.trim().length < 10) continue;
    const groups = line.split(/\s{3,}/).filter((g) => g.trim().length > 0);
    if (groups.length >= 3) tabular++;
  }
  return tabular >= 4;
}

function renderPageToPng(pdfPath: string, pageNum: number, outPrefix: string): string | null {
  try {
    execSync(
      `pdftoppm -png -r 150 -f ${pageNum} -l ${pageNum} ${JSON.stringify(pdfPath)} ${JSON.stringify(outPrefix)}`,
      { stdio: ["ignore", "ignore", "ignore"] }
    );
  } catch {
    return null;
  }
  // pdftoppm appends -<pageNumber>.png (zero-padded based on total pages)
  const dir = path.dirname(outPrefix);
  const base = path.basename(outPrefix);
  const matches = fs.readdirSync(dir).filter((f) => f.startsWith(base + "-") && f.endsWith(".png"));
  if (matches.length === 0) return null;
  // Rename to stable name
  const src = path.join(dir, matches[0]);
  const dst = `${outPrefix}.png`;
  if (src !== dst) fs.renameSync(src, dst);
  return dst;
}

type AnnexEntry = { filename: string; description: string; type: "ecg" | "photo" | "lab" | "other"; url: string };

type RawCase = {
  id: string;
  source_pdf: string;
  title?: string;
  iconography?: AnnexEntry[];
  [k: string]: unknown;
};

type AnnexReport = {
  caseId: string;
  pdfPath: string | null;
};

function main() {
  if (!fs.existsSync(CASES_FILE)) {
    console.error(`ERROR: ${CASES_FILE} not found. Run extract-annexes.ts first.`);
    process.exit(1);
  }
  const cases = JSON.parse(fs.readFileSync(CASES_FILE, "utf8")) as RawCase[];
  const report = JSON.parse(fs.readFileSync(REPORT_FILE, "utf8")) as AnnexReport[];
  const reportById = new Map<string, AnnexReport>();
  for (const r of report) reportById.set(r.caseId, r);

  let totalPagesRendered = 0;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const rep = reportById.get(c.id);
    if (!rep?.pdfPath) continue;
    const pdfAbs = path.join(PDF_ROOT, rep.pdfPath);
    const pages = pagesCount(pdfAbs);
    if (pages < 2) continue;

    const caseDir = path.join(ANNEXES_PUBLIC_DIR, c.id);
    fs.mkdirSync(caseDir, { recursive: true });

    const newAnnexes: AnnexEntry[] = [];
    const existing = new Set((c.iconography ?? []).map((a) => a.filename));

    // Scan pages 2..N (skip page 1 = student instructions)
    for (let p = 2; p <= pages; p++) {
      const text = pageText(pdfAbs, p);
      // Skip evaluation-grid / rubric pages — they're not clinical annexes.
      if (isEvalGridPage(text)) continue;
      const isAnnexHeader = hasAnnexKeyword(text);
      const isTabular = hasTabularDensity(text);
      if (!isAnnexHeader && !isTabular) continue;

      const filename = `annex-page-${p}.png`;
      if (existing.has(filename)) continue;

      const prefix = path.join(caseDir, `annex-page-${p}`);
      const out = renderPageToPng(pdfAbs, p, prefix);
      if (!out) continue;

      // Light dedup vs embedded images — check file size uniqueness only (simple)
      newAnnexes.push({
        filename,
        description: isAnnexHeader ? `Annexe (page ${p})` : `Tableau / données patient (page ${p})`,
        type: "other",
        url: `/annexes/${c.id}/${encodeURIComponent(filename)}`,
      });
      totalPagesRendered++;
    }

    if (newAnnexes.length > 0) {
      c.iconography = [...(c.iconography ?? []), ...newAnnexes];
      console.log(`[${i + 1}/${cases.length}] ${c.id} → +${newAnnexes.length} annex page(s)`);
    }
  }

  fs.writeFileSync(CASES_FILE, JSON.stringify(cases, null, 2));

  console.log("\n=== ANNEX PAGES RENDERING SUMMARY ===");
  console.log(`Total pages rendered: ${totalPagesRendered}`);
  console.log(`Updated:              ${CASES_FILE}`);
}

main();
