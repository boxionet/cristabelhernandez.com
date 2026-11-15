import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// The booking draft — CLIENT state only, held in memory for the
// duration of the flow. Nothing here touches localStorage: a refresh
// restarts the flow through the route guards, and no patient data
// ever sits in browser storage. Server data (catalog, slots, the
// confirmation summary) lives in TanStack Query, never here.
//
// Shape mirrors the old `cristabel_booking` record (customerType,
// services, dateTime, customerInfo) so the migration ports the flow
// 1:1 without redesigning what the patient enters.

export type CustomerType = "new" | "returning";

/** How the patient passed the verification step (Peachy-style flow):
 * 'verified' = signed in (session, or email code just entered),
 * 'guest' = chose "Continuar como invitado". Null until the step is
 * passed; the datos/revision guards require it (or a session). */
export type BookingIdentity = "verified" | "guest";

export interface BookingCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  note: string;
}

export interface BookingResult {
  referenceCode: string;
  status: string; // por_confirmar | pendiente | confirmada
  confirmationExpiresAt: string | null;
}

// A promo code applied in the cart (migration 008). The percent is
// advisory — the server re-validates the code and computes the
// discount at submit time.
export interface AppliedPromo {
  code: string;
  discountPercent: number;
}

export interface BookingState {
  customerType: CustomerType | null;
  identity: BookingIdentity | null;
  /** True only on the first datos visit after the verification step
   * passed, so datos can auto-skip to revision once for verified
   * patients with complete info — and never skip again when the
   * patient comes back to edit. Cleared by datos after its skip
   * decision, whatever the outcome. */
  identityFresh: boolean;
  /** slug -> quantity. The UI toggles services (quantity is always 1). */
  services: Record<string, number>;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM (24h)
  customer: BookingCustomer;
  idempotencyKey: string | null;
  /** Set on a successful submit; drives the confirmation step. */
  result: BookingResult | null;
  promo: AppliedPromo | null;
  /** Set when a re-validation finds the applied code unusable for
   * the current date (e.g. outside its window). The code stays
   * visible so the patient can remove it; the discount stops
   * applying and submit is blocked until it is removed. */
  promoError: string | null;
}

const emptyCustomer: BookingCustomer = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  note: "",
};

export const initialBookingState: BookingState = {
  customerType: null,
  identity: null,
  identityFresh: false,
  services: {},
  date: null,
  time: null,
  customer: emptyCustomer,
  idempotencyKey: null,
  result: null,
  promo: null,
  promoError: null,
};

const bookingSlice = createSlice({
  name: "booking",
  initialState: initialBookingState,
  reducers: {
    setCustomerType(state, action: PayloadAction<CustomerType>) {
      state.customerType = action.payload;
    },
    setIdentity(state, action: PayloadAction<BookingIdentity>) {
      state.identity = action.payload;
      state.identityFresh = true;
    },
    clearIdentityFresh(state) {
      state.identityFresh = false;
    },
    toggleService(state, action: PayloadAction<string>) {
      const slug = action.payload;
      if (state.services[slug]) {
        delete state.services[slug];
      } else {
        state.services[slug] = 1;
      }
      // A changed cart can change the total duration, which can
      // invalidate the picked slot — the date/time step re-checks.
      state.time = null;
    },
    removeService(state, action: PayloadAction<string>) {
      delete state.services[action.payload];
      state.time = null;
    },
    setBookingDate(state, action: PayloadAction<string | null>) {
      if (state.date !== action.payload) {
        state.date = action.payload;
        state.time = null;
      }
    },
    setBookingTime(state, action: PayloadAction<string | null>) {
      state.time = action.payload;
    },
    setCustomer(state, action: PayloadAction<Partial<BookingCustomer>>) {
      state.customer = { ...state.customer, ...action.payload };
    },
    setIdempotencyKey(state, action: PayloadAction<string>) {
      state.idempotencyKey = action.payload;
    },
    clearIdempotencyKey(state) {
      state.idempotencyKey = null;
    },
    setBookingResult(state, action: PayloadAction<BookingResult>) {
      state.result = action.payload;
    },
    setPromo(state, action: PayloadAction<AppliedPromo>) {
      state.promo = action.payload;
      state.promoError = null;
    },
    clearPromo(state) {
      state.promo = null;
      state.promoError = null;
    },
    setPromoError(state, action: PayloadAction<string | null>) {
      state.promoError = action.payload;
    },
    /**
     * A successful submit lands on the confirmation page: the draft
     * is consumed (services/date/time/customer cleared) so pressing
     * Back into the flow can never re-submit the same booking, while
     * the result stays for the confirmation copy. Entering
     * /reservar/ later resets everything, result included.
     */
    consumeDraft(state) {
      const result = state.result;
      const fresh = { ...initialBookingState, customer: { ...emptyCustomer } };
      fresh.result = result;
      return fresh;
    },
    /** Fresh start: entering /reservar/ always clears the draft. */
    resetBooking() {
      return { ...initialBookingState, customer: { ...emptyCustomer } };
    },
  },
});

export const {
  setCustomerType,
  setIdentity,
  clearIdentityFresh,
  toggleService,
  removeService,
  setBookingDate,
  setBookingTime,
  setCustomer,
  setIdempotencyKey,
  clearIdempotencyKey,
  setBookingResult,
  setPromo,
  clearPromo,
  setPromoError,
  consumeDraft,
  resetBooking,
} = bookingSlice.actions;

export default bookingSlice.reducer;
