import { QueryClient } from "@tanstack/react-query";

// One shared client for all server state (Supabase reads, Netlify
// function calls). Server state lives here — never in Redux.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
