export const buildWorksheetPrompt = ({ topic, gradeLevel, duration, objective }) => {
  return `Create a printable classroom worksheet on ${topic} for ${gradeLevel} students. The worksheet should be engaging, age-appropriate, and aligned to the goal: ${objective}. Include a warm-up section, 5 practice tasks, a short reflection prompt, and a teacher answer key. Keep it concise and ready to use in class, with a clear title and estimated duration of ${duration}.`;
};

export const buildLessonPrompt = ({ topic, gradeLevel, duration, objective }) => {
  return `Create a complete lesson plan for ${topic} tailored to ${gradeLevel} students. The lesson should include a learning objective of ${objective}, an opening activity, guided practice, independent practice, and a closing reflection. Keep the structure teacher-friendly and estimate the lesson length at ${duration}.`;
};

export const buildQuizPrompt = ({ topic, gradeLevel, duration, objective }) => {
  return `Create a short quiz on ${topic} for ${gradeLevel} students to assess ${objective}. Include 6 questions with multiple choice answers, one correct answer per question, and a brief answer key. Keep it concise and suitable for a ${duration} activity.`;
};

export const buildActivityPrompt = ({ topic, gradeLevel, duration, objective }) => {
  return `Generate 4 creative classroom activity ideas for ${topic} for ${gradeLevel} students. Each activity should support ${objective}, be hands-on, and fit into a ${duration} session. Include a short setup instruction and an expected learning outcome for each idea.`;
};
