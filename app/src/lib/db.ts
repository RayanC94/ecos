import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { AnnexItem, ECOSCase } from "@/types/case";

// ----------------------------------------------------------------
// Supabase clients
// ----------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let anonClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

/**
 * Anonymous / RLS-enforced client. Safe for any server-side handler.
 * Uses the publishable key so every query respects the RLS policies.
 */
export function getSupabase(): SupabaseClient {
  if (!anonClient) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    }
    anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
  }
  return anonClient;
}

/**
 * Service-role client — bypasses RLS. Use only in trusted server-side
 * contexts (seed scripts, admin tasks). NEVER expose to the browser.
 */
export function getSupabaseService(): SupabaseClient {
  if (!serviceClient) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for this operation");
    }
    serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });
  }
  return serviceClient;
}

// ----------------------------------------------------------------
// Row → ECOSCase mapping
//
// Supabase returns JSONB as real objects, so we no longer need to
// JSON.parse anything. This helper just strips away Supabase meta
// columns and shapes the row into the ECOSCase type.
// ----------------------------------------------------------------

export function rowToCase(row: Record<string, unknown>): ECOSCase {
  return {
    id: row.id as string,
    sdd_number: (row.sdd_number as number) ?? 0,
    subject_number: (row.subject_number as number) ?? 1,
    title: (row.title as string) ?? "",
    specialty: (row.specialty as string) ?? "",
    des_group: (row.des_group as number) ?? 0,
    format: row.format as ECOSCase["format"],
    source_pdf: (row.source_pdf as string) ?? "",
    metadata: (row.metadata as ECOSCase["metadata"]) ?? {
      author: "",
      date: "",
      competency_domains: [],
      learning_objectives: [],
      requires_simulated_patient: true,
      requires_mannequin: false,
      materials: [],
      time_limit_minutes: 8,
    },
    student_instructions: (row.student_instructions as ECOSCase["student_instructions"]) ?? {
      context: "",
      tasks: [],
      constraints: [],
    },
    patient: (row.patient as ECOSCase["patient"]) ?? null,
    qa_pairs: (row.qa_pairs as ECOSCase["qa_pairs"]) ?? [],
    conditional_responses: (row.conditional_responses as ECOSCase["conditional_responses"]) ?? [],
    evaluation_grid: (row.evaluation_grid as ECOSCase["evaluation_grid"]) ?? {
      tasks: [],
      communication_rubrics: [],
    },
    reference_sheet: row.reference_sheet as string | undefined,
    iconography: normalizeIconography(row.iconography),
  };
}

// Normalise the iconography field — legacy rows may store string[], newer rows store AnnexItem[].
export function normalizeIconography(raw: unknown): AnnexItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") {
      return {
        filename: "",
        description: item,
        type: "other" as const,
        url: "",
        initially_visible: false,
        reveal_triggers: [],
      };
    }
    const obj = item as Partial<AnnexItem>;
    return {
      filename: obj.filename ?? "",
      description: obj.description ?? "",
      type: (obj.type ?? "other") as AnnexItem["type"],
      url: obj.url ?? "",
      initially_visible: obj.initially_visible ?? false,
      reveal_triggers: obj.reveal_triggers ?? [],
    };
  });
}
