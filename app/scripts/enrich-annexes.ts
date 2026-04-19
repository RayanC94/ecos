/**
 * Enrich case iconography using Claude Sonnet 4.6 vision.
 *
 * For every case with iconography, this script asks Claude to look at each
 * image alongside the case context (title, specialty, student tasks,
 * evaluation grid, reference sheet) and return:
 *   - action: "keep" or "discard" — discard if the image is a rubric,
 *     evaluation grid, or leaks the answer key
 *   - description: short, specific French caption (like "ECG à l'entrée")
 *   - type: "ecg" | "photo" | "radio" | "scan" | "ophtalmo" | "derma" |
 *     "biologie" | "eps" | "echo" | "other"
 *   - reveal_triggers: French keywords that should trigger the image being
 *     revealed when the student mentions them
 *
 * Reads  app/scripts/output/patient-simule-cases-with-annexes.json
 * Writes app/scripts/output/patient-simule-cases-with-annexes.json (backs
 * up first to .bak), and app/scripts/output/enrich-annexes-log.json for
 * diagnostics.
 *
 * Run:  npx tsx scripts/enrich-annexes.ts
 * Flags:
 *   --only <caseId>   Process a single case
 *   --limit <N>       Process at most N cases
 *   --resume          Skip cases that already have reveal_triggers on every image
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { execSync } from "child_process";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const OUTPUT_DIR = path.resolve(__dirname, "output");
const CASES_FILE = path.join(OUTPUT_DIR, "patient-simule-cases-with-annexes.json");
const BACKUP_FILE = path.join(OUTPUT_DIR, "patient-simule-cases-with-annexes.json.bak");
const LOG_FILE = path.join(OUTPUT_DIR, "enrich-annexes-log.json");
const ANNEXES_PUBLIC_DIR = path.resolve(__dirname, "../public/annexes");

const MODEL = "claude-sonnet-4-6";

type AnnexEntry = {
  filename: string;
  description: string;
  type: string;
  url: string;
  reveal_triggers?: string[];
};

type RawCase = {
  id: string;
  title?: string;
  specialty?: string;
  student_instructions?: unknown;
  evaluation_grid?: unknown;
  reference_sheet?: string | null;
  iconography?: AnnexEntry[];
  [k: string]: unknown;
};

type EnrichResult = {
  filename: string;
  action: "keep" | "discard";
  reason?: string;
  description?: string;
  type?: string;
  reveal_triggers?: string[];
};

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const ONLY_ID = argValue("--only");
const LIMIT = argValue("--limit") ? parseInt(argValue("--limit")!, 10) : Infinity;
const RESUME = process.argv.includes("--resume");

const MAX_BYTES = 4_900_000;

function readImage(caseId: string, filename: string): { media: string; b64: string } | null {
  const p = path.join(ANNEXES_PUBLIC_DIR, caseId, filename);
  if (!fs.existsSync(p)) return null;
  const ext = path.extname(filename).toLowerCase();
  let media =
    ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".gif" ? "image/gif" : "application/octet-stream";
  let buf = fs.readFileSync(p);
  if (buf.length > MAX_BYTES) {
    // Downscale with macOS `sips` into a sibling tmp .jpg at ~1600px wide.
    const tmp = path.join(path.dirname(p), `.tmp-resize-${Date.now()}.jpg`);
    try {
      execSync(
        `sips -s format jpeg -s formatOptions 80 -Z 1600 ${JSON.stringify(p)} --out ${JSON.stringify(tmp)}`,
        { stdio: ["ignore", "ignore", "ignore"] }
      );
      if (fs.existsSync(tmp) && fs.statSync(tmp).size < MAX_BYTES) {
        buf = fs.readFileSync(tmp);
        media = "image/jpeg";
      }
    } catch {
      /* fall through */
    } finally {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  }
  if (buf.length > MAX_BYTES) return null;
  return { media, b64: buf.toString("base64") };
}

function caseContextText(c: RawCase): string {
  const si = c.student_instructions as
    | { context?: string; tasks?: string[]; constraints?: string[] }
    | undefined;
  const grid = c.evaluation_grid as
    | { tasks?: { description: string }[] }
    | undefined;
  const gridLines = (grid?.tasks ?? [])
    .map((t, i) => `  ${i + 1}. ${t.description}`)
    .join("\n");
  return [
    `Titre: ${c.title ?? ""}`,
    `Spécialité: ${c.specialty ?? ""}`,
    `Contexte étudiant: ${si?.context ?? ""}`,
    `Tâches demandées: ${(si?.tasks ?? []).join(" ; ")}`,
    `Contraintes: ${(si?.constraints ?? []).join(" ; ")}`,
    `Grille d'évaluation:\n${gridLines || "(aucune)"}`,
    `Fiche de référence (RÉPONSES / CORRECTION — ne pas montrer à l'étudiant):\n${c.reference_sheet ?? "(aucune)"}`,
  ].join("\n\n");
}

const SYSTEM_PROMPT = `Tu es un expert pédagogique qui catalogue les annexes d'ECOS médicaux français.

Pour chaque image d'un cas clinique, tu dois décider :
1. ACTION : "keep" si l'image est une annexe clinique légitime à montrer à l'étudiant (photographie clinique, ECG, imagerie, bilan biologique, schéma, tableau de paramètres) ; "discard" si l'image est une fuite de la grille d'évaluation / rubrique de scoring / fiche de correction ou de référence (tableaux "Performance Insuffisante / Limite / Satisfaisante", aptitudes à structurer / mener / communiquer, points par tâche, etc.).
2. DESCRIPTION (si keep) : 5-10 mots en français spécifiques à l'image ("ECG à l'arrivée aux urgences", "Fond d'œil droit", "Bilan biologique d'entrée"). Pas de "Image extraite du PDF".
3. TYPE (si keep) : un seul parmi : ecg | photo | radio | scan | irm | echographie | ophtalmo | derma | biologie | eps | schema | tableau | other.
4. REVEAL_TRIGGERS (si keep) : 4-8 mots-clés français qu'un étudiant pourrait dire pour se voir montrer l'image (ex: pour un ECG, ["ECG", "électrocardiogramme", "electro", "tracé cardiaque"]). Utiliser les mots exacts que l'étudiant prononcerait. Pas de phrases, juste des mots/expressions courtes.

Règles strictes :
- Si l'image montre une rubrique de scoring (colonnes "Performance Insuffisante / Limite / ..."), ou un tableau avec "0 point / 0,25 point / 0,5 point", c'est DISCARD.
- Si l'image contient la grille de tâches de l'ECOS (numérotées avec points), c'est DISCARD.
- Les photographies cliniques, ECG, imageries, fond d'œil, lésions, bilans biologiques sont KEEP.
- Les pages d'annexes du PDF sont KEEP si elles contiennent des données patient (bilans, tableaux de paramètres) même si elles ont une en-tête "Annexe X".
- Réponds en JSON strict, sans markdown, sans texte avant/après.`;

function buildUserMessage(
  c: RawCase,
  entries: { filename: string; img: { media: string; b64: string } }[]
) {
  const context = caseContextText(c);
  const content: Anthropic.MessageParam["content"] = [];
  content.push({
    type: "text",
    text: `CONTEXTE DU CAS:\n\n${context}\n\nJ'ai ${entries.length} image(s) à cataloguer. Pour chacune, dis-moi action/description/type/reveal_triggers.`,
  });
  for (const e of entries) {
    content.push({
      type: "text",
      text: `\n--- Image: ${e.filename} ---`,
    });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: e.img.media as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
        data: e.img.b64,
      },
    });
  }
  content.push({
    type: "text",
    text: `\nRéponds en JSON strict au format :
{
  "results": [
    {
      "filename": "<filename>",
      "action": "keep" | "discard",
      "reason": "<raison courte si discard>",
      "description": "<si keep>",
      "type": "<si keep>",
      "reveal_triggers": ["...", "..."]
    }
  ]
}`,
  });
  return content;
}

async function enrichCase(
  anthropic: Anthropic,
  c: RawCase
): Promise<EnrichResult[] | null> {
  const ico = c.iconography ?? [];
  if (ico.length === 0) return [];

  const entries: { filename: string; img: { media: string; b64: string } }[] = [];
  const missing: string[] = [];
  for (const a of ico) {
    const img = readImage(c.id, a.filename);
    if (!img) {
      missing.push(a.filename);
      console.log(`    missing file: ${a.filename}`);
      continue;
    }
    entries.push({ filename: a.filename, img });
  }
  if (missing.length > 0) {
    c.iconography = (c.iconography ?? []).filter(
      (a) => !missing.includes(a.filename)
    );
  }
  if (entries.length === 0) return [];

  const userContent = buildUserMessage(c, entries);
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;
  const raw = textBlock.text.trim();
  const jsonText = raw.startsWith("```")
    ? raw.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/, "")
    : raw;
  try {
    const parsed = JSON.parse(jsonText) as { results: EnrichResult[] };
    return parsed.results;
  } catch (e) {
    console.error("  JSON parse error:", (e as Error).message);
    console.error("  raw:", raw.slice(0, 400));
    return null;
  }
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY missing in .env.local");
    process.exit(1);
  }
  const anthropic = new Anthropic({ apiKey });

  const cases = JSON.parse(fs.readFileSync(CASES_FILE, "utf8")) as RawCase[];
  if (!fs.existsSync(BACKUP_FILE)) {
    fs.copyFileSync(CASES_FILE, BACKUP_FILE);
    console.log(`Backup created: ${BACKUP_FILE}`);
  }

  const log: {
    caseId: string;
    kept: number;
    discarded: { filename: string; reason?: string }[];
  }[] = [];

  let processed = 0;
  for (const c of cases) {
    if (ONLY_ID && c.id !== ONLY_ID) continue;
    const ico = c.iconography ?? [];
    if (ico.length === 0) continue;
    if (
      RESUME &&
      ico.every((a) => Array.isArray(a.reveal_triggers) && a.reveal_triggers.length > 0)
    ) {
      continue;
    }
    if (processed >= LIMIT) break;
    processed++;

    console.log(`\n[${processed}] ${c.id} (${ico.length} image(s))`);
    let results: EnrichResult[] | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        results = await enrichCase(anthropic, c);
        break;
      } catch (e) {
        console.log(`    attempt ${attempt + 1} failed: ${(e as Error).message}`);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    if (!results) {
      console.log(`    ⚠ no results, leaving iconography unchanged`);
      continue;
    }

    const byName = new Map(results.map((r) => [r.filename, r]));
    // Read the latest iconography (enrichCase may have stripped missing files).
    const currentIco = c.iconography ?? [];
    const kept: AnnexEntry[] = [];
    const discarded: { filename: string; reason?: string }[] = [];
    for (const a of currentIco) {
      const r = byName.get(a.filename);
      if (!r) {
        kept.push(a);
        continue;
      }
      if (r.action === "discard") {
        discarded.push({ filename: a.filename, reason: r.reason });
        continue;
      }
      kept.push({
        filename: a.filename,
        description: r.description ?? a.description,
        type: r.type ?? a.type,
        url: a.url,
        reveal_triggers: r.reveal_triggers ?? [],
      });
    }
    c.iconography = kept;
    console.log(`    kept ${kept.length}, discarded ${discarded.length}`);
    for (const d of discarded) {
      console.log(`      ✗ ${d.filename} — ${d.reason ?? "no reason"}`);
    }
    log.push({ caseId: c.id, kept: kept.length, discarded });

    fs.writeFileSync(CASES_FILE, JSON.stringify(cases, null, 2));
    fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  }

  console.log("\n=== ENRICHMENT SUMMARY ===");
  const totalKept = log.reduce((a, b) => a + b.kept, 0);
  const totalDiscarded = log.reduce((a, b) => a + b.discarded.length, 0);
  console.log(`Cases processed: ${log.length}`);
  console.log(`Images kept:     ${totalKept}`);
  console.log(`Images discarded: ${totalDiscarded}`);
  console.log(`Log:             ${LOG_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
