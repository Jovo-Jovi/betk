/**
 * Feature: notifications
 * FR IDs:  FR-BUY-13 (notification centre), FR-ADM-13 (admin broadcast), FR-ADM-14 (WhatsApp templates)
 * UI Spec: §4.13 Notification centre, §6.13–6.14 Admin notifications
 * Tables:  betk.notifications, betk.whatsapp_templates
 * OD-3:    No campaign entity — broadcast fans out to betk.notifications directly.
 * OD-5:    Sessions UI OUT; WhatsApp templates under Admin → Settings → Notifications tab.
 */

export {};
