import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth";
import { supabase } from "../supabase";
import type { Appointment } from "../types";
import { patientKeys } from "./keys";

async function fetchPatientAppointments(
  patientId: string,
): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*, appointment_services(*)")
    .eq("patient_id", patientId)
    .order("starts_at", { ascending: true });
  if (error) {
    throw new Error("No pudimos cargar tus citas. Recarga la página.");
  }
  return (data ?? []) as Appointment[];
}

export function usePatientAppointments(patientId: string | undefined) {
  return useQuery({
    queryKey: patientKeys.appointments(patientId ?? ""),
    queryFn: () => fetchPatientAppointments(patientId!),
    enabled: Boolean(patientId),
  });
}

export interface ServiceCatalogEntry {
  id: string;
  name: string;
  duration_minutes: number;
}

async function fetchServicesCatalog(): Promise<ServiceCatalogEntry[]> {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, duration_minutes")
    .eq("active", true);
  if (error) {
    throw new Error("No pudimos cargar el catálogo de tratamientos.");
  }
  return (data ?? []) as ServiceCatalogEntry[];
}

/** The public services catalog (RLS: public read) — used for durations. */
export function useServicesCatalog() {
  return useQuery({
    queryKey: patientKeys.services,
    queryFn: fetchServicesCatalog,
  });
}

/**
 * All of the signed-in patient's appointments (RLS also enforces this
 * server-side), with the contract the patient screens were built
 * against: rows are null until loaded; reload() invalidates the query.
 */
export function useAppointments() {
  const { patient } = useAuth();
  const queryClient = useQueryClient();
  const query = usePatientAppointments(patient?.id);

  return {
    rows: query.data ?? null,
    error: query.error ? query.error.message : null,
    reload: () =>
      queryClient.invalidateQueries({
        queryKey: patientKeys.appointments(patient?.id ?? ""),
      }),
  };
}
