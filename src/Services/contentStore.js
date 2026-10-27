import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { logActivity } from "./activityLog";
import { splitExamSections } from "./examPaper";

const LANGUAGE_KEY = "adiuvaret-language";
const FETCH_LIMIT = 200;

export const LANGUAGES = ["English", "Hindi"];

export const getLanguage = () => {
  const stored = localStorage.getItem(LANGUAGE_KEY);
  return LANGUAGES.includes(stored) ? stored : "English";
};

export const setLanguage = (language) => {
  localStorage.setItem(LANGUAGE_KEY, language);
};

export const RESOURCE_TYPES = {
  worksheet: { label: "Worksheet", path: "/worksheet", icon: "worksheet" },
  lesson: { label: "Lesson Plan", path: "/lesson", icon: "lesson" },
  quiz: { label: "Quiz", path: "/quiz", icon: "quiz" },
  activity: { label: "Activity", path: "/activities", icon: "activity" },
  exam: { label: "Exam Paper", path: "/exam", icon: "exam" }
};

// In-memory cache so consumers (notably Navbar's search) stay synchronous.
let currentUserId = null;
let entries = [];
let snapshot = { history: [], saved: [], ready: false };
const listeners = new Set();

const rebuildSnapshot = (ready = snapshot.ready) => {
  snapshot = {
    history: entries,
    saved: entries.filter((entry) => entry.isSaved),
    ready
  };
  listeners.forEach((listener) => listener());
};

const fromRow = (row) => {
  // An exam's `sections` is the student's paper. Papers saved before answer keys were kept apart have an
  // "Answer Guide" section in there; it is moved into the teacher-only answerKey rather than shown.
  const exam = row.type === "exam" ? splitExamSections(row.sections || []) : null;

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    summary: row.summary || "",
    note: row.note || "",
    sections: exam ? exam.paperSections : row.sections || [],
    answerKey: exam ? [...(Array.isArray(row.answer_key) ? row.answer_key : []), ...exam.answerKey] : undefined,
    questions: row.questions || undefined,
    className: row.class_name || "",
    subject: row.subject || "",
    isSaved: row.is_saved,
    savedAt: row.saved_at,
    createdAt: row.created_at
  };
};

export const subscribeContentStore = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getContentSnapshot = () => snapshot;

export const initContentStore = async (userId) => {
  if (!isSupabaseConfigured || !userId) return;
  currentUserId = userId;

  const { data, error } = await supabase
    .from("generated_content")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT);

  if (error) {
    console.warn("Could not load your content:", error.message);
    entries = [];
    rebuildSnapshot(true);
    return;
  }

  entries = (data || []).map(fromRow);
  rebuildSnapshot(true);
};

export const resetContentStore = () => {
  currentUserId = null;
  entries = [];
  rebuildSnapshot(false);
};

export const getHistory = () => snapshot.history;

export const getSavedContent = () => snapshot.saved;

export const isContentSaved = (id) => entries.some((entry) => entry.id === id && entry.isSaved);

export const recordHistory = async ({ type, formData, result }) => {
  const entry = {
    id: crypto.randomUUID(),
    type,
    title: result.title,
    summary: result.summary || "",
    note: result.note || "",
    sections: result.sections || [],
    answerKey: result.answerKey,
    questions: result.questions,
    className: formData?.className || "",
    subject: formData?.subject || "",
    isSaved: false,
    savedAt: null,
    createdAt: new Date().toISOString()
  };

  entries = [entry, ...entries];
  rebuildSnapshot();

  if (!isSupabaseConfigured || !currentUserId) return entry;

  const row = {
    id: entry.id,
    user_id: currentUserId,
    type: entry.type,
    title: entry.title,
    summary: entry.summary,
    note: entry.note,
    sections: entry.sections,
    questions: entry.questions ?? null,
    class_name: entry.className,
    subject: entry.subject,
    is_saved: false,
    created_at: entry.createdAt
  };
  if (entry.answerKey?.length) row.answer_key = entry.answerKey;

  let { error } = await supabase.from("generated_content").insert(row);

  // The answer_key column comes from the latest schema.sql. Until that has been run the paper is still
  // saved (just without its key) instead of the whole history entry being lost.
  if (error && row.answer_key && /answer_key/.test(error.message || "")) {
    console.warn("Run the latest supabase/schema.sql to keep exam answer keys. Saving the paper without its key for now.");
    const withoutKey = { ...row };
    delete withoutKey.answer_key;
    ({ error } = await supabase.from("generated_content").insert(withoutKey));
  }

  // A persistence failure must not lose the generated resource the user is looking at.
  if (error) {
    console.warn("Could not save to history:", error.message);
    return entry;
  }

  logActivity(currentUserId, "resource_generated", { type, title: entry.title });
  return entry;
};

const patchEntry = (id, changes) => {
  entries = entries.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry));
  rebuildSnapshot();
};

export const saveContent = async (entry) => {
  const savedAt = new Date().toISOString();
  patchEntry(entry.id, { isSaved: true, savedAt });

  if (!isSupabaseConfigured || !currentUserId) return;

  const { error } = await supabase
    .from("generated_content")
    .update({ is_saved: true, saved_at: savedAt })
    .eq("id", entry.id);

  if (error) {
    console.warn("Could not save this item:", error.message);
    patchEntry(entry.id, { isSaved: false, savedAt: null });
  }
};

export const removeSavedContent = async (id) => {
  patchEntry(id, { isSaved: false, savedAt: null });

  if (!isSupabaseConfigured || !currentUserId) return;

  const { error } = await supabase
    .from("generated_content")
    .update({ is_saved: false, saved_at: null })
    .eq("id", id);

  if (error) console.warn("Could not unsave this item:", error.message);
};

export const removeHistoryEntry = async (id) => {
  entries = entries.filter((entry) => entry.id !== id);
  rebuildSnapshot();

  if (!isSupabaseConfigured || !currentUserId) return;

  const { error } = await supabase.from("generated_content").delete().eq("id", id);
  if (error) console.warn("Could not delete this item:", error.message);
};

export const clearHistory = async () => {
  entries = entries.filter((entry) => entry.isSaved);
  rebuildSnapshot();

  if (!isSupabaseConfigured || !currentUserId) return;

  const { error } = await supabase
    .from("generated_content")
    .delete()
    .eq("user_id", currentUserId)
    .eq("is_saved", false);

  if (error) console.warn("Could not clear history:", error.message);
};
