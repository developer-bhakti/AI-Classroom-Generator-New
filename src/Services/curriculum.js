// Class, subject and academic-calendar choices: the ONE place the classes the app serves are defined.
// Every generator, the syllabus, the assessment and the dashboard import from here, so changing the
// range means editing this list and nothing else.
//
// The app serves pre-primary to Class 3. To widen it again, add classes to CLASS_SUBJECTS below
// (older classes get the text-led question mix automatically; see isYoungLearner).

const CLASS_SUBJECTS = {
  "PG": ["English", "Math", "EVS"],
  "Nursery": ["English", "Math", "EVS"],
  "LKG": ["English", "Math", "EVS"],
  "UKG": ["English", "Math", "EVS"],
  "Class 1": ["English", "Math", "EVS"],
  "Class 2": ["English", "Math", "EVS"],
  "Class 3": ["English", "Math", "Science"]
};

export const classOptions = Object.keys(CLASS_SUBJECTS);

export const subjectMap = CLASS_SUBJECTS;

// ---- Who the learners are ----

export const PRESCHOOL_CLASSES = ["PG", "Nursery", "LKG", "UKG"];

export const isPreschool = (className) => PRESCHOOL_CLASSES.includes(className);

// Children who are still learning to read get picture and activity questions that an adult reads
// aloud; older classes get a text-led paper.
export const isYoungLearner = (className) => isPreschool(className) || className === "Class 1" || className === "Class 2";

const AGE_NOTES = {
  "PG": "about 2 to 3 years old",
  "Nursery": "about 3 to 4 years old",
  "LKG": "about 4 to 5 years old",
  "UKG": "about 5 to 6 years old",
  "Class 1": "about 6 to 7 years old",
  "Class 2": "about 7 to 8 years old",
  "Class 3": "about 8 to 9 years old"
};

export const describeLearners = (className) => (AGE_NOTES[className] ? `${className} children (${AGE_NOTES[className]})` : `${className} students`);

// ---- Academic calendar ----
// Indian academic years run April to March, so "2026-27" starts in April 2026.

export const ACADEMIC_MONTHS = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Annual syllabus -> term syllabus -> monthly syllabus. Three months to a term; the fourth term
// (January to March) is what keeps the last quarter of the year from having nowhere to live.
export const TERMS = [
  { id: 1, name: "Term 1", months: ["April", "May", "June"] },
  { id: 2, name: "Term 2", months: ["July", "August", "September"] },
  { id: 3, name: "Term 3", months: ["October", "November", "December"] },
  { id: 4, name: "Term 4", months: ["January", "February", "March"] }
];

export const termForMonth = (month) => TERMS.find((term) => term.months.includes(month)) || null;

export const termLabel = (term) => `${term.name} (${term.months[0]}–${term.months[term.months.length - 1]})`;

export const academicYearStartingIn = (startYear) => `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;

export const currentAcademicYear = (today = new Date()) =>
  academicYearStartingIn(today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1);

/** This year and the two before it, newest first — enough to assess a child on last year's syllabus too. */
export const academicYearOptions = (today = new Date()) => {
  const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return [startYear, startYear - 1, startYear - 2].map(academicYearStartingIn);
};

export const currentMonthName = (today = new Date()) => MONTH_NAMES[today.getMonth()];

/**
 * An assessment covers one month ("October"), or a whole term for an end-term paper ("term:3").
 * Returns null for anything else.
 */
export const parsePeriod = (value) => {
  if (ACADEMIC_MONTHS.includes(value)) return { kind: "current", key: value, label: value, months: [value] };
  const match = /^term:(\d)$/.exec(value || "");
  const term = match && TERMS.find((candidate) => String(candidate.id) === match[1]);
  return term ? { kind: "end_term", key: value, label: termLabel(term), months: term.months } : null;
};
