import {
  buildWorksheetPrompt,
  buildLessonPrompt,
  buildQuizPrompt,
  buildActivityPrompt
} from "./promptBuilder";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const generateResource = async ({ type, formData }) => {
  let prompt = "";

  switch (type) {
    case "worksheet":
      prompt = buildWorksheetPrompt(formData);
      await wait(900);
      return {
        title: `${formData.topic} Worksheet`,
        summary: `A ready-to-use worksheet for ${formData.gradeLevel} learners focused on ${formData.objective}.`,
        sections: [
          {
            heading: "Warm-Up",
            items: ["Quick review questions", "Vocabulary preview", "Discussion prompt"]
          },
          {
            heading: "Practice",
            items: ["Fill in the blanks", "Short answer response", "Matching activity"]
          },
          {
            heading: "Reflection",
            items: ["What did you learn today?", "How would you explain this to a classmate?"]
          }
        ],
        note: `Estimated time: ${formData.duration}`,
        prompt
      };

    case "lesson":
      prompt = buildLessonPrompt(formData);
      await wait(900);
      return {
        title: `${formData.topic} Lesson Plan`,
        summary: `A structured lesson plan designed to help ${formData.gradeLevel} students engage with ${formData.topic}.`,
        sections: [
          { heading: "Objective", items: [formData.objective] },
          { heading: "Opening", items: ["Hook students with a question", "Activate prior knowledge"] },
          { heading: "Practice", items: ["Model the skill", "Guide collaborative work"] },
          { heading: "Closing", items: ["Exit ticket", "Share reflections"] }
        ],
        note: `Estimated time: ${formData.duration}`,
        prompt
      };

    case "quiz":
      prompt = buildQuizPrompt(formData);
      await wait(900);
      return {
        title: `${formData.topic} Quiz`,
        summary: `A concise assessment for ${formData.gradeLevel} students that checks understanding of ${formData.objective}.`,
        sections: [
          { heading: "Questions", items: ["What is the main idea?", "Which example fits best?", "Choose the correct answer."] },
          { heading: "Answer Key", items: ["1. B", "2. C", "3. A"] }
        ],
        note: `Estimated time: ${formData.duration}`,
        prompt
      };

    case "activity":
      prompt = buildActivityPrompt(formData);
      await wait(900);
      return {
        title: `${formData.topic} Activity Ideas`,
        summary: `Creative classroom activity ideas that support ${formData.objective} for ${formData.gradeLevel}.`,
        sections: [
          { heading: "Activity 1", items: ["Think-Pair-Share with visual prompts"] },
          { heading: "Activity 2", items: ["Mini gallery walk with peer feedback"] },
          { heading: "Activity 3", items: ["Hands-on problem-solving challenge"] }
        ],
        note: `Estimated time: ${formData.duration}`,
        prompt
      };

    default:
      return {
        title: "Generated Resource",
        summary: "Your content is ready.",
        sections: [],
        note: "",
        prompt
      };
  }
};
