/**
 * PDF Extraction Script
 *
 * Extracts structured data from ECOS exam PDFs using Claude Vision API.
 * Run with: npx tsx scripts/extract-cases.ts
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY env variable set
 * - PDFs in ../Banque de sujets ECOS/
 *
 * Output: extracted-cases.json in scripts/output/
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("ERROR: Set ANTHROPIC_API_KEY environment variable");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const PDF_ROOT = path.resolve(__dirname, "../../Banque de sujets ECOS");
const OUTPUT_DIR = path.resolve(__dirname, "output");

// DES group mapping from folder names
const DES_MAP: Record<string, { des_group: number; specialty: string }> = {
  "DES n°1": { des_group: 1, specialty: "Chirurgie tête et cou" },
  "DES n°2": { des_group: 2, specialty: "Chirurgie hors tête et cou" },
  "DES n°3": { des_group: 3, specialty: "Médecine de l'aigu (MAR/MIR/Urgences)" },
  "DES n°4": { des_group: 4, specialty: "Radiologie / Médecine nucléaire" },
  "DES n°5": { des_group: 5, specialty: "Biologie / Génétique médicale" },
  "DES n°6": { des_group: 6, specialty: "Santé publique / Médecine légale" },
  "DES n°7": { des_group: 7, specialty: "Endocrinologie / Nutrition / Gynécologie" },
  "DES n°8": { des_group: 8, specialty: "Spécialités médicales transversales" },
  "DES n°9": { des_group: 9, specialty: "Psychiatrie / Neurologie / MPR" },
  "DES n°10": { des_group: 10, specialty: "Oncologie / HGE / Hématologie" },
  "DES n°11": { des_group: 11, specialty: "Pédiatrie" },
  "DES n°12": { des_group: 12, specialty: "Cardiologie / Pneumologie / Néphrologie" },
  "DES n°13": { des_group: 13, specialty: "Médecine générale" },
  "Sujets concours blanc": { des_group: 0, specialty: "Concours blanc TACFA" },
};

const EXTRACTION_PROMPT = `Tu es un extracteur de données structurées. Tu reçois un PDF d'un sujet d'examen ECOS médical français. Extrais toutes les informations en JSON structuré.

IMPORTANT: Préserve le texte français EXACT tel qu'il apparaît dans le document. N'invente rien, ne traduis rien.

Réponds UNIQUEMENT en JSON valide avec ce format :

{
  "sdd_number": <number>,
  "subject_number": <number, default 1>,
  "title": "<titre du sujet>",
  "format": "<tutecos | tacfa_patient | tacfa_no_patient>",
  "metadata": {
    "author": "<auteur>",
    "date": "<date>",
    "competency_domains": ["<domaine 1>", "<domaine 2>"],
    "learning_objectives": ["<objectif 1>"],
    "requires_simulated_patient": <true|false>,
    "requires_mannequin": <false>,
    "materials": ["<matériel>"],
    "time_limit_minutes": <8>
  },
  "student_instructions": {
    "context": "<le paragraphe de contexte clinique donné à l'étudiant>",
    "tasks": ["<tâche 1>", "<tâche 2>"],
    "constraints": ["<contrainte 1>"]
  },
  "patient": {
    "identity": {
      "name": "<nom>",
      "first_name": "<prénom>",
      "age": <number>,
      "gender": "<M|F>",
      "profession": "<profession>",
      "marital_status": "<situation>",
      "children": "<enfants>"
    },
    "medical_history": {
      "personal": ["<antécédent 1>"],
      "family": ["<antécédent familial>"],
      "allergies": ["<allergie>"]
    },
    "current_medications": ["<médicament>"],
    "toxics": {
      "smoking": "<tabac>",
      "alcohol": "<alcool>",
      "other": ""
    },
    "behavior": {
      "posture": "<posture>",
      "pain": "<douleur>",
      "anxiety": "<anxiété>",
      "anger": "<colère>"
    },
    "opening_line": "<la phrase d'ouverture du patient>",
    "scenario_instructions": "<instructions générales au patient>",
    "patient_questions": ["<question que le patient pose au médecin>"]
  },
  "qa_pairs": [
    {
      "question": "<question que l'étudiant pourrait poser>",
      "answer": "<réponse du patient>"
    }
  ],
  "conditional_responses": [
    {
      "trigger": "<condition: Si l'étudiant demande...>",
      "response": "<réponse>"
    }
  ],
  "evaluation_grid": {
    "tasks": [
      {
        "task_group": "<nom du groupe de tâches>",
        "item_number": <number>,
        "description": "<description de l'item>",
        "points": <number>,
        "scoring_type": "<binary|weighted>",
        "acceptable_answers": []
      }
    ],
    "communication_rubrics": [
      {
        "name": "<nom de la compétence>",
        "levels": [
          { "score": 0, "label": "Insuffisante", "description": "<description>" },
          { "score": 0.25, "label": "Limite", "description": "<description>" },
          { "score": 0.5, "label": "Satisfaisante", "description": "<description>" },
          { "score": 0.75, "label": "Très Satisfaisante", "description": "<description>" },
          { "score": 1, "label": "Remarquable", "description": "<description>" }
        ]
      }
    ]
  },
  "reference_sheet": "<texte de la fiche de correction/référence si présente, sinon null>"
}

RÈGLES :
- Si le PDF n'a PAS de patient simulé (station "sans patient"), mets "patient": null et "format": "tacfa_no_patient"
- Si le PDF est format TUT'ECOS (avec tableau Q/R), mets "format": "tutecos"
- Si le PDF est format TACFA avec patient, mets "format": "tacfa_patient"
- Pour qa_pairs: extrais CHAQUE ligne du tableau question/réponse
- Pour evaluation_grid: extrais CHAQUE item de la grille d'évaluation
- Si un champ n'existe pas dans le PDF, utilise null ou une valeur par défaut vide
- Le SDD number est dans le titre du document (ex: "SDD 194")`;

function findDesGroup(folderName: string): { des_group: number; specialty: string } {
  for (const [prefix, info] of Object.entries(DES_MAP)) {
    if (folderName.includes(prefix)) return info;
  }
  return { des_group: 0, specialty: "Inconnu" };
}

function generateCaseId(sddNumber: number, subjectNumber: number, folderName: string): string {
  const cleanFolder = folderName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 30);
  return `sdd-${sddNumber}-${subjectNumber}-${cleanFolder}`;
}

async function findAllPDFs(): Promise<{ filePath: string; folderName: string }[]> {
  const results: { filePath: string; folderName: string }[] = [];

  function scanDir(dir: string, parentFolder: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath, entry.name);
      } else if (entry.name.toLowerCase().endsWith(".pdf")) {
        results.push({ filePath: fullPath, folderName: parentFolder });
      }
    }
  }

  scanDir(PDF_ROOT, "");
  return results;
}

async function extractCase(
  filePath: string,
  folderName: string
): Promise<Record<string, unknown> | null> {
  const fileName = path.basename(filePath);
  console.log(`  Extracting: ${fileName}`);

  try {
    // Read PDF as base64
    const pdfBuffer = fs.readFileSync(filePath);
    const pdfBase64 = pdfBuffer.toString("base64");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock?.text ?? "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`    WARN: No JSON found in response for ${fileName}`);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Add metadata from folder structure
    const { des_group, specialty } = findDesGroup(folderName);
    const sddNumber = parsed.sdd_number ?? 0;
    const subjectNumber = parsed.subject_number ?? 1;

    return {
      id: generateCaseId(sddNumber, subjectNumber, folderName),
      source_pdf: fileName,
      des_group,
      specialty: parsed.specialty ?? specialty,
      ...parsed,
    };
  } catch (error) {
    console.error(`    ERROR extracting ${fileName}:`, error);
    return null;
  }
}

async function main() {
  console.log("=== ECOS PDF Extraction Pipeline ===\n");

  // Find all PDFs
  const pdfs = await findAllPDFs();
  console.log(`Found ${pdfs.length} PDF files\n`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const results: Record<string, unknown>[] = [];
  const errors: string[] = [];

  // Process PDFs sequentially (to respect API rate limits)
  for (let i = 0; i < pdfs.length; i++) {
    const { filePath, folderName } = pdfs[i];
    console.log(`[${i + 1}/${pdfs.length}] Processing ${path.basename(filePath)}`);

    const result = await extractCase(filePath, folderName);
    if (result) {
      results.push(result);
      console.log(`    OK: ${result.title ?? "untitled"}`);
    } else {
      errors.push(filePath);
      console.log(`    FAILED`);
    }

    // Save progress every 10 files
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(
        path.join(OUTPUT_DIR, "extracted-cases-progress.json"),
        JSON.stringify(results, null, 2)
      );
      console.log(`  [Progress saved: ${results.length} cases]\n`);
    }

    // Rate limit: small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Save final output
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "extracted-cases.json"),
    JSON.stringify(results, null, 2)
  );

  // Save errors
  if (errors.length > 0) {
    fs.writeFileSync(
      path.join(OUTPUT_DIR, "extraction-errors.json"),
      JSON.stringify(errors, null, 2)
    );
  }

  console.log("\n=== Extraction Complete ===");
  console.log(`Successes: ${results.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Output: ${path.join(OUTPUT_DIR, "extracted-cases.json")}`);
}

main().catch(console.error);
