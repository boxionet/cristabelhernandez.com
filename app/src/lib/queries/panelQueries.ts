import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import {
  type ExceptionRow,
  type PanelAppointment,
  type PatientRow,
  type PromotionRow,
  type ScheduleRow,
  type ServiceRow,
} from "../panel";
import { panelKeys, staffProfileKey } from "./keys";

const PANEL_ERROR = "No pudimos cargar los datos del panel. Recarga la página.";

// ---------- Fetchers (admin reads via RLS) ----------

async function fetchPanelAppointments(): Promise<PanelAppointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*, appointment_services(*), patients(full_name,email,phone)")
    .order("starts_at", { ascending: true });
  if (error) throw new Error(PANEL_ERROR);
  return (data ?? []) as PanelAppointment[];
}

async function fetchPanelPatients(): Promise<PatientRow[]> {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(PANEL_ERROR);
  return (data ?? []) as PatientRow[];
}

async function fetchPanelServices(): Promise<ServiceRow[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(PANEL_ERROR);
  return (data ?? []) as ServiceRow[];
}

async function fetchPanelSchedule(): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from("weekly_schedule")
    .select("*")
    .order("weekday", { ascending: true });
  if (error) throw new Error(PANEL_ERROR);
  return (data ?? []) as ScheduleRow[];
}

async function fetchPanelExceptions(): Promise<ExceptionRow[]> {
  const { data, error } = await supabase
    .from("date_exceptions")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw new Error(PANEL_ERROR);
  return (data ?? []) as ExceptionRow[];
}

async function fetchPanelPromotions(): Promise<PromotionRow[]> {
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(PANEL_ERROR);
  return (data ?? []) as PromotionRow[];
}

// ---------- Hooks ----------

export function usePanelAppointments() {
  return useQuery({
    queryKey: panelKeys.appointments,
    queryFn: fetchPanelAppointments,
  });
}

export function usePanelPatients() {
  return useQuery({
    queryKey: panelKeys.patients,
    queryFn: fetchPanelPatients,
  });
}

export function usePanelServices() {
  return useQuery({
    queryKey: panelKeys.services,
    queryFn: fetchPanelServices,
  });
}

export function usePanelSchedule() {
  return useQuery({
    queryKey: panelKeys.schedule,
    queryFn: fetchPanelSchedule,
  });
}

export function usePanelExceptions() {
  return useQuery({
    queryKey: panelKeys.exceptions,
    queryFn: fetchPanelExceptions,
  });
}

export function usePanelPromotions() {
  return useQuery({
    queryKey: panelKeys.promotions,
    queryFn: fetchPanelPromotions,
  });
}

/**
 * The composed panel dataset, with the same contract the screens were
 * built against: each collection is null until loaded, and reload()
 * invalidates the whole panel namespace (mutations call it after
 * writing, per the RLS-write pattern in lib/panel.ts).
 */
export function usePanelData() {
  const queryClient = useQueryClient();
  const appointments = usePanelAppointments();
  const patients = usePanelPatients();
  const services = usePanelServices();
  const schedule = usePanelSchedule();
  const exceptions = usePanelExceptions();

  const firstError = [
    appointments.error,
    patients.error,
    services.error,
    schedule.error,
    exceptions.error,
  ].find(Boolean);

  return {
    appointments: appointments.data ?? null,
    patients: patients.data ?? null,
    services: services.data ?? null,
    schedule: schedule.data ?? null,
    exceptions: exceptions.data ?? null,
    error: firstError ? PANEL_ERROR : null,
    reload: () =>
      queryClient.invalidateQueries({ queryKey: panelKeys.all }),
  };
}

/** The signed-in staff member's own patient-record name (for the
 *  top-right identity), as a cached query instead of a raw effect. */
export function useStaffProfileName(userId: string | undefined) {
  return useQuery({
    queryKey: staffProfileKey(userId ?? ""),
    queryFn: async () => {
      const { data } = await supabase
        .from("patients")
        .select("full_name")
        .eq("auth_user_id", userId!)
        .maybeSingle();
      return (data?.full_name as string | null) ?? null;
    },
    enabled: Boolean(userId),
  });
}
