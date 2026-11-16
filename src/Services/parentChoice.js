// The question a parent is asked after a quiz, and what each answer does. Kept apart from the component so the
// exact wording can be checked on its own and shown the same way everywhere (quiz page, admin list).

export const PARENT_QUESTION = "Based on your child's performance, we recommend additional learning support. How would you like to proceed?";

// A child who got everything right is not told they need support; the choices are still there for a parent who wants them.
export const PARENT_QUESTION_PERFECT = "Your child answered every question correctly. If you would still like extra learning support, how would you like to proceed?";

export const OFFLINE_THANK_YOU = "Thank you for your interest! We appreciate your response. Our team will connect with you regarding offline tuition classes.";

export const PARENT_CHOICES = { offline: "offline", ai: "ai" };

// The activity_log action recorded for each answer (labelled for admins in activityLog.js).
export const PARENT_CHOICE_ACTIONS = {
  offline: "parent_chose_offline_tuition",
  ai: "parent_chose_ai_classes"
};

export const PARENT_CHOICE_LABELS = {
  offline: "Offline Tuition Classes",
  ai: "AI Classes"
};
