// ============================================================
// SMS Message Templates
// ============================================================
// Short text messages for common notification types.
// Keep messages concise — SMS has ~160 character limit per segment.

import { APP_NAME } from "@/lib/constants";

// ============================================================
// Booking Confirmation
// ============================================================

export function bookingConfirmationSMS(params: {
  contactName: string;
  bookingNumber: string;
  eventDate: string;
  venueName: string;
}): string {
  return `Hi ${params.contactName}, your booking #${params.bookingNumber} at ${params.venueName} on ${params.eventDate} is confirmed. - ${APP_NAME}`;
}

// ============================================================
// Payment Received
// ============================================================

export function paymentReceivedSMS(params: {
  contactName: string;
  amount: string;
  invoiceNumber: string;
}): string {
  return `Hi ${params.contactName}, we received your payment of ${params.amount} for invoice ${params.invoiceNumber}. Thank you! - ${APP_NAME}`;
}

// ============================================================
// Event Reminder
// ============================================================

export function reminderSMS(params: {
  contactName: string;
  eventName: string;
  eventDate: string;
  daysUntil: number;
}): string {
  return `Hi ${params.contactName}, reminder: "${params.eventName}" is in ${params.daysUntil} day(s) on ${params.eventDate}. - ${APP_NAME}`;
}

// ============================================================
// Payment Due
// ============================================================

export function paymentDueSMS(params: {
  contactName: string;
  amount: string;
  dueDate: string;
}): string {
  return `Hi ${params.contactName}, payment of ${params.amount} is due on ${params.dueDate}. Please pay to avoid late fees. - ${APP_NAME}`;
}

// ============================================================
// Tasting Scheduled
// ============================================================

export function tastingScheduledSMS(params: {
  contactName: string;
  date: string;
  time: string;
  venueName: string;
}): string {
  return `Hi ${params.contactName}, your tasting is scheduled for ${params.date} at ${params.time}, ${params.venueName}. - ${APP_NAME}`;
}

// ============================================================
// Invoice Sent
// ============================================================

export function invoiceSentSMS(params: {
  contactName: string;
  invoiceNumber: string;
  amount: string;
}): string {
  return `Hi ${params.contactName}, invoice ${params.invoiceNumber} for ${params.amount} has been sent. Please check your email for details. - ${APP_NAME}`;
}

// ============================================================
// Task Assigned
// ============================================================

export function taskAssignedSMS(params: {
  assigneeName: string;
  taskTitle: string;
  dueDate?: string;
}): string {
  const due = params.dueDate ? ` Due: ${params.dueDate}.` : "";
  return `Hi ${params.assigneeName}, you've been assigned: "${params.taskTitle}".${due} - ${APP_NAME}`;
}

// ============================================================
// Lead Assigned
// ============================================================

export function leadAssignedSMS(params: {
  assigneeName: string;
  leadName: string;
  source: string;
}): string {
  return `Hi ${params.assigneeName}, new lead assigned: ${params.leadName} (${params.source}). Follow up soon! - ${APP_NAME}`;
}
