import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { clinicToday } from "../../lib/panel";

// Client/UI state that must survive navigation between sections:
// which day the Agenda is on, which month Reportes shows, and the
// Citas filters. Form-local state deliberately stays in components.
export interface UiState {
  agendaDate: string; // YYYY-MM-DD
  reportMonth: string; // YYYY-MM
  citasStatus: string;
  citasQuery: string;
}

const initialState: UiState = {
  agendaDate: clinicToday(),
  reportMonth: clinicToday().slice(0, 7),
  citasStatus: "todas",
  citasQuery: "",
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setAgendaDate(state, action: PayloadAction<string>) {
      state.agendaDate = action.payload;
    },
    setReportMonth(state, action: PayloadAction<string>) {
      state.reportMonth = action.payload;
    },
    setCitasStatus(state, action: PayloadAction<string>) {
      state.citasStatus = action.payload;
    },
    setCitasQuery(state, action: PayloadAction<string>) {
      state.citasQuery = action.payload;
    },
  },
});

export const {
  setAgendaDate,
  setReportMonth,
  setCitasStatus,
  setCitasQuery,
} = uiSlice.actions;
export default uiSlice.reducer;
