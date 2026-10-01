// Class and subject choices for the assessment pages. This mirrors the lists the generator
// pages each keep locally; the assessment flow shares one copy.

export const classOptions = ["PG", "Nursery", "LKG", "UKG", ...Array.from({ length: 12 }, (_, index) => `Class ${index + 1}`)];

export const subjectMap = {
  "PG": ["English", "Math", "EVS"],
  "Nursery": ["English", "Math", "EVS"],
  "LKG": ["English", "Math", "EVS"],
  "UKG": ["English", "Math", "EVS"],
  "Class 1": ["English", "Math", "EVS"],
  "Class 2": ["English", "Math", "EVS"],
  "Class 3": ["English", "Math", "Science"],
  "Class 4": ["English", "Math", "Science"],
  "Class 5": ["English", "Math", "Science"],
  "Class 6": ["English", "Math", "Science", "Social Studies"],
  "Class 7": ["English", "Math", "Science", "Social Studies"],
  "Class 8": ["English", "Math", "Science", "Social Studies"],
  "Class 9": ["English", "Math", "Science", "History"],
  "Class 10": ["English", "Math", "Science", "History"],
  "Class 11": ["Physics", "Chemistry", "Biology", "Math"],
  "Class 12": ["Physics", "Chemistry", "Biology", "Math", "Computer Science"]
};
