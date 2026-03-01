// ============================================================
// Default Reminder Message Templates
// ============================================================

export interface ReminderTemplateData {
  stage: string;
  subject: string;
  messageTemplate: string;
}

export const DEFAULT_REMINDER_TEMPLATES: Record<string, ReminderTemplateData> = {
  SAVE_THE_DATE: {
    stage: "SAVE_THE_DATE",
    subject: "Save the Date",
    messageTemplate: "✨ *Save the Date!*\n\nDear {guestName},\n\nYou're invited to *{eventName}* on *{eventDate}*!\n\n📍 {venueName}\n\nMore details coming soon. Mark your calendar! 🗓️\n\n— Veloria Grand",
  },
  EXCITEMENT_BUILDER: {
    stage: "EXCITEMENT_BUILDER",
    subject: "Excitement Builder",
    messageTemplate: "🎉 *Just {daysUntil} days to go!*\n\nHi {guestName},\n\n*{eventName}* is almost here! We're preparing something truly special for you.\n\nStay tuned for more details! ✨\n\n— Veloria Grand",
  },
  FINAL_COUNTDOWN: {
    stage: "FINAL_COUNTDOWN",
    subject: "Final Countdown",
    messageTemplate: "⏳ *3 Days Until {eventName}!*\n\nHi {guestName},\n\nThe countdown is on! Here's what you need to know:\n\n📅 *Date:* {eventDate}\n🕐 *Time:* {eventTime}\n📍 *Venue:* {venueName}\n\nWe can't wait to see you there! 🌟\n\n— Veloria Grand",
  },
  TOMORROW_REMINDER: {
    stage: "TOMORROW_REMINDER",
    subject: "Tomorrow Reminder",
    messageTemplate: "🌟 *Tomorrow is the big day!*\n\nHi {guestName},\n\n*{eventName}* is happening tomorrow!\n\n🕐 *Time:* {eventTime}\n📍 *Venue:* {venueName}\n\nGet ready for an unforgettable experience! See you there! 🎊\n\n— Veloria Grand",
  },
  DAY_OF_WELCOME: {
    stage: "DAY_OF_WELCOME",
    subject: "Day-Of Welcome",
    messageTemplate: "🎊 *Today is the day!*\n\nGood morning {guestName}!\n\nWelcome to *{eventName}*! We're all set and ready for you.\n\n🕐 *Time:* {eventTime}\n📍 *Venue:* {venueName}\n\nSee you soon! ✨\n\n— Veloria Grand",
  },
};

/**
 * Get the default template for a reminder stage.
 */
export function getDefaultTemplate(stage: string): ReminderTemplateData {
  return DEFAULT_REMINDER_TEMPLATES[stage] || DEFAULT_REMINDER_TEMPLATES.SAVE_THE_DATE;
}

/**
 * Build a reminder message by replacing template placeholders.
 */
export function buildReminderMessage(
  template: string,
  params: Record<string, string>
): string {
  let message = template;
  for (const [key, value] of Object.entries(params)) {
    message = message.replaceAll(`{${key}}`, value);
  }
  return message;
}
