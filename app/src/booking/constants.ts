import type { BookingService } from "../lib/queries/bookingQueries";

// Static booking content that lives in NO database table: the
// "Destacados" row. Per-service description lines now live in the
// services.description column (editable in Panel -> Tratamientos,
// backfilled for the 13 seed services by migration 007); the map
// below is only the fallback for rows whose description is empty,
// so a service added before the backfill still renders its line.

export const FEATURED_SERVICE_SLUGS = [
  "toxina-frontal",
  "toxina-full-face",
  "microneedling",
  "prp-facial",
  "escleroterapia",
] as const;

export const SERVICE_DESCRIPTIONS: Record<string, string> = {
  "toxina-frontal": "Suaviza líneas de expresión y arrugas dinámicas",
  "toxina-full-face": "Suaviza líneas de expresión y arrugas dinámicas",
  microneedling: "Estimula colágeno para mejorar textura y luminosidad",
  "prp-facial": "Plasma rico en plaquetas para rejuvenecimiento",
  escleroterapia: "Tratamiento de arañitas vasculares",
  "mesoterapia-facial":
    "Microinyecciones con principios activos para mejorar la hidratación y la calidad de la piel",
  "peelings-quimicos": "Exfoliación médica para renovar la piel",
  "lipolisis-menton":
    "Reduce pequeños depósitos de grasa localizada en el mentón",
  "lipolisis-localizada":
    "Reduce grasa localizada en diferentes zonas del cuerpo, mejorando el contorno corporal de forma no quirúrgica",
  "anticelulitico-alidya":
    "Inyectable diseñado para mejorar la apariencia de la celulitis, favoreciendo una piel más lisa, firme y uniforme",
  "rejuvenecimiento-cuello": "Tratamiento personalizado según valoración médica",
  "rejuvenecimiento-escote": "Mejora textura y firmeza de la zona del escote",
  "rejuvenecimiento-manos": "Devuelve juventud y volumen a las manos",
};

export interface BookingTotals {
  total: number;
  durationMinutes: number;
  itemCount: number;
  hasEstimate: boolean;
}

/**
 * Cart totals from the slice's slug->quantity map and the live
 * catalog. Services missing from the catalog (deactivated since the
 * draft started) are dropped from the totals — the steps re-check
 * the cart against the catalog on render.
 */
export function calcBookingTotals(
  services: Record<string, number>,
  catalog: BookingService[],
): BookingTotals {
  const bySlug = new Map(catalog.map((s) => [s.slug, s]));
  let total = 0;
  let durationMinutes = 0;
  let itemCount = 0;
  let hasEstimate = false;
  for (const [slug, quantity] of Object.entries(services)) {
    const service = bySlug.get(slug);
    if (!service) continue;
    const qty = quantity || 1;
    total += service.price * qty;
    durationMinutes += service.durationMinutes * qty;
    itemCount += 1;
    if (service.priceFrom || service.priceNote) hasEstimate = true;
  }
  return { total, durationMinutes, itemCount, hasEstimate };
}

/** "Desde RD$ 3,500" / "RD$ 7,000 c/ampolla" / "RD$ 28,000 (3 sesiones)". */
export function formatServicePrice(service: {
  price: number;
  priceFrom: boolean;
  priceNote: string;
}): string {
  const base = `RD$ ${Math.round(service.price).toLocaleString("en-US")}`;
  let text = service.priceFrom ? `Desde ${base}` : base;
  if (service.priceNote === "c/ampolla") text += " c/ampolla";
  else if (service.priceNote) text += ` (${service.priceNote})`;
  return text;
}

// The start times the booking flow offers, in 24h form — one slot
// every hour, on the hour (clinic policy, user decision 2026-11-12).
// The availability engine generates slots on the same hourly step,
// so the intersection of the two is what a patient can pick.
export const STATIC_SLOT_TIMES_24H = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
] as const;
