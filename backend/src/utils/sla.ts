/**
 * Helper to retrieve the custom day code string for a given Date.
 * Maps standard JS Date.getDay() (0=Sunday, 1=Monday, ..., 6=Saturday) to the Drizzle schema format:
 * - Sunday is mapped to "7"
 * - Monday - Saturday are mapped to "1" - "6"
 * 
 * @param date The date to analyze
 * @returns A string code "1" through "7" representing the day of the week
 */
function getDayCode(date: Date): string {
  const day = date.getDay();
  return day === 0 ? "7" : String(day);
}

/**
 * Updates a Date object's hours, minutes, and seconds based on a time string format "HH:MM:SS" or "HH:MM".
 * 
 * @param date Reference Date object
 * @param timeStr Time string representation (e.g. "09:00:00")
 * @returns A new Date object set to the specified time on the same day
 */
function setDateTime(date: Date, timeStr: string): Date {
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const s = parseInt(parts[2], 10) || 0;
  const newDate = new Date(date);
  newDate.setHours(h, m, s, 0);
  return newDate;
}

/**
 * Increments a Date object by 1 day and sets its time to the business day start.
 * 
 * @param date Reference Date object
 * @param startStr Working hours start time string (e.g., "09:00:00")
 * @returns A new Date object rolled forward to the next day's business start time
 */
function rollToNextDayStart(date: Date, startStr: string): Date {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  return setDateTime(nextDay, startStr);
}

/**
 * Computes the due date deadline for a ticket by adding target SLA hours.
 * The calculation only increments time during business hours on active business days.
 * 
 * - If a ticket is created outside business hours or on a weekend, the start time is rolled
 *   forward to the beginning of the next business period.
 * - Spanning multiple days correctly consumes today's remaining minutes and carries over the remainder.
 * 
 * @param createdAt The initial ticket creation timestamp
 * @param hours Target SLA threshold hours (e.g., response time of 4 hours)
 * @param businessDays Array of active business day codes, e.g., ["1", "2", "3", "4", "5"] for Mon-Fri
 * @param startStr Business start time string (e.g. "09:00:00")
 * @param endStr Business end time string (e.g. "18:00:00")
 * @returns The computed Date representing the SLA deadline
 */
export function calculateDeadline(
  createdAt: Date,
  hours: number,
  businessDays: string[] = ["1", "2", "3", "4", "5"],
  startStr: string = "09:00:00",
  endStr: string = "18:00:00"
): Date {
  // Prevent infinite loops by enforcing default business days if empty
  const activeDays = businessDays && businessDays.length > 0 ? businessDays : ["1", "2", "3", "4", "5"];
  
  let remainingMinutes = Math.max(0, hours * 60);
  let curr = new Date(createdAt);

  // Safety guard limit to prevent infinite loops (e.g. max 100 days of traversal)
  let safetyCounter = 0;
  const maxIterations = 1000;

  while (remainingMinutes > 0 && safetyCounter < maxIterations) {
    safetyCounter++;
    const dayCode = getDayCode(curr);

    // 1. If today is not a business day, roll forward to tomorrow's business start
    if (!activeDays.includes(dayCode)) {
      curr = rollToNextDayStart(curr, startStr);
      continue;
    }

    // 2. Identify business boundaries for the current day
    const businessStart = setDateTime(curr, startStr);
    const businessEnd = setDateTime(curr, endStr);

    // 3. Handle time position relative to business boundaries
    if (curr.getTime() < businessStart.getTime()) {
      // Before business hours: roll to start of business today
      curr = businessStart;
    } else if (curr.getTime() >= businessEnd.getTime()) {
      // After business hours: roll to start of business tomorrow
      curr = rollToNextDayStart(curr, startStr);
    } else {
      // Within business hours: compute remaining minutes today
      const businessMinutesLeft = (businessEnd.getTime() - curr.getTime()) / 60000;

      if (remainingMinutes <= businessMinutesLeft) {
        // Can complete within the remaining business hours today
        curr = new Date(curr.getTime() + remainingMinutes * 60000);
        remainingMinutes = 0;
      } else {
        // Exceeds business hours today: consume today's time and roll to tomorrow
        remainingMinutes -= businessMinutesLeft;
        curr = rollToNextDayStart(curr, startStr);
      }
    }
  }

  return curr;
}
