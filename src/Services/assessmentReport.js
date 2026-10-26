import {
  AREA_EMOJI,
  SKILL_AREAS,
  deriveStrengths,
  getPerformanceLevel,
  summarizeAreas,
  toneForLevelLabel
} from "./assessmentGrading";

// Turns a saved assessment into the parent-friendly "Child Progress Report". Everything the report
// shows is worked out here, so the on-screen version and the printed one cannot disagree.

const FALLBACK_AREA = "Cognitive Skills";

/**
 * Weak topics grouped under the development area they belong to, in the standard order, each group
 * carrying how the child did across that whole area.
 */
export const groupAreasOfImprovement = (weakAreas, areaResults) => {
  const topicsByArea = new Map();
  (weakAreas || []).forEach((weak) => {
    const name = weak.area || FALLBACK_AREA;
    topicsByArea.set(name, [...(topicsByArea.get(name) || []), weak]);
  });
  const ordered = [...SKILL_AREAS.filter((name) => topicsByArea.has(name)), ...[...topicsByArea.keys()].filter((name) => !SKILL_AREAS.includes(name))];

  return ordered.map((name) => ({
    area: name,
    emoji: AREA_EMOJI[name] || "🎯",
    percentage: (areaResults || []).find((entry) => entry.area === name)?.percentage ?? null,
    topics: topicsByArea.get(name)
  }));
};

export const buildProgressReport = ({ assessment, student }) => {
  const level = getPerformanceLevel(assessment.percentage);
  const areaResults = assessment.areaResults || summarizeAreas(assessment.questions, assessment.results);
  const weakAreas = assessment.weakAreas || [];
  const plans = new Map((assessment.improvementPlan || []).map((item) => [item.skill.trim().toLowerCase(), item]));

  const areasOfImprovement = groupAreasOfImprovement(weakAreas, areaResults).map((group) => ({ ...group, topics: group.topics.map((weak) => weak.skill) }));

  const topicsToPractise = weakAreas.map((weak) => ({
    topic: weak.skill,
    area: weak.area || FALLBACK_AREA,
    diagnosis: weak.diagnosis || "",
    rating: weak.rating || null,
    tips: plans.get(weak.skill.trim().toLowerCase())?.activities || []
  }));

  const strengths = deriveStrengths(assessment.skillResults || [], assessment.skillRatings || []).map((entry) => ({
    topic: entry.skill,
    area: entry.area,
    percentage: entry.percentage
  }));

  return {
    studentName: student.name,
    className: assessment.className,
    subject: assessment.subject,
    month: assessment.month || "",
    academicYear: assessment.academicYear || "",
    date: assessment.createdAt,
    total: assessment.total,
    correct: assessment.correct,
    incorrect: assessment.total - assessment.correct,
    percentage: assessment.percentage,
    level: level.label,
    tone: toneForLevelLabel(level.label),
    summary: assessment.summary || "",
    strengths,
    areasOfImprovement,
    topicsToPractise,
    remarks: (assessment.teacherRemarks || "").trim()
  };
};
