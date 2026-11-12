import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { fetchBookingSummary, fetchDayRange } from "../api";
import { bookingKeys } from "./keys";

/**
 * Server state for the public booking flow. The draft itself (cart,
 * date/time, customer fields) lives in the booking Redux slice; only
 * data that comes from the server lives here.
 */

export interface BookingService {
  id: string;
  slug: string;
  name: string;
  price: number;
  priceFrom: boolean;
  priceNote: string;
  durationMinutes: number;
  category: string;
  sortOrder: number;
}

async function fetchBookingCatalog(): Promise<BookingService[]> {
  const { data, error } = await supabase
    .from("services")
    .select(
      "id, slug, name, price, price_from, price_note, duration_minutes, category, sort_order",
    )
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    throw new Error("No pudimos cargar los tratamientos.");
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    price: row.price as number,
    priceFrom: Boolean(row.price_from),
    priceNote: (row.price_note as string | null) ?? "",
    durationMinutes: row.duration_minutes as number,
    category: row.category as string,
    sortOrder: row.sort_order as number,
  }));
}

/** The live services catalog (RLS: public read), in display order. */
export function useBookingCatalog() {
  return useQuery({
    queryKey: bookingKeys.catalog,
    queryFn: fetchBookingCatalog,
    staleTime: 60_000,
  });
}

/** Per-day open/available flags for the date carousel's window. */
export function useBookingDayRange(
  fromISO: string | null,
  toISO: string | null,
  durationMinutes: number,
) {
  return useQuery({
    queryKey: bookingKeys.days(fromISO ?? "", toISO ?? "", durationMinutes),
    queryFn: () =>
      fetchDayRange(fromISO as string, toISO as string, durationMinutes),
    enabled: Boolean(fromISO) && Boolean(toISO) && durationMinutes > 0,
    staleTime: 15_000,
  });
}

/** The appointment summary behind a confirmation reference code. */
export function useBookingConfirmation(referenceCode: string | null) {
  return useQuery({
    queryKey: bookingKeys.confirmation(referenceCode ?? ""),
    queryFn: () => fetchBookingSummary(referenceCode as string),
    enabled: Boolean(referenceCode),
    staleTime: 30_000,
    retry: false,
  });
}
