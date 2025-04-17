// utils.ts
import { format } from "date-fns";

export function formatDate(dateString: string | null): string {
  if (!dateString) return "Not scheduled";
  try {
    return format(new Date(dateString), "MMM d, yyyy HH:mm:ss");
  } catch (err) {
    return "Invalid date";
  }
}

export function formatTime(timeString: string): string {
  try {
    const [hours, minutes] = timeString.split(":");
    return `${hours}:${minutes}`;
  } catch (err) {
    return timeString;
  }
}