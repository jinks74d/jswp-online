// app/dashboard/auth-provider.tsx
"use client";

import { createContext, useContext } from "react";
import type { AuthSession, AuthState } from "@/lib/auth/types";
import { getUserDisplayName, getRoleDisplayName, useSignOut } from "@/lib/auth/client";

interface AuthContextType extends AuthState {
  displayName: string;
  roleDisplayName: string;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  initialSession: AuthSession;
  children: React.ReactNode;
}

export function AuthProvider({ initialSession, children }: AuthProviderProps) {
  const signOut = useSignOut();
  
  // Create read-only auth state from server session
  const authState: AuthState = {
    isAuthenticated: true,
    user: initialSession.user,
    profile: initialSession.profile,
    isLoading: false,
  };

  const contextValue: AuthContextType = {
    ...authState,
    loading: false, // Add explicit loading property
    displayName: getUserDisplayName(authState),
    roleDisplayName: getRoleDisplayName(authState.profile?.role || ""),
    signOut,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}