export interface AppointmentItem {
  id: string;
  service_name: string;
  unit_price: number;
  quantity: number;
  price_from: boolean;
  price_note: string | null;
}

export interface Appointment {
  id: string;
  reference_code: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  duration_minutes: number;
  total_price: number;
  total_is_estimate: boolean;
  status:
    | "por_confirmar"
    | "pendiente"
    | "confirmada"
    | "completada"
    | "cancelada"
    | "no_show";
  payment_status: "pendiente" | "pagado";
  starts_at: string; // ISO timestamptz
  appointment_services: AppointmentItem[];
}

export interface Patient {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
}
