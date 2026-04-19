/**
 * Extract annexes for patient-simulé cases.
 *
 * For each case in patient-simule-cases.json:
 *   1. Copy any separate image files from the source folder
 *   2. Use pdfimages to extract embedded images from the PDF
 *   3. Filter out small images (likely logos/decorations)
 *   4. Dedupe identical images via MD5
 *   5. Copy keeper images into app/public/annexes/{caseId}/
 *   6. Populate case.iconography with {filename, url, type, description}
 *
 * Writes app/scripts/output/patient-simule-cases-with-annexes.json
 * and side-effect: fills app/public/annexes/{caseId}/
 *
 * Run: npx tsx scripts/extract-annexes.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { execSync } from "child_process";

const PDF_ROOT = path.resolve(__dirname, "../../Banque de sujets ECOS");
const OUTPUT_DIR = path.resolve(__dirname, "output");
const ANNEXES_PUBLIC_DIR = path.resolve(__dirname, "../public/annexes");
const INPUT_FILE = path.join(OUTPUT_DIR, "patient-simule-cases.json");
const REPORT_FILE = path.join(OUTPUT_DIR, "annexes-report.json");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "patient-simule-cases-with-annexes.json");

// Heuristics for filtering embedded PDF images
const MIN_WIDTH = 250;
const MIN_HEIGHT = 250;
const MIN_SIZE_BYTES = 10 * 1024; // 10 KB

// Patterns that mark a page as part of the ECOS evaluation grid rather
// than a real clinical annex. Images extracted from these pages are
// screenshots of the rubric itself and must be dropped.
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
  /item_number|task_group/i,
];

// Count how many lines look like grid items ("N. task… 1 point [☐]")
function gridItemLineCount(text: string): number {
  const re = /^\s*\d+\s*\.?\s+.+\s+\d+\s+points?\s*(si|cit[ée]s?|☐|□|\s|$)/gim;
  const m = text.match(re);
  return m ? m.length : 0;
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

function isEvalGridPage(text: string): boolean {
  if (EVAL_GRID_PATTERNS.some((re) => re.test(text))) return true;
  // Pages that are continuations of the grid table often have no header,
  // just a series of numbered items scored "1 point".
  return gridItemLineCount(text) >= 3;
}

type RawCase = {
  id: string;
  source_pdf: string;
  title?: string;
  iconography?: Array<{ filename: string; description: string; type: string; url: string }>;
  [k: string]: unknown;
};

type AnnexEntry = { filename: string; description: string; type: "ecg" | "photo" | "lab" | "other"; url: string };

type AnnexReport = {
  caseId: string;
  pdfPath: string | null;
  sourceFolder: string | null;
};

function classifyAnnex(filename: string): "ecg" | "photo" | "lab" | "other" {
  const lower = filename.toLowerCase();
  if (lower.includes("ecg") || lower.includes("electrocardio")) return "ecg";
  if (lower.includes("labo") || lower.includes("biologie") || lower.includes("analyse") || lower.includes("eps")) return "lab";
  const ext = path.extname(lower);
  if ([".jpg", ".jpeg", ".png"].includes(ext)) return "photo";
  return "other";
}

function md5(filePath: string): string {
  const h = crypto.createHash("md5");
  h.update(fs.readFileSync(filePath));
  return h.digest("hex");
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

// Parse `pdfimages -list` and keep rows with width/height above thresholds and type=image
type PdfImageRow = { page: number; num: number; width: number; height: number };

function listFilteredPdfImages(pdfPath: string): PdfImageRow[] {
  let output = "";
  try {
    output = execSync(`pdfimages -list ${JSON.stringify(pdfPath)}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return [];
  }
  const lines = output.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 3) return [];
  const rows: PdfImageRow[] = [];
  // Skip header (first 2 lines)
  for (let i = 2; i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/);
    // Columns: page num type width height color comp bpc enc interp object ID x-ppi y-ppi size ratio
    if (parts.length < 15) continue;
    const type = parts[2];
    if (type !== "image") continue; // skip smask, stencil, etc.
    const page = parseInt(parts[0], 10);
    const num = parseInt(parts[1], 10);
    const width = parseInt(parts[3], 10);
    const height = parseInt(parts[4], 10);
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue;
    if (width < MIN_WIDTH || height < MIN_HEIGHT) continue;
    rows.push({ page, num, width, height });
  }
  return rows;
}

function extractAllImages(pdfPath: string, tmpDir: string): string[] {
  fs.mkdirSync(tmpDir, { recursive: true });
  const prefix = path.join(tmpDir, "img");
  try {
    execSync(`pdfimages -all ${JSON.stringify(pdfPath)} ${JSON.stringify(prefix)}`, {
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    return [];
  }
  // List generated files
  try {
    return fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith("img-"))
      .map((f) => path.join(tmpDir, f));
  } catch {
    return [];
  }
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`ERROR: ${INPUT_FILE} not found. Run classify-cases.ts first.`);
    process.exit(1);
  }
  if (!fs.existsSync(REPORT_FILE)) {
    console.error(`ERROR: ${REPORT_FILE} not found. Run classify-cases.ts first.`);
    process.exit(1);
  }

  const cases = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8")) as RawCase[];
  const report = JSON.parse(fs.readFileSync(REPORT_FILE, "utf8")) as AnnexReport[];
  const reportById = new Map<string, AnnexReport>();
  for (const r of report) reportById.set(r.caseId, r);

  fs.mkdirSync(ANNEXES_PUBLIC_DIR, { recursive: true });
  const tmpRoot = path.join(OUTPUT_DIR, "_pdf_images_tmp");
  if (fs.existsSync(tmpRoot)) fs.rmSync(tmpRoot, { recursive: true, force: true });

  let totalSeparate = 0;
  let totalEmbedded = 0;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const rep = reportById.get(c.id);
    if (!rep || !rep.pdfPath) {
      console.log(`[${i + 1}/${cases.length}] ${c.id} — no PDF found, skipping`);
      continue;
    }
    const pdfAbs = path.join(PDF_ROOT, rep.pdfPath);
    const folderAbs = rep.sourceFolder ? path.join(PDF_ROOT, rep.sourceFolder) : null;

    const caseAnnexDir = path.join(ANNEXES_PUBLIC_DIR, c.id);
    fs.mkdirSync(caseAnnexDir, { recursive: true });

    const hashes = new Set<string>();
    const annexes: AnnexEntry[] = [];

    // 1. Copy separate images from source folder
    if (folderAbs && fs.existsSync(folderAbs)) {
      const separates = findImageFiles(folderAbs);
      for (const src of separates) {
        const base = path.basename(src);
        // Sanitize filename (strip accents/spaces)
        const safe = base.replace(/\s+/g, "_").replace(/[^A-Za-z0-9._-]/g, "");
        const dst = path.join(caseAnnexDir, safe);
        fs.copyFileSync(src, dst);
        const h = md5(dst);
        if (hashes.has(h)) {
          fs.unlinkSync(dst);
          continue;
        }
        hashes.add(h);
        annexes.push({
          filename: safe,
          description: `Annexe jointe : ${base}`,
          type: classifyAnnex(safe),
          url: `/annexes/${c.id}/${encodeURIComponent(safe)}`,
        });
        totalSeparate++;
      }
    }

    // 2. Extract and filter embedded PDF images
    const filteredRows = listFilteredPdfImages(pdfAbs);
    // Drop images whose source page is an evaluation-grid page (rubric
    // screenshots, not clinical annexes).
    const pageTextCache = new Map<number, string>();
    const isGridPage = (page: number): boolean => {
      let t = pageTextCache.get(page);
      if (t === undefined) {
        t = pageText(pdfAbs, page);
        pageTextCache.set(page, t);
      }
      return isEvalGridPage(t);
    };
    const cleanRows = filteredRows.filter((r) => !isGridPage(r.page));
    if (cleanRows.length > 0) {
      const tmpDir = path.join(tmpRoot, c.id);
      const allImgs = extractAllImages(pdfAbs, tmpDir);
      // pdfimages names files img-<num>.<ext> where <num> matches the "num" column
      const keepNums = new Set(cleanRows.map((r) => r.num));
      let kept = 0;
      for (const imgPath of allImgs) {
        const m = path.basename(imgPath).match(/^img-(\d+)\.[a-zA-Z]+$/);
        if (!m) continue;
        const num = parseInt(m[1], 10);
        if (!keepNums.has(num)) continue;
        const stat = fs.statSync(imgPath);
        if (stat.size < MIN_SIZE_BYTES) continue;
        const h = md5(imgPath);
        if (hashes.has(h)) continue;
        hashes.add(h);
        kept++;
        const ext = path.extname(imgPath);
        const safeName = `pdfimg-${num}${ext}`;
        const dst = path.join(caseAnnexDir, safeName);
        fs.copyFileSync(imgPath, dst);
        annexes.push({
          filename: safeName,
          description: `Image extraite du PDF (page ${cleanRows.find((r) => r.num === num)?.page ?? "?"})`,
          type: classifyAnnex(safeName),
          url: `/annexes/${c.id}/${encodeURIComponent(safeName)}`,
        });
        totalEmbedded++;
      }
      // Cleanup tmp
      fs.rmSync(tmpDir, { recursive: true, force: true });
      const dropped = filteredRows.length - cleanRows.length;
      if (kept > 0 || dropped > 0) {
        console.log(
          `  ${c.id}: kept ${kept} embedded image(s)${
            dropped > 0 ? ` (dropped ${dropped} from eval-grid pages)` : ""
          }`
        );
      }
    }

    // Remove caseAnnexDir if empty
    if (annexes.length === 0) {
      try { fs.rmdirSync(caseAnnexDir); } catch { /* ignore */ }
    } else {
      console.log(`[${i + 1}/${cases.length}] ${c.id} → ${annexes.length} annex(es)`);
    }

    c.iconography = annexes;
  }

  // Cleanup tmp root if empty
  if (fs.existsSync(tmpRoot)) fs.rmSync(tmpRoot, { recursive: true, force: true });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cases, null, 2));

  console.log("\n=== ANNEX EXTRACTION SUMMARY ===");
  console.log(`Patient-simulé cases:   ${cases.length}`);
  console.log(`Separate files copied:  ${totalSeparate}`);
  console.log(`Embedded images kept:   ${totalEmbedded}`);
  console.log(`Output JSON:            ${OUTPUT_FILE}`);
  console.log(`Public assets:          ${ANNEXES_PUBLIC_DIR}`);
}

main();
