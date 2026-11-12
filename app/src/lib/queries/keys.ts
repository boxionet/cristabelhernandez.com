// Central query-key factory. Every server-state query in the app
// keys off these, so invalidation stays predictable as features grow.
export const panelKeys = {
  all: ["panel"] as const,
  appointments: ["panel", "appointments"] as const,
  patients: ["panel", "patients"] as const,
  services: ["panel", "services"] as const,
  schedule: ["panel", "schedule"] as const,
  exceptions: ["panel", "exceptions"] as const,
};

export const patientKeys = {
  appointments: (patientId: string) =>
    ["patient", "appointments", patientId] as const,
  services: ["patient", "services"] as const,
};

export const availabilityKey = (date: string, duration: number) =>
  ["availability", date, duration] as const;

export const bookingKeys = {
  all: ["booking"] as const,
  catalog: ["booking", "catalog"] as const,
  days: (from: string, to: string, duration: number) =>
    ["booking", "days", from, to, duration] as const,
  confirmation: (referenceCode: string) =>
    ["booking", "confirmation", referenceCode] as const,
};

export const staffProfileKey = (userId: string) =>
  ["staff-profile", userId] as const;
