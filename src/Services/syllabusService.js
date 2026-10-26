import { supabase } from "./supabaseClient";
import { generateSyllabusDraft } from "./geminiService";
import { buildSyllabusDraftPrompt } from "./assessmentPrompts";
import { ACADEMIC_MONTHS } from "./curriculum";

// The annual syllabus: one row per academic year, class, subject and month, holding that month's
// topics / learning outcomes. Terms are not stored — they follow from the month (see curriculum.js).

export const MAX_TOPICS_PER_MONTH = 15;
export const MAX_TOPIC_LENGTH = 160;

const UNIQUE_VIOLATION = "23505";

// ---- Pure helpers ----

/**
 * One topic per line, the way a teacher pastes them. Leading bullets and numbering ("1.", "-", "•")
 * are dropped, blank lines and repeats are ignored, and the list is capped so a paste of a whole
 * document cannot flood the assessment prompt.
 */
export const parseTopicLines = (value) => {
  const lines = Array.isArray(value) ? value : String(value ?? "").split(/\r?\n/);
  const seen = new Set();
  const topics = [];
  lines.forEach((line) => {
    const topic = String(line)
      .replace(/^\s*(?:[-*•–—]+|\d+[.)])\s*/u, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TOPIC_LENGTH)
      .trim();
    const key = topic.toLowerCase();
    if (topic && !seen.has(key)) {
      seen.add(key);
      topics.push(topic);
    }
  });
  return topics.slice(0, MAX_TOPICS_PER_MONTH);
};

export const topicsToText = (topics) => (topics || []).join("\n");

/** A teacher's own version of a month wins over the shared (school) one. */
export const pickMonthEntry = (entries, month) =>
  entries.find((entry) => entry.month === month && !entry.isShared)
  || entries.find((entry) => entry.month === month && entry.isShared)
  || null;

/** Reduces a syllabus lookup to what an assessment needs. */
export const summarizePeriod = (entries, months) => {
  const loaded = months.map((month) => {
    const entry = pickMonthEntry(entries, month);
    return { month, topics: entry?.topics || [], source: entry?.source || null, entryId: entry?.id || null };
  });
  return {
    months: loaded,
    missing: loaded.filter((item) => item.topics.length === 0).map((item) => item.month),
    topics: loaded.flatMap((item) => item.topics)
  };
};

// ---- Supabase ----

const fromRow = (row) => ({
  id: row.id,
  ownerId: row.owner_id,
  isShared: row.is_shared,
  academicYear: row.academic_year,
  className: row.class_name,
  subject: row.subject,
  month: row.month,
  topics: Array.isArray(row.topics) ? row.topics : [],
  updatedAt: row.updated_at,
  source: row.is_shared ? "school" : "mine"
});

const unwrap = ({ data, error }, action) => {
  if (error) throw new Error(`Could not ${action}: ${error.message}`);
  return data;
};

/** Every month of the year the signed-in user can see for this class and subject: the shared syllabus plus their own. */
export const listSyllabus = async ({ userId, academicYear, className, subject }) => {
  const rows = unwrap(
    await supabase
      .from("syllabus_entries")
      .select("*")
      .eq("academic_year", academicYear)
      .eq("class_name", className)
      .eq("subject", subject),
    "load the syllabus"
  );
  // An admin can read everyone's rows; each person works only with the shared syllabus and their own.
  return rows.filter((row) => row.is_shared || row.owner_id === userId).map(fromRow);
};

export const loadPeriodSyllabus = async ({ userId, academicYear, className, subject, months }) =>
  summarizePeriod(await listSyllabus({ userId, academicYear, className, subject }), months);

/**
 * Saves a month's topics as the teacher's own, or (admins only) as the shared school syllabus.
 * An empty list removes the entry. Returns the saved entry, or null when it was removed.
 */
export const saveSyllabusEntry = async ({ userId, shared = false, academicYear, className, subject, month, topics }) => {
  const cleaned = parseTopicLines(topics);

  const findExisting = async () => {
    let query = supabase
      .from("syllabus_entries")
      .select("id")
      .eq("academic_year", academicYear)
      .eq("class_name", className)
      .eq("subject", subject)
      .eq("month", month)
      .eq("is_shared", shared);
    if (!shared) query = query.eq("owner_id", userId);
    return unwrap(await query.maybeSingle(), "look up the syllabus");
  };

  const existing = await findExisting();

  if (cleaned.length === 0) {
    if (existing) unwrap(await supabase.from("syllabus_entries").delete().eq("id", existing.id), "remove the syllabus");
    return null;
  }

  const update = async (id) => fromRow(unwrap(
    await supabase.from("syllabus_entries").update({ topics: cleaned, updated_at: new Date().toISOString() }).eq("id", id).select().single(),
    "save the syllabus"
  ));

  if (existing) return update(existing.id);

  const inserted = await supabase
    .from("syllabus_entries")
    .insert({ owner_id: userId, is_shared: shared, academic_year: academicYear, class_name: className, subject, month, topics: cleaned })
    .select()
    .single();

  // Two tabs saving the same month at once: the loser updates the winner's row instead of failing.
  if (inserted.error?.code === UNIQUE_VIOLATION) {
    const raced = await findExisting();
    if (raced) return update(raced.id);
  }
  return fromRow(unwrap(inserted, "save the syllabus"));
};

// ---- AI drafting ----

/** A first draft for the given months (default: the whole year) as { [month]: topics[] }. Nothing is saved. */
export const draftSyllabus = async ({ className, subject, academicYear, months = ACADEMIC_MONTHS }) => {
  const drafted = await generateSyllabusDraft(buildSyllabusDraftPrompt({ className, subject, academicYear, months }));
  const byMonth = {};
  drafted.forEach((entry) => {
    if (months.includes(entry.month)) byMonth[entry.month] = parseTopicLines(entry.topics);
  });
  return byMonth;
};
