// ============================================================
// Sentence case for interface labels (Workspace v3: "Event name", not
// "Event Name"). The first word keeps its case; every later word written as
// Capitalised lower-case is lowered, unless it is a proper noun. Acronyms and
// words with inner capitals (GST, BD, WhatsApp, CapEx) are never touched.
// Used where a label arrives as data or from a shared definition (table
// column titles, server-built stage labels); literal copy should simply be
// written in sentence case.
// ============================================================

const PROPER = new Set([
  // brands and products
  "Veloria", "Grand", "Velos", "Google", "Ads", "Meta", "Facebook", "Instagram", "Razorpay", "Tally",
  "Zoho", "Gemini", "Claude", "Weflux", "Excel", "Outlook", "Gmail", "Apple", "Android", "Six", "Sigma",
  // places, festivals, languages
  "India", "Indian", "Bengaluru", "Bangalore", "Hosur", "Muhurtham", "Diwali", "English", "Hindi",
  "Kannada", "Tamil", "Telugu",
  // calendar
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
  "November", "December", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
]);

export function sentenceCase(label: string): string {
  let first = true;
  return label.replace(/[A-Za-z][A-Za-z'’]*/g, (word) => {
    if (first) {
      first = false;
      return word;
    }
    return /^[A-Z][a-z'’]+$/.test(word) && !PROPER.has(word) ? word.toLowerCase() : word;
  });
}
