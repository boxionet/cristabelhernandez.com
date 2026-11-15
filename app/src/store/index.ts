import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import bookingReducer from "./slices/bookingSlice";
import uiReducer from "./slices/uiSlice";

// The store holds CLIENT state only (auth session, cross-screen UI
// state, the booking draft). Server state is TanStack Query's job
// (lib/queryClient.ts). Add future slices here — one file per feature
// under slices/.
export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    booking: bookingReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Supabase's Session object is stored as delivered; it is
        // plain data for our purposes and never mutated.
        ignoredPaths: ["auth.session"],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
