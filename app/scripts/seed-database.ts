/**
 * Database Seeding Script
 *
 * Loads extracted cases from JSON into MariaDB.
 * Run with: npx tsx scripts/seed-database.ts
 *
 * Prerequisites:
 * - MariaDB running on DB_HOST with database 'ecos'
 * - scripts/output/extracted-cases.json exists (from extract-cases.ts)
 */

import mysql from "mysql2/promise";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const casesPath = path.resolve(__dirname, "output/extracted-cases.json");

  if (!fs.existsSync(casesPath)) {
    console.error("ERROR: extracted-cases.json not found. Run extract-cases.ts first.");
    process.exit(1);
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || "192.168.64.8",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "ecos",
    password: process.env.DB_PASSWORD || "ecos_pass_2024",
    database: process.env.DB_NAME || "ecos",
    charset: "utf8mb4",
  });

  const cases = JSON.parse(fs.readFileSync(casesPath, "utf-8"));
  console.log(`Loading ${cases.length} cases into MariaDB...\n`);

  let success = 0;
  let errors = 0;

  for (const c of cases) {
    try {
      await pool.query(
        `INSERT INTO cases
          (id, sdd_number, subject_number, title, specialty, des_group, format,
           source_pdf, metadata, student_instructions, patient, qa_pairs,
           conditional_responses, evaluation_grid, reference_sheet, iconography)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title = VALUES(title),
           metadata = VALUES(metadata),
           student_instructions = VALUES(student_instructions),
           patient = VALUES(patient),
           qa_pairs = VALUES(qa_pairs),
           conditional_responses = VALUES(conditional_responses),
           evaluation_grid = VALUES(evaluation_grid),
           reference_sheet = VALUES(reference_sheet)`,
        [
          c.id,
          c.sdd_number ?? 0,
          c.subject_number ?? 1,
          c.title ?? "Sans titre",
          c.specialty ?? "Inconnu",
          c.des_group ?? 0,
          c.format ?? "tutecos",
          c.source_pdf ?? "",
          JSON.stringify(c.metadata ?? {}),
          JSON.stringify(c.student_instructions ?? {}),
          c.patient ? JSON.stringify(c.patient) : null,
          JSON.stringify(c.qa_pairs ?? []),
          JSON.stringify(c.conditional_responses ?? []),
          JSON.stringify(c.evaluation_grid ?? {}),
          c.reference_sheet ?? null,
          JSON.stringify(c.iconography ?? []),
        ]
      );
      success++;
      if (success % 20 === 0) console.log(`  Inserted ${success} cases...`);
    } catch (error) {
      console.error(`  ERROR inserting ${c.id}:`, error);
      errors++;
    }
  }

  await pool.end();

  console.log(`\n=== Seeding Complete ===`);
  console.log(`Success: ${success}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
