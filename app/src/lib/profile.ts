import type { Patient } from "./types";

// A patient record counts as complete when it carries a real name —
// not the email-prefix placeholder portal-link creates on a first
// portal login — and a phone number, which is the clinic's working
// contact key (search, calls, WhatsApp follow-ups). Portal-first
// patients who are incomplete are routed to /mi-cuenta/completar-perfil
// before they can use the portal; patients created from a booking
// already have both and never see that step.
export function profileComplete(p: Patient): boolean {
  const prefix = p.email.split("@")[0].trim().toLowerCase();
  const nameOk =
    !!p.fullName && p.fullName.trim().toLowerCase() !== prefix;
  return nameOk && !!p.phone?.trim();
}
