import { z } from "zod";

// --- Zod Schemas (validation) ---

export const PatientIdentitySchema = z.object({
  name: z.string(),
  first_name: z.string(),
  age: z.number(),
  gender: z.enum(["M", "F"]),
  profession: z.string().default(""),
  marital_status: z.string().default(""),
  children: z.string().default(""),
});

export const MedicalHistorySchema = z.object({
  personal: z.array(z.string()).default([]),
  family: z.array(z.string()).default([]),
  allergies: z.array(z.string()).default([]),
});

export const ToxicsSchema = z.object({
  smoking: z.string().default(""),
  alcohol: z.string().default(""),
  other: z.string().default(""),
});

export const BehaviorSchema = z.object({
  posture: z.string().default(""),
  pain: z.string().default(""),
  anxiety: z.string().default(""),
  anger: z.string().default(""),
});

export const PatientProfileSchema = z.object({
  identity: PatientIdentitySchema,
  medical_history: MedicalHistorySchema,
  current_medications: z.array(z.string()).default([]),
  toxics: ToxicsSchema,
  behavior: BehaviorSchema,
  opening_line: z.string(),
  scenario_instructions: z.string().default(""),
  patient_questions: z.array(z.string()).default([]),
});

export const QAPairSchema = z.object({
  question: z.string(),
  answer: z.string(),
  category: z.string().optional(),
});

export const ConditionalResponseSchema = z.object({
  trigger: z.string(),
  response: z.string(),
});

export const EvaluationTaskSchema = z.object({
  task_group: z.string(),
  item_number: z.number(),
  description: z.string(),
  points: z.number().default(1),
  scoring_type: z.enum(["binary", "weighted"]).default("binary"),
  acceptable_answers: z.array(z.string()).default([]),
});

export const CommunicationRubricLevelSchema = z.object({
  score: z.number(),
  label: z.string(),
  description: z.string(),
});

export const CommunicationRubricSchema = z.object({
  name: z.string(),
  levels: z.array(CommunicationRubricLevelSchema),
});

export const EvaluationGridSchema = z.object({
  tasks: z.array(EvaluationTaskSchema),
  communication_rubrics: z.array(CommunicationRubricSchema).default([]),
  total_points: z.number().optional(),
});

export const CaseMetadataSchema = z.object({
  author: z.string().default(""),
  date: z.string().default(""),
  competency_domains: z.array(z.string()).default([]),
  learning_objectives: z.array(z.string()).default([]),
  requires_simulated_patient: z.boolean().default(true),
  requires_mannequin: z.boolean().default(false),
  materials: z.array(z.string()).default([]),
  time_limit_minutes: z.number().default(8),
});

export const StudentInstructionsSchema = z.object({
  context: z.string(),
  tasks: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
});

export const ECOSCaseSchema = z.object({
  id: z.string(),
  sdd_number: z.number(),
  subject_number: z.number().default(1),
  title: z.string(),
  specialty: z.string(),
  des_group: z.number(),
  format: z.enum(["tutecos", "tacfa_patient", "tacfa_no_patient"]),
  source_pdf: z.string(),
  metadata: CaseMetadataSchema,
  student_instructions: StudentInstructionsSchema,
  patient: PatientProfileSchema.nullable().default(null),
  qa_pairs: z.array(QAPairSchema).default([]),
  conditional_responses: z.array(ConditionalResponseSchema).default([]),
  evaluation_grid: EvaluationGridSchema,
  reference_sheet: z.string().optional(),
  iconography: z.array(z.string()).default([]),
});

// --- TypeScript types (inferred from Zod) ---

export type PatientIdentity = z.infer<typeof PatientIdentitySchema>;
export type MedicalHistory = z.infer<typeof MedicalHistorySchema>;
export type Toxics = z.infer<typeof ToxicsSchema>;
export type Behavior = z.infer<typeof BehaviorSchema>;
export type PatientProfile = z.infer<typeof PatientProfileSchema>;
export type QAPair = z.infer<typeof QAPairSchema>;
export type ConditionalResponse = z.infer<typeof ConditionalResponseSchema>;
export type EvaluationTask = z.infer<typeof EvaluationTaskSchema>;
export type CommunicationRubricLevel = z.infer<typeof CommunicationRubricLevelSchema>;
export type CommunicationRubric = z.infer<typeof CommunicationRubricSchema>;
export type EvaluationGrid = z.infer<typeof EvaluationGridSchema>;
export type CaseMetadata = z.infer<typeof CaseMetadataSchema>;
export type StudentInstructions = z.infer<typeof StudentInstructionsSchema>;
export type ECOSCase = z.infer<typeof ECOSCaseSchema>;
