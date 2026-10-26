// Prints a document with a meaningful title. Browsers use the page title as the file name when
// someone chooses "Save as PDF", so "Asha - Progress Report" beats "Adiuvaret AI Classroom Generator".

export const printWithTitle = (title) => {
  const previous = document.title;
  const restore = () => {
    document.title = previous;
    window.removeEventListener("afterprint", restore);
  };
  document.title = title;
  window.addEventListener("afterprint", restore);
  window.print();
};
