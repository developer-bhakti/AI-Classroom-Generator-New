import { supabase } from "./supabaseClient";
import { logActivity } from "./activityLog";
import { MASTERY_THRESHOLD, findSkillKey } from "./assessmentGrading";

// Everything here is scoped to the signed-in teacher by row-level security; teacherId is passed in
// only because inserts must stamp it on the row.

const unwrap = ({ data, error }, action) => {
  if (error) throw new Error(`Could not ${action}: ${error.message}`);
  return data;
};

const fromStudentRow = (row) => ({
  id: row.id,
  name: row.name,
  className: row.class_name || "",
  createdAt: row.created_at
});

const fromAssessmentRow = (row) => ({
  id: row.id,
  studentId: row.student_id,
  kind: row.kind,
  className: row.class_name,
  subject: row.subject,
  topics: row.topics || [],
  progressNote: row.progress_note || "",
  focusSkill: row.focus_skill || null,
  questions: row.questions || [],
  answers: row.answers || [],
  // Per-question outcome, including typed answers the AI review overturned — not re-derivable from the key alone.
  results: row.results || [],
  total: row.total,
  correct: row.correct,
  percentage: Number(row.percentage),
  level: row.level,
  weakAreas: row.weak_areas || [],
  skillResults: row.skill_results || [],
  recommendations: row.recommendations || [],
  summary: row.summary || "",
  createdAt: row.created_at
});

const fromTopicRow = (row) => ({
  id: row.id,
  subject: row.subject,
  skill: row.skill,
  status: row.status,
  lastScore: Number(row.last_score),
  attempts: row.attempts,
  updatedAt: row.updated_at
});

const fromSessionRow = (row) => ({
  id: row.id,
  subject: row.subject,
  skill: row.skill,
  practiceCorrect: row.practice_correct,
  practiceTotal: row.practice_total,
  createdAt: row.created_at
});

// ---- Students ----

export const listStudents = async () => {
  const rows = unwrap(await supabase.from("students").select("*").order("name", { ascending: true }), "load your students");
  return rows.map(fromStudentRow);
};

export const addStudent = async ({ teacherId, name, className }) => {
  const row = unwrap(
    await supabase.from("students").insert({ teacher_id: teacherId, name: name.trim(), class_name: className }).select().single(),
    "add the student"
  );
  return fromStudentRow(row);
};

export const deleteStudent = async (studentId) => {
  unwrap(await supabase.from("students").delete().eq("id", studentId), "remove the student");
};

// ---- Assessments ----

export const listAssessments = async (studentId) => {
  const rows = unwrap(
    await supabase.from("assessments").select("*").eq("student_id", studentId).order("created_at", { ascending: true }),
    "load assessments"
  );
  return rows.map(fromAssessmentRow);
};

/** What a new paper should know about this child: skills still unmastered and the last full-paper score. */
export const getStudentHistory = async (studentId, subject) => {
  const [topics, papers] = await Promise.all([
    supabase.from("student_topics").select("skill").eq("student_id", studentId).eq("subject", subject).eq("status", "needs_practice"),
    supabase.from("assessments").select("percentage").eq("student_id", studentId).eq("subject", subject).neq("kind", "practice").order("created_at", { ascending: false }).limit(1)
  ]);
  if (topics.error || papers.error) return { weakSkills: [], lastPercentage: null };
  return {
    weakSkills: (topics.data || []).map((row) => row.skill),
    lastPercentage: papers.data?.[0] ? Number(papers.data[0].percentage) : null
  };
};

/** Writes one finished paper and refreshes the child's per-skill mastery from it. */
export const saveAssessment = async ({ teacherId, studentId, assessment }) => {
  const row = {
    id: assessment.id,
    teacher_id: teacherId,
    student_id: studentId,
    kind: assessment.kind,
    class_name: assessment.className,
    subject: assessment.subject,
    topics: assessment.topics || [],
    progress_note: assessment.progressNote || "",
    focus_skill: assessment.focusSkill || null,
    questions: assessment.questions,
    answers: assessment.answers,
    results: assessment.results,
    total: assessment.total,
    correct: assessment.correct,
    percentage: assessment.percentage,
    level: assessment.level,
    weak_areas: assessment.weakAreas,
    skill_results: assessment.skillResults,
    recommendations: assessment.recommendations,
    summary: assessment.summary
  };

  const saved = unwrap(await supabase.from("assessments").insert(row).select().single(), "save the assessment");

  // The paper is safely stored at this point; a hiccup updating mastery shouldn't discard it.
  try {
    await saveTopicStatuses({ teacherId, studentId, subject: assessment.subject, skillResults: assessment.skillResults });
  } catch (err) {
    console.warn(err.message);
  }

  logActivity(teacherId, "assessment_completed", { kind: assessment.kind, subject: assessment.subject, percentage: assessment.percentage });
  return fromAssessmentRow(saved);
};

// ---- Skill mastery ----

export const listStudentTopics = async (studentId) => {
  const rows = unwrap(
    await supabase.from("student_topics").select("*").eq("student_id", studentId).order("updated_at", { ascending: false }),
    "load topic progress"
  );
  return rows.map(fromTopicRow);
};

export const saveTopicStatuses = async ({ teacherId, studentId, subject, skillResults }) => {
  if (skillResults.length === 0) return;

  const existing = unwrap(
    await supabase.from("student_topics").select("skill, attempts").eq("student_id", studentId).eq("subject", subject),
    "read topic progress"
  );
  // "Place value" and "Place Value" are the same skill; reuse the stored spelling so the upsert hits that row.
  const existingByKey = new Map(existing.map((row) => [findSkillKey(row.skill), row]));

  const rows = skillResults.map((entry) => {
    const previous = existingByKey.get(findSkillKey(entry.skill));
    return {
      student_id: studentId,
      teacher_id: teacherId,
      subject,
      skill: previous?.skill || entry.skill,
      status: entry.percentage >= MASTERY_THRESHOLD ? "mastered" : "needs_practice",
      last_score: entry.percentage,
      attempts: (previous?.attempts || 0) + 1,
      updated_at: new Date().toISOString()
    };
  });

  unwrap(await supabase.from("student_topics").upsert(rows, { onConflict: "student_id,subject,skill" }), "update topic progress");
};

// ---- AI teaching sessions ----

export const listTeachingSessions = async (studentId) => {
  const rows = unwrap(
    await supabase
      .from("teaching_sessions")
      .select("id, subject, skill, practice_correct, practice_total, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    "load teaching sessions"
  );
  return rows.map(fromSessionRow);
};

export const saveTeachingSession = async ({ teacherId, studentId, assessmentId, subject, skill, transcript, practiceCorrect, practiceTotal }) => {
  unwrap(
    await supabase.from("teaching_sessions").insert({
      id: crypto.randomUUID(),
      teacher_id: teacherId,
      student_id: studentId,
      assessment_id: assessmentId || null,
      subject,
      skill,
      transcript,
      practice_correct: practiceCorrect,
      practice_total: practiceTotal
    }),
    "save the teaching session"
  );
  logActivity(teacherId, "teaching_session_completed", { subject, skill });
};
