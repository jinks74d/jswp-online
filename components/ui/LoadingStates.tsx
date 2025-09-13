// components/ui/LoadingStates.tsx
"use client";

import { Shield, User, Database, Wifi, WifiOff } from "lucide-react";
import { memo } from "react";

interface LoadingStateProps {
  type: "auth" | "profile" | "dashboard" | "redirect" | "network";
  message?: string;
  subMessage?: string;
  showProgress?: boolean;
}

// Memoized loading spinner component to prevent unnecessary re-renders
export const LoadingSpinner = memo<{
  size?: "sm" | "md" | "lg";
  className?: string;
}>(({ size = "md", className = "" }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div
      className={`${sizeClasses[size]} border-2 border-blue-600 border-t-transparent rounded-full animate-spin ${className}`}
    />
  );
});

LoadingSpinner.displayName = "LoadingSpinner";

export const LoadingState = memo<LoadingStateProps>(
  ({ type, message, subMessage, showProgress = true }) => {
    const getLoadingConfig = () => {
      switch (type) {
        case "auth":
          return {
            icon: User,
            defaultMessage: "Checking authentication...",
            defaultSubMessage: "Please wait while we verify your session",
            bgGradient: "from-blue-50 to-indigo-100",
            iconColor: "text-blue-600",
            spinnerColor: "border-blue-600",
          };
        case "profile":
          return {
            icon: Database,
            defaultMessage: "Loading your profile...",
            defaultSubMessage: "Setting up your dashboard",
            bgGradient: "from-green-50 to-emerald-100",
            iconColor: "text-green-600",
            spinnerColor: "border-green-600",
          };
        case "dashboard":
          return {
            icon: Database,
            defaultMessage: "Loading your dashboard...",
            defaultSubMessage: "Preparing your workspace",
            bgGradient: "from-blue-50 to-indigo-100",
            iconColor: "text-blue-600",
            spinnerColor: "border-blue-600",
          };
        case "redirect":
          return {
            icon: Shield,
            defaultMessage: "Redirecting...",
            defaultSubMessage: "Taking you to the right place",
            bgGradient: "from-green-50 to-emerald-100",
            iconColor: "text-green-600",
            spinnerColor: "border-green-600",
          };
        case "network":
          return {
            icon: WifiOff,
            defaultMessage: "Connection issue detected",
            defaultSubMessage: "Attempting to reconnect...",
            bgGradient: "from-orange-50 to-amber-100",
            iconColor: "text-orange-600",
            spinnerColor: "border-orange-600",
          };
        default:
          return {
            icon: User,
            defaultMessage: "Loading...",
            defaultSubMessage: "Please wait",
            bgGradient: "from-gray-50 to-gray-100",
            iconColor: "text-gray-600",
            spinnerColor: "border-gray-600",
          };
      }
    };

    const config = getLoadingConfig();
    const IconComponent = config.icon;

    return (
      <div
        className={`min-h-screen bg-gradient-to-br ${config.bgGradient} flex items-center justify-center p-4`}
      >
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center justify-center mb-4">
              {showProgress ? (
                <div
                  className={`w-8 h-8 border-2 ${config.spinnerColor} border-t-transparent rounded-full animate-spin mr-3`}
                ></div>
              ) : (
                <IconComponent className={`w-8 h-8 ${config.iconColor} mr-3`} />
              )}
              <span className="text-gray-700 font-medium">
                {message || config.defaultMessage}
              </span>
            </div>
            {(subMessage || config.defaultSubMessage) && (
              <p className="text-sm text-gray-500 mt-2">
                {subMessage || config.defaultSubMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
);

LoadingState.displayName = "LoadingState";

interface RedirectingStateProps {
  userType: "super_admin" | "regular";
  userName?: string;
  targetPath: string;
}

export function RedirectingState({
  userType,
  userName,
  targetPath,
}: RedirectingStateProps) {
  const isAdmin = userType === "super_admin";

  return (
    <LoadingState
      type="redirect"
      message={`Redirecting to ${isAdmin ? "admin dashboard" : "dashboard"}...`}
      subMessage={userName ? `Welcome back, ${userName}!` : "Welcome back!"}
    />
  );
}

interface RoleMismatchProps {
  message: string;
  userRole: string;
  onRedirect: () => void;
  onSignOut: () => void;
}

export function RoleMismatchState({
  message,
  userRole,
  onRedirect,
  onSignOut,
}: RoleMismatchProps) {
  const isAdmin = userRole === "super_admin";

  return (
    <div
      className={`min-h-screen bg-gradient-to-br ${
        isAdmin ? "from-red-50 to-orange-100" : "from-blue-50 to-indigo-100"
      } flex items-center justify-center p-4`}
    >
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield
              className={`w-8 h-8 ${
                isAdmin ? "text-red-600" : "text-blue-600"
              }`}
            />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {isAdmin ? "Admin Access Required" : "User Access Detected"}
          </h3>
          <p className="text-sm text-gray-600 mb-4">{message}</p>
          <div className="space-y-3">
            <button
              onClick={onRedirect}
              className={`block w-full ${
                isAdmin
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700"
              } text-white py-2 px-4 rounded-md transition-colors`}
            >
              {isAdmin ? "Go to Admin Portal" : "Go to User Dashboard"}
            </button>
            <button
              onClick={onSignOut}
              className="block w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
