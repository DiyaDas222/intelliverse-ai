// Cloud auth bridge — wraps the platform OAuth client and pushes the resulting
// session into the Supabase client used throughout the app.

import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { supabase } from "../supabase/client";

const cloudAuth = createLovableAuth();

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const cloud = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "microsoft" | "lovable",
      opts?: SignInOptions,
    ) => {
      const result = await cloudAuth.signInWithOAuth(provider, {
        redirect_uri: opts?.redirect_uri,
        extraParams: { ...opts?.extraParams },
      });

      if (result.redirected) return result;
      if (result.error) return result;

      try {
        await supabase.auth.setSession(result.tokens);
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
      return result;
    },
  },
};
