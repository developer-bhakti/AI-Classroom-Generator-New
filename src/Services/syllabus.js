// Built-in syllabus topics the assessment flow can offer as tick-boxes.
//
// PLACEHOLDER: only Class 3 Math is listed, and its topics are a standard primary-maths
// breakdown of the four areas in the Class 3 syllabus (Number Sense & Place Value, Arithmetic
// Operations, Geometry/Shapes/Patterns, Measurement & Data Handling). Replace the topic names
// with the school's own syllabus wording — the AI is told to stay inside whatever is listed.
//
// Any class/subject without an entry here still works: the teacher types the topics that were
// covered, or an end-term paper falls back to the standard syllabus for that class.

const SYLLABUS = {
  "Class 3": {
    Math: [
      {
        area: "Number Sense & Place Value",
        topics: [
          "Numbers up to 1000 (reading and writing)",
          "Place value: ones, tens and hundreds",
          "Expanded form of numbers",
          "Comparing and ordering numbers",
          "Skip counting and number patterns"
        ]
      },
      {
        area: "Arithmetic Operations",
        topics: [
          "Addition with and without regrouping",
          "Subtraction with and without borrowing",
          "Multiplication tables (2 to 10)",
          "Multiplication as repeated addition",
          "Division as equal sharing and grouping",
          "Word problems on the four operations"
        ]
      },
      {
        area: "Geometry, Shapes & Patterns",
        topics: [
          "2D shapes and their properties",
          "3D shapes (faces, edges, corners)",
          "Lines of symmetry",
          "Shape and number patterns"
        ]
      },
      {
        area: "Measurement & Data Handling",
        topics: [
          "Length: centimetres and metres",
          "Weight: grams and kilograms",
          "Capacity: millilitres and litres",
          "Telling time (hours and minutes)",
          "Money: rupees and paise",
          "Reading pictographs and tally marks"
        ]
      }
    ]
  }
};

export const getSyllabusAreas = (className, subject) => SYLLABUS[className]?.[subject] || [];

export const getSyllabusTopics = (className, subject) =>
  getSyllabusAreas(className, subject).flatMap((area) => area.topics);

export const hasBuiltInSyllabus = (className, subject) => getSyllabusAreas(className, subject).length > 0;
