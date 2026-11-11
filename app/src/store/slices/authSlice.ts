import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { Session, User } from "@supabase/supabase-js";
import { linkPatient } from "../../lib/api";
import type { Patient } from "../../lib/types";

// Auth state = the Supabase session plus the linked patient record.
// The session listener lives in auth.tsx and dispatches into this
// slice; linking runs as a thunk so any screen can await/retry it.
export interface AuthState {
  status: "loading" | "ready";
  session: Session | null;
  patient: Patient | null;
  linkStatus: "idle" | "pending" | "error";
  linkError: string | null;
  linkedFor: string | null; // user id the patient was linked for
}

const initialState: AuthState = {
  status: "loading",
  session: null,
  patient: null,
  linkStatus: "idle",
  linkError: null,
  linkedFor: null,
};

export const linkPatientThunk = createAsyncThunk<
  Patient,
  string, // access token
  { state: { auth: AuthState }; rejectValue: string }
>("auth/linkPatient", async (accessToken, { getState, rejectWithValue }) => {
  const { auth } = getState();
  const userId = auth.session?.user.id;
  if (userId && auth.linkedFor === userId && auth.patient) {
    return auth.patient;
  }
  try {
    const { patient } = await linkPatient(accessToken);
    return patient;
  } catch (e) {
    return rejectWithValue(
      e instanceof Error ? e.message : "link_failed",
    );
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    sessionChanged(state, action: PayloadAction<Session | null>) {
      state.session = action.payload;
      state.status = "ready";
      if (!action.payload) {
        state.patient = null;
        state.linkedFor = null;
        state.linkStatus = "idle";
        state.linkError = null;
      }
    },
    patientUpdated(state, action: PayloadAction<Patient>) {
      state.patient = action.payload;
    },
    linkReset(state) {
      state.linkedFor = null;
      state.linkStatus = "idle";
      state.linkError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(linkPatientThunk.pending, (state) => {
        state.linkStatus = "pending";
        state.linkError = null;
      })
      .addCase(linkPatientThunk.fulfilled, (state, action) => {
        state.patient = action.payload;
        state.linkedFor = state.session?.user.id ?? null;
        state.linkStatus = "idle";
        state.linkError = null;
      })
      .addCase(linkPatientThunk.rejected, (state, action) => {
        state.linkStatus = "error";
        state.linkError = action.payload ?? "link_failed";
        state.linkedFor = null;
      });
  },
});

export const { sessionChanged, patientUpdated, linkReset } =
  authSlice.actions;
export default authSlice.reducer;

export function selectUser(state: { auth: AuthState }): User | null {
  return state.auth.session?.user ?? null;
}

export function isAdminUser(user: User | null): boolean {
  return Boolean(
    user &&
      (user.app_metadata as { role?: string } | undefined)?.role ===
        "admin",
  );
}
