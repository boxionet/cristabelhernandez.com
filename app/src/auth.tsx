import {
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import {
  isAdminUser,
  linkPatientThunk,
  linkReset,
  sessionChanged,
} from "./store/slices/authSlice";
import type { Patient } from "./lib/types";

// Auth lives in the Redux auth slice. This provider is only the
// bridge: it mirrors Supabase's session listener into the store.
// Components read auth through useAuth() (below) or the store hooks.
export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) dispatch(sessionChanged(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      dispatch(sessionChanged(sess));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [dispatch]);

  return <>{children}</>;
}

export interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  patient: Patient | null;
  linkError: string | null;
  retryLink: () => void;
  ensureLinked: () => void;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthContextValue {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s) => s.auth);

  const ensureLinked = useCallback(() => {
    const sess = auth.session;
    if (!sess) return;
    // The thunk's condition is the single-flight guard: it reads the
    // store synchronously at dispatch time. A promise-settled ref
    // guard used to live here, but it went stale — React re-ran the
    // retry effect before the rejection's .catch microtask reset
    // the ref, so a failed link could never be retried.
    if (auth.patient && auth.linkedFor === sess.user.id) return;
    void dispatch(linkPatientThunk(sess.access_token));
  }, [auth.session, auth.patient, auth.linkedFor, dispatch]);

  const retryLink = useCallback(() => {
    dispatch(linkReset());
    if (auth.session) {
      void dispatch(linkPatientThunk(auth.session.access_token));
    }
  }, [auth.session, dispatch]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    loading: auth.status === "loading",
    session: auth.session,
    user: auth.session?.user ?? null,
    patient: auth.patient,
    linkError: auth.linkStatus === "error" ? auth.linkError : null,
    retryLink,
    ensureLinked,
    signOut,
  };
}

export function isAdmin(user: User | null): boolean {
  return isAdminUser(user);
}
