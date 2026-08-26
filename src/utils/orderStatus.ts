import { SystemSettings } from '../types';

/**
 * Checks whether receiving orders is currently open or closed based on
 * system settings (manual override and weekly schedule).
 */
export function checkIsStoreOpen(settings: SystemSettings | null | undefined): {
  isOpen: boolean;
  reason?: string;
} {
  if (!settings) {
    return { isOpen: true };
  }

  // 1. Check manual override status first (highest priority)
  if (settings.isManualOverrideActive) {
    if (!settings.manualOrdersOpen) {
      return {
        isOpen: false,
        reason: 'عذرًا، تم إغلاق استقبال الطلبات حاليًا بقرار من الإدارة. يرجى المحاولة مرة أخرى لاحقًا.',
      };
    }
    return { isOpen: true };
  }

  // 2. Check automated weekly schedule if enabled
  if (settings.scheduleEnabled && Array.isArray(settings.weeklySchedule) && settings.weeklySchedule.length > 0) {
    const dayNames: Record<number, string> = {
      0: 'sun',
      1: 'mon',
      2: 'tue',
      3: 'wed',
      4: 'thu',
      5: 'fri',
      6: 'sat',
    };

    const now = new Date();
    const currentDayKey = dayNames[now.getDay()];
    const dayConfig = settings.weeklySchedule.find((d) => d.dayKey === currentDayKey);

    if (!dayConfig || !dayConfig.isOpen) {
      return {
        isOpen: false,
        reason: 'عذرًا، استقبال الطلبات مغلق اليوم وفقًا لمواعيد العمل الرسمية.',
      };
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [oH, oM] = (dayConfig.openTime || '08:00').split(':').map(Number);
    const [cH, cM] = (dayConfig.closeTime || '22:00').split(':').map(Number);

    const openMinutes = oH * 60 + oM;
    const closeMinutes = cH * 60 + cM;

    if (currentMinutes < openMinutes || currentMinutes > closeMinutes) {
      return {
        isOpen: false,
        reason: `عذرًا، استقبال الطلبات مغلق في هذا التوقيت. مواعيد العمل اليوم من ${dayConfig.openTime} حتى ${dayConfig.closeTime}.`,
      };
    }
  }

  return { isOpen: true };
}
