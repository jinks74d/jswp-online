// app/dashboard/auth-provider.tsx
"use client";

import { createContext, useContext } from "react";
import type { AuthSession, AuthState } from "@/lib/auth/types";
import { getUserDisplayName, getRoleDisplayName } from "@/lib/auth/client";

interface AuthContextType extends AuthState {
  displayName: string;
  roleDisplayName: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  initialSession: AuthSession;
  children: React.ReactNode;
}

export function AuthProvider({ initialSession, children }: AuthProviderProps) {
  // Create read-only auth state from server session
  const authState: AuthState = {
    isAuthenticated: true,
    user: initialSession.user,
    profile: initialSession.profile,
    isLoading: false,
  };

  const contextValue: AuthContextType = {
    ...authState,
    displayName: getUserDisplayName(authState),
    roleDisplayName: getRoleDisplayName(authState.profile?.role || ""),
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