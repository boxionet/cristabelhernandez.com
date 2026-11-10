import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { linkPatient } from "./lib/api";
import type { Patient } from "./lib/types";

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  patient: Patient | null;
  linkError: string | null;
  retryLink: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  loading: true,
  session: null,
  user: null,
  patient: null,
  linkError: null,
  retryLink: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkedFor = useRef<string | null>(null);

  async function doLink(sess: Session) {
    if (linkedFor.current === sess.user.id) return;
    linkedFor.current = sess.user.id;
    setLinkError(null);
    try {
      const { patient } = await linkPatient(sess.access_token);
      setPatient(patient);
    } catch (e) {
      linkedFor.current = null;
      setLinkError(e instanceof Error ? e.message : "link_failed");
    }
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      if (data.session) void doLink(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setLoading(false);
      if (sess) {
        void doLink(sess);
      } else {
        linkedFor.current = null;
        setPatient(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AuthContextValue = {
    loading,
    session,
    user: session?.user ?? null,
    patient,
    linkError,
    retryLink: () => {
      if (session) {
        linkedFor.current = null;
        void doLink(session);
      }
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function isAdmin(user: User | null): boolean {
  return Boolean(
    user &&
      (user.app_metadata as { role?: string } | undefined)?.role === "admin",
  );
}
