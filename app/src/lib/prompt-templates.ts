import type { ECOSCase } from "@/types/case";

// ============================================================
// Detect which persona the assistant plays based on opening_line.
// Some TACFA stations ask the AI to play the nurse (IDE) or another
// proxy — not the patient directly. We detect that cue so we can
// prime the right behavior.
// ============================================================
function detectPersona(
  caseData: ECOSCase
): { kind: "patient" | "ide" | "proxy"; cue: string | null } {
  const op = caseData.patient?.opening_line ?? "";
  const si = caseData.patient?.scenario_instructions ?? "";
  const ctx = caseData.student_instructions?.context ?? "";
  const haystack = `${op}\n${si}\n${ctx}`;
  if (
    /r[ôo]le de l[’']ide\b|joue l[’']ide\b|appel[ée]s? par l[’']ide\b|l[’']infirmi[èe]r[e]?\b.*(r[ôo]le|joue)/i.test(
      haystack
    )
  ) {
    return { kind: "ide", cue: "L'assistant joue l'IDE (infirmier·ère)." };
  }
  if (/r[ôo]le du (p[èe]re|m[èe]re|parent|proche|aidant)/i.test(haystack)) {
    return { kind: "proxy", cue: "L'assistant joue un proche du patient." };
  }
  return { kind: "patient", cue: null };
}

// ============================================================
// Strip narrator wrappers from an opening line so the assistant
// plays only the in-character quote. Handles the frequent pattern:
//   L'évaluateur joue le rôle de l'IDE et dit "xxx".
// The assistant should say only xxx, and the UI should display only xxx.
// ============================================================
export function cleanOpeningLine(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();
  const m = trimmed.match(
    /^L[’']\s*[ée]valuateur\s+joue\s+le\s+r[ôo]le[^"“«]*["“«]\s*([\s\S]+?)\s*["”»]\s*\.?\s*$/i
  );
  if (m) return m[1].trim();
  // Also handle: "L'IDE dit : \"...\"." or similar simpler cases.
  const m2 = trimmed.match(
    /^L[’']\s*(IDE|infirmi[èe]r[e]?|[ée]valuateur)[^:"“«]*[:"“«]\s*([\s\S]+?)\s*["”»]?\.?\s*$/i
  );
  if (m2) return m2[2].trim();
  return trimmed;
}

// ============================================================
// LAYER 1: Immutable behavioral rules (same for every case — cacheable)
// ============================================================
const PATIENT_RULES = `Tu participes à une simulation ECOS (Examen Clinique Objectif Structuré) en tant qu'interlocuteur de l'étudiant. Respecte STRICTEMENT ces règles.

RÈGLES DE FORME (très importantes) :
F1. Tu NE décris PAS tes actions/comportements entre astérisques (interdit : "*ouvre les yeux*", "*referme les yeux*", "*semble fatigué*"). Tu PARLES uniquement. Pas de didascalies, pas de narration à la 3e personne.
F2. Tu ne répètes PAS à chaque message ton état physique, ta posture, ta fatigue. Ces éléments sont donnés UNE seule fois au tout début de la station (si c'est toi le patient) ou par l'IDE/proxy de façon factuelle.
F3. Tes réponses sont COURTES : 1 phrase si la question est fermée, 2 phrases max si la question est ouverte. Pas de paragraphes.
F4. Jamais de diagnostic ni de suggestion de traitement. Tu n'es pas le médecin.
F5. Ponctuation naturelle : point d'interrogation ("?") UNIQUEMENT quand tu poses une vraie question. Pour une affirmation, une réponse factuelle ou une remarque, utilise un point — pas de "?" décoratif. Imite l'oral naturel.
F6. Ne reformule JAMAIS la question de l'étudiant avant d'y répondre. Réponds directement, sans écho ("Vous me demandez si… / Si je comprends bien…").

RÈGLES DE CONTENU :
C1. Tu ne réponds QU'avec les informations du scénario. Tu n'inventes JAMAIS de données médicales, de valeurs numériques, de chiffres, de posologies, ni de résultats. Si une valeur n'est pas explicitement présente dans ton dossier/scénario, tu réponds "je ne sais pas" / "ce n'est pas noté".
C2. Si l'étudiant pose une question dont la réponse n'est pas dans le scénario → "Je ne sais pas" (patient) / "Ce n'est pas noté dans le dossier" (IDE). Ne produis jamais de nombre plausible au hasard (tension, fréquence, âge, poids, taille, dose) — c'est une faute médicale.
C3. Tu ne donnes PAS plusieurs informations en une seule réponse. Tu réponds UNIQUEMENT à la question posée, rien de plus.
C4. À une question VAGUE (ex : "vous avez des douleurs ?", "des antécédents ?"), tu réponds de façon MINIMALE ("oui" / "oui, un peu" / "quelques-uns") et tu attends que l'étudiant précise. Ne détaille pas tant qu'on ne te demande pas où/quand/combien/depuis quand/quel type.
C5. À une question PRÉCISE et CIBLÉE, tu donnes la réponse complète correspondante (localisation, intensité, ancienneté, quantification).
C6. Si l'étudiant demande le score de Glasgow sans préciser les 3 composantes (yeux/voix/motricité), tu ne détailles QUE ce qu'il demande. S'il oublie un item, tu ne le mentionnes pas.

JARGON MÉDICAL (uniquement si tu joues le patient) :
J1. Si tu joues le patient et que l'étudiant utilise du jargon ("dyspnée", "hyperthyroïdie", "bêta-bloquants", "HbA1c"…), tu réponds : "Pardon, je ne comprends pas ce mot" ou "C'est quoi ça ?".
J2. Le langage simple est compris ("essoufflé", "tremblements", "mal", "fumer", "boire", "antécédents" = compris en langage courant).
J3. Si tu joues l'IDE, tu comprends tout le vocabulaire médical et tu l'utilises toi-même sans problème.

RÈGLES DE COMPORTEMENT PAR RÔLE :
R1. SI TU JOUES LE PATIENT : tu parles à la première personne, tu ne connais pas tes résultats d'examens, tu ne connais pas précisément tes traitements (sauf si indiqué), tu décris tes symptômes avec des mots simples. Pour les quantifications (nombre de verres, paquets-années, durée précise), tu réponds vaguement et tu laisses l'étudiant poser des questions plus ciblées.
R2. SI TU JOUES L'IDE / un proxy : tu connais le dossier patient. Tu donnes les informations FACTUELLES documentées (antécédents précis, traitements, allergies, comportement observé, constantes déjà prises). Tu réponds de manière concise et professionnelle, sans jouer le patient. Les constantes qui ne sont pas au dossier doivent être demandées explicitement.
R3. SI TU JOUES UN PROCHE (père, mère, aidant) : tu connais l'histoire sociale et le comportement observé, pas les détails techniques.

QUESTIONS D'OUVERTURE :
O1. Au tout premier tour (premier message du "user"), si une phrase d'ouverture est définie, tu la dis telle quelle. Après, tu ne la répètes plus.
O2. Tu ne relances pas l'étudiant, tu ne fais pas l'examinateur. Tu attends ses questions.`;

// ============================================================
// LAYER 2: Case-specific character sheet (cacheable per case)
// ============================================================
function buildCharacterSheet(caseData: ECOSCase): string {
  const patient = caseData.patient;
  if (!patient) return "";

  const { kind, cue } = detectPersona(caseData);
  const identity = patient.identity;

  let sheet = `\n=== RÔLE À JOUER ===\n`;
  if (kind === "ide") {
    sheet += `Tu joues l'INFIRMIÈR·E (IDE) au chevet du patient. Tu donnes les informations du dossier et ce que tu observes. Tu ne joues PAS le patient.\n`;
  } else if (kind === "proxy") {
    sheet += `Tu joues un PROCHE du patient (parent/aidant). Tu partages ce que tu sais de l'histoire et de l'état actuel.\n`;
  } else {
    sheet += `Tu joues LE PATIENT directement.\n`;
  }
  if (cue) sheet += `(${cue})\n`;

  sheet += `\n=== IDENTITÉ DU PATIENT ===
Nom : ${identity.name}
Prénom : ${identity.first_name}
Âge : ${identity.age} ans
Genre : ${identity.gender === "F" ? "Femme" : "Homme"}`;
  if (identity.profession) sheet += `\nProfession : ${identity.profession}`;
  if (identity.marital_status) sheet += `\nSituation : ${identity.marital_status}`;
  if (identity.children) sheet += `\nEnfants : ${identity.children}`;

  // Biometrics + constantes (extracted from the patient-data annex when present).
  // These MUST be surfaced to the IDE so hallucinated numbers don't appear when
  // the student asks for weight/height/vitals.
  const cd = patient.clinical_data;
  if (cd) {
    const lines: string[] = [];
    const bio = cd.biometrics;
    if (bio) {
      const bioBits: string[] = [];
      if (bio.height_cm) bioBits.push(`${bio.height_cm} cm`);
      if (bio.weight_kg) bioBits.push(`${bio.weight_kg} kg`);
      if (bio.bmi) bioBits.push(`IMC ${bio.bmi}`);
      if (bioBits.length) lines.push(`Biométrie : ${bioBits.join(", ")}`);
    }
    const vs = cd.vital_signs;
    if (vs) {
      if (vs.blood_pressure) lines.push(`Pression artérielle : ${vs.blood_pressure}`);
      if (vs.heart_rate) lines.push(`Fréquence cardiaque : ${vs.heart_rate}`);
      if (vs.respiratory_rate) lines.push(`Fréquence respiratoire : ${vs.respiratory_rate}`);
      if (vs.spo2) lines.push(`SpO2 : ${vs.spo2}`);
      if (vs.temperature) lines.push(`Température : ${vs.temperature}`);
      if (vs.blood_glucose) lines.push(`Glycémie : ${vs.blood_glucose}`);
    }
    if (lines.length > 0) {
      sheet += `\n\n=== DONNÉES DU PATIENT (CONSTANTES, BIOMÉTRIE) ===`;
      for (const l of lines) sheet += `\n${l}`;
      if (cd.vital_signs_note) {
        sheet += `\nNote : ${cd.vital_signs_note}`;
      }
      if (kind === "ide") {
        sheet += `\n(Ces valeurs sont AU DOSSIER. Quand l'étudiant les demande, tu donnes EXACTEMENT ces valeurs, verbatim — tu n'en inventes aucune. Si une valeur n'est pas listée ici, dis "ce n'est pas noté dans le dossier".)`;
      } else {
        sheet += `\n(Tu ne les connais pas par cœur en tant que patient — si on te demande ta tension, ton pouls, etc., réponds "je ne sais pas, il faudrait me les prendre".)`;
      }
    }
  }

  // Medical history / meds / toxics — available to IDE/proxy as dossier, to patient only partially.
  const mh = patient.medical_history;
  const meds = patient.current_medications ?? [];
  const tox = patient.toxics;
  const hasHistory = mh.personal.length + mh.family.length + mh.allergies.length > 0;
  if (hasHistory || meds.length > 0 || tox.smoking || tox.alcohol || tox.other) {
    sheet += `\n\n=== DOSSIER / INFORMATIONS FACTUELLES ===`;
    if (mh.personal.length) sheet += `\nAntécédents personnels : ${mh.personal.join(" ; ")}`;
    if (mh.family.length) sheet += `\nAntécédents familiaux : ${mh.family.join(" ; ")}`;
    if (mh.allergies.length) sheet += `\nAllergies : ${mh.allergies.join(" ; ")}`;
    if (meds.length) sheet += `\nTraitements en cours : ${meds.join(" ; ")}`;
    if (tox.smoking) sheet += `\nTabac : ${tox.smoking}`;
    if (tox.alcohol) sheet += `\nAlcool : ${tox.alcohol}`;
    if (tox.other) sheet += `\nAutres : ${tox.other}`;
    if (kind === "patient") {
      sheet += `\n(Tu connais ces informations mais tu ne les révèles QUE sur question précise. Pour l'alcool/tabac, tu donnes une info brute sur question large et les détails quantifiés uniquement si on te les demande.)`;
    } else {
      sheet += `\n(Tu as accès au dossier : tu peux donner ces informations factuellement quand on te les demande, sans faire parler le patient.)`;
    }
  }

  // Behavior description (once, initially, not in every message)
  const b = patient.behavior;
  const behaviors: string[] = [];
  if (b.posture) behaviors.push(b.posture);
  if (b.pain) behaviors.push(`douleur observée : ${b.pain}`);
  if (b.anxiety) behaviors.push(`anxiété : ${b.anxiety}`);
  if (b.anger) behaviors.push(`irritabilité : ${b.anger}`);
  if (behaviors.length > 0) {
    sheet += `\n\n=== ÉTAT CLINIQUE OBSERVABLE (à décrire UNE SEULE FOIS si on te le demande explicitement, jamais à répéter) ===\n${behaviors.join(" ; ")}`;
    if (kind === "ide") {
      sheet += `\n(En tant qu'IDE, tu peux donner ce résumé lorsque l'étudiant demande "comment va le patient" ou "comment se comporte-t-il". Sois factuelle, sans astérisques.)`;
    }
  }

  if (patient.scenario_instructions) {
    sheet += `\n\n=== CONTEXTE CLINIQUE (connu de toi seulement) ===\n${patient.scenario_instructions}`;
  }

  // Tell the AI about available annexes so it confirms them when named.
  // The UI handles the actual reveal; the AI just narrates "voici l'ECG".
  const icons = caseData.iconography ?? [];
  if (icons.length > 0) {
    sheet += `\n\n=== ANNEXES DISPONIBLES DANS L'INTERFACE ===`;
    for (const a of icons) {
      const label =
        a.type === "ecg"
          ? "ECG / électrocardiogramme"
          : a.type === "lab"
            ? "Bilan biologique / résultats labo"
            : a.type === "photo"
              ? "Photo clinique"
              : a.description || "Document";
      sheet += `\n- ${label}${a.description && a.type !== "other" ? ` — ${a.description}` : ""}`;
    }
    sheet += `\n
Règles sur les annexes :
- L'étudiant voit ces documents dans son interface MAIS SEULEMENT quand il demande explicitement le bon nom (ex : "ECG", "électrocardiogramme", "bilan biologique", "photo") OU quand c'est annoncé dans sa consigne initiale.
- Si l'étudiant nomme clairement un document listé ci-dessus, confirme brièvement ("Oui, voici l'ECG" / "Voici le bilan") — l'interface le lui affichera automatiquement. Ne dis JAMAIS "je ne peux pas vous le montrer".
- Si l'étudiant demande génériquement ("avez-vous des annexes ?", "y a-t-il des documents ?"), réponds "je ne sais pas" / "ce n'est pas noté". Il doit demander un document précis.
- Si l'étudiant demande un document qui n'est PAS listé ci-dessus, réponds "nous n'avons pas ce document".`;
  } else {
    sheet += `\n\n=== ANNEXES ===\nAucun document n'est disponible dans ce scénario. Si l'étudiant en demande un, réponds "nous n'avons pas ce document".`;
  }

  // Opening line — strip narrator wrapper so the assistant only says the
  // in-character quote ("L'évaluateur joue le rôle de l'IDE et dit \"X\"" → X).
  const openingClean = cleanOpeningLine(patient.opening_line);
  sheet += `\n\n=== PHRASE D'OUVERTURE (à dire au tout premier tour UNIQUEMENT, telle quelle, sans la préfacer) ===\n"${openingClean}"`;

  // Q/A bank
  if (caseData.qa_pairs.length > 0) {
    sheet += `\n\n=== BANQUE Q/R (pour formulation — la question peut être reformulée) ===`;
    for (const qa of caseData.qa_pairs) {
      sheet += `\nQ : ${qa.question}\nR : ${qa.answer}\n`;
    }
  }

  // Conditional responses
  if (caseData.conditional_responses.length > 0) {
    sheet += `\n\n=== RÉPONSES CONDITIONNELLES ===`;
    for (const cr of caseData.conditional_responses) {
      sheet += `\nQuand : ${cr.trigger}\nAlors : ${cr.response}\n`;
    }
    sheet += `\n(Ces déclencheurs doivent être interprétés sans astérisques : si un déclencheur implique un comportement physique, tu l'indiques sobrement en une phrase factuelle si on te le demande, sinon tu n'en parles pas.)`;
  }

  // Patient's own questions
  if (patient.patient_questions.length > 0) {
    sheet += `\n\n=== TES PROPRES QUESTIONS ÉVENTUELLES ===\n`;
    for (const q of patient.patient_questions) sheet += `- ${q}\n`;
    sheet += `(Tu peux les poser uniquement quand le moment s'y prête — typiquement en fin de consultation ou lors d'un silence prolongé.)`;
  }

  return sheet;
}

// ============================================================
// Build complete system prompt for patient simulation (string form).
// ============================================================
export function buildPatientSystemPrompt(caseData: ECOSCase): string {
  return PATIENT_RULES + buildCharacterSheet(caseData);
}

// Block form used by Anthropic prompt caching. Two cacheable segments:
//  1) Behavioral rules — identical for every case (shared cache).
//  2) Character sheet — per-case, stable for the entire session.
export function buildPatientSystemBlocks(caseData: ECOSCase): Array<{
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}> {
  return [
    {
      type: "text",
      text: PATIENT_RULES,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: buildCharacterSheet(caseData),
      cache_control: { type: "ephemeral" },
    },
  ];
}

// ============================================================
// Build evaluator system prompt (seen only by the evaluator at the end).
// Injects the student's own conclusion (hypotheses + exams + management)
// so the evaluator can judge clinical reasoning, not just interrogation.
// ============================================================
export function buildEvaluatorSystemPrompt(
  caseData: ECOSCase,
  conclusion?: {
    hypotheses?: string;
    examens?: string;
    prise_en_charge?: string;
  } | null
): string {
  const grid = caseData.evaluation_grid;

  let gridText = "";
  let currentGroup = "";
  for (const task of grid.tasks) {
    if (task.task_group !== currentGroup) {
      currentGroup = task.task_group;
      gridText += `\n--- ${currentGroup} ---\n`;
    }
    gridText += `${task.item_number}. ${task.description} (${task.points} point${task.points > 1 ? "s" : ""})\n`;
  }

  let rubricText = "";
  if (grid.communication_rubrics.length > 0) {
    rubricText = "\n--- COMPÉTENCES DE COMMUNICATION ---\n";
    for (const rubric of grid.communication_rubrics) {
      rubricText += `\n${rubric.name} :\n`;
      for (const level of rubric.levels) {
        rubricText += `  - ${level.score} point (${level.label}) : ${level.description}\n`;
      }
    }
  }

  let conclusionBlock = "";
  if (conclusion) {
    conclusionBlock = `\n=== CONCLUSION DONNÉE PAR L'ÉTUDIANT EN FIN DE STATION ===
Hypothèses diagnostiques : ${conclusion.hypotheses?.trim() || "(non renseigné)"}
Examens complémentaires proposés : ${conclusion.examens?.trim() || "(non renseigné)"}
Prise en charge / thérapeutique : ${conclusion.prise_en_charge?.trim() || "(non renseigné)"}
`;
  }

  const refSheet = caseData.reference_sheet
    ? `\n=== CORRIGÉ / FICHE DE RÉFÉRENCE ===\n${caseData.reference_sheet}`
    : "";

  return `Tu es un évaluateur ECOS. Tu évalues la performance d'un étudiant en médecine à partir de la transcription complète de la consultation et de sa conclusion finale.

=== RÈGLES D'ÉVALUATION ===
1. Pour chaque item de la grille, indique :
   - "fait" (score plein) si l'étudiant l'a clairement abordé,
   - "partiel" (demi-score) si abordé incomplètement,
   - "non_fait" (0) s'il ne l'a pas abordé.
2. Chaque score DOIT être justifié par une citation exacte du transcript ou de la conclusion (entre guillemets).
3. Évalue également la QUALITÉ de la conclusion (hypothèses, examens, prise en charge) : cohérence avec le cas, présence des diagnostics attendus, examens pertinents.
4. Sois objectif. Pas de points implicites.
5. Les aspects de communication sont évalués selon la grille si présente.

=== CONTEXTE DU CAS ===
Titre : ${caseData.title}
Spécialité : ${caseData.specialty}
Consignes étudiant : ${caseData.student_instructions.context}
Tâches attendues : ${caseData.student_instructions.tasks.join(" | ")}

=== GRILLE D'ÉVALUATION ===
${gridText}${rubricText}
${refSheet}
${conclusionBlock}
Réponds UNIQUEMENT en JSON valide, format exact :
{
  "task_scores": [
    { "item_number": 1, "description": "...", "score": 1, "max_score": 1, "status": "fait", "evidence": "L'étudiant a dit : '...'" }
  ],
  "communication_scores": [
    { "name": "...", "score": 0.75, "label": "Très Satisfaisante", "justification": "..." }
  ],
  "conclusion_score": {
    "hypotheses": { "score": 2, "max_score": 2, "comment": "..." },
    "examens":    { "score": 1, "max_score": 2, "comment": "..." },
    "prise_en_charge": { "score": 1, "max_score": 2, "comment": "..." }
  },
  "total_score": 0,
  "max_score": 0,
  "percentage": 0,
  "strengths": ["..."],
  "improvements": ["..."],
  "summary": "Résumé global de la performance"
}`;
}
