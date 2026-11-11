import { useQuery } from "@tanstack/react-query";
import { fetchSlots } from "../api";
import { availabilityKey } from "./keys";

/**
 * Public booking availability for one date + total duration, shared by
 * the patient reschedule picker and the Panel's manual booking form.
 * data is { open, slots } or null when the function is unreachable.
 */
export function useAvailability(
  date: string,
  durationMinutes: number,
  enabled = true,
) {
  return useQuery({
    queryKey: availabilityKey(date, durationMinutes),
    queryFn: () => fetchSlots(date, durationMinutes),
    enabled: enabled && Boolean(date) && durationMinutes > 0,
    staleTime: 15_000,
  });
}
