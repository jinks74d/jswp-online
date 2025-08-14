// components/auth/NetworkRecoveryModal.tsx
"use client";

import { useState } from "react";
import { Wifi, WifiOff, RefreshCw, X } from "lucide-react";

interface NetworkRecoveryModalProps {
  isOpen: boolean;
  onExtendSession: () => void;
  onSignOut: () => void;
  onClose: () => void;
}

export function NetworkRecoveryModal({ 
  isOpen, 
  onExtendSession, 
  onSignOut, 
  onClose 
}: NetworkRecoveryModalProps) {
  const [extending, setExtending] = useState(false);

  const handleExtendSession = async () => {
    setExtending(true);
    try {
      await onExtendSession();
      onClose();
    } catch (error) {
      console.error('Failed to extend session:', error);
    } finally {
      setExtending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-full">
              <WifiOff className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Connection Issue Detected
              </h3>
              <p className="text-sm text-gray-600">
                Network connectivity problems detected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            We&apos;ve detected network connectivity issues that may affect your session. 
            Your session has been preserved for 5 minutes to allow for reconnection.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-800">
              <Wifi className="w-4 h-4" />
              <span className="text-sm font-medium">Session Protection Active</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              Your work has been saved and your session is protected during this network interruption.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleExtendSession}
            disabled={extending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {extending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Extending Session...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Extend Session & Continue</span>
              </>
            )}
          </button>

          <button
            onClick={onSignOut}
            disabled={extending}
            className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Sign Out
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Your session will remain active while you decide. 
            Choose &quot;Extend Session&quot; to continue working.
          </p>
        </div>
      </div>
    </div>
  );
}
