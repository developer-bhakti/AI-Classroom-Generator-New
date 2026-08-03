const HISTORY_KEY = "adiuvaret-history";
const SAVED_KEY = "adiuvaret-saved";
const HISTORY_LIMIT = 50;

export const RESOURCE_TYPES = {
  worksheet: { label: "Worksheet", path: "/worksheet", icon: "worksheet" },
  lesson: { label: "Lesson Plan", path: "/lesson", icon: "lesson" },
  quiz: { label: "Quiz", path: "/quiz", icon: "quiz" },
  activity: { label: "Activity", path: "/activities", icon: "activity" },
  exam: { label: "Exam Paper", path: "/exam", icon: "exam" }
};

const readList = (key) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeList = (key, list) => {
  localStorage.setItem(key, JSON.stringify(list));
  return list;
};

export const recordHistory = ({ type, formData, result }) => {
  const entry = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title: result.title,
    summary: result.summary,
    note: result.note,
    sections: result.sections,
    className: formData?.className || "",
    subject: formData?.subject || "",
    createdAt: new Date().toISOString()
  };

  writeList(HISTORY_KEY, [entry, ...readList(HISTORY_KEY)].slice(0, HISTORY_LIMIT));
  return entry;
};

export const getHistory = () => readList(HISTORY_KEY);

export const clearHistory = () => writeList(HISTORY_KEY, []);

export const removeHistoryEntry = (id) => writeList(HISTORY_KEY, readList(HISTORY_KEY).filter((item) => item.id !== id));

export const getSavedContent = () => readList(SAVED_KEY);

export const isContentSaved = (id) => readList(SAVED_KEY).some((item) => item.id === id);

export const saveContent = (entry) => {
  const saved = readList(SAVED_KEY);
  if (saved.some((item) => item.id === entry.id)) return saved;
  return writeList(SAVED_KEY, [{ ...entry, savedAt: new Date().toISOString() }, ...saved]);
};

export const removeSavedContent = (id) => writeList(SAVED_KEY, readList(SAVED_KEY).filter((item) => item.id !== id));
