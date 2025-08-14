"use client";

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

export default function DistrictLogoDebug() {
  const { profile } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDebug = async () => {
    if (!profile?.districts?.id) {
      setDebugInfo({ error: 'No district ID found in profile' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/debug/district-logo?districtId=${profile.districts.id}`);
      const data = await response.json();
      setDebugInfo(data);
    } catch (error) {
      setDebugInfo({ error: 'Failed to fetch debug info', details: error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
      <h3 className="font-semibold text-yellow-800 mb-2">District Logo Debug</h3>
      
      <div className="space-y-2 text-sm">
        <div>
          <strong>Profile District ID:</strong> {profile?.districts?.id || 'Not found'}
        </div>
        <div>
          <strong>Profile District Name:</strong> {profile?.districts?.name || 'Not found'}
        </div>
        <div>
          <strong>Profile District Logo URL:</strong> {(profile?.districts as any)?.logo_url || 'Not found'}
        </div>
      </div>

      <button
        onClick={runDebug}
        disabled={loading || !profile?.districts?.id}
        className="mt-3 px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 disabled:opacity-50"
      >
        {loading ? 'Running Debug...' : 'Run District Debug'}
      </button>

      {debugInfo && (
        <div className="mt-4">
          <strong>Debug Results:</strong>
          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-60">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
