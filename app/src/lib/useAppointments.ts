import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth";
import { supabase } from "./supabase";
import type { Appointment } from "./types";

// All of the signed-in patient's appointments (RLS also enforces this
// server-side; the patient filter keeps the query explicit).
export function useAppointments() {
  const { patient } = useAuth();
  const [rows, setRows] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!patient) return;
    const { data, error } = await supabase
      .from("appointments")
      .select("*, appointment_services(*)")
      .eq("patient_id", patient.id)
      .order("starts_at", { ascending: true });
    if (error) {
      setError("No pudimos cargar tus citas. Recarga la página.");
      return;
    }
    setRows((data ?? []) as Appointment[]);
  }, [patient]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rows, error, reload };
}
