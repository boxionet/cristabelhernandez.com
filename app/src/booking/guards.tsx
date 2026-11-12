import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector } from "../store/hooks";

// Route guards for the booking flow. The draft lives only in memory,
// so a refresh (or a deep link) lands here with an empty slice —
// each guard sends the patient back to the FIRST page of the
// reservation (/reservar), never into the middle of the flow.
export function RequireBookingCustomerType({
  children,
}: {
  children: ReactElement;
}) {
  const customerType = useAppSelector((s) => s.booking.customerType);
  if (!customerType) {
    return <Navigate to="/reservar" replace />;
  }
  return children;
}

export function RequireBookingServices({
  children,
}: {
  children: ReactElement;
}) {
  const services = useAppSelector((s) => s.booking.services);
  if (Object.keys(services).length === 0) {
    return <Navigate to="/reservar" replace />;
  }
  return children;
}

export function RequireBookingDateTime({
  children,
}: {
  children: ReactElement;
}) {
  const booking = useAppSelector((s) => s.booking);
  if (Object.keys(booking.services).length === 0) {
    return <Navigate to="/reservar" replace />;
  }
  if (!booking.date || !booking.time) {
    return <Navigate to="/reservar" replace />;
  }
  return children;
}

export function RequireBookingConfirmation({
  children,
}: {
  children: ReactElement;
}) {
  const location = useLocation();
  const result = useAppSelector((s) => s.booking.result);
  const ref = new URLSearchParams(location.search).get("ref");
  // Either a fresh submission (result in the slice) or an emailed
  // link (ref in the URL, fetched from the server) may open this
  // page. With neither, there is nothing to confirm — start over.
  if (!result && !ref) {
    return <Navigate to="/reservar" replace />;
  }
  return children;
}
