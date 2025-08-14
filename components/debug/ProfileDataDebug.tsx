"use client";

import { useAuth } from '@/components/auth/AuthProvider';

export default function ProfileDataDebug() {
  const { profile, user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
      <h3 className="font-semibold text-blue-800 mb-2">Profile Data Debug</h3>
      
      <div className="space-y-2 text-sm">
        <div>
          <strong>User ID:</strong> {user?.id || 'Not found'}
        </div>
        <div>
          <strong>Profile ID:</strong> {profile?.id || 'Not found'}
        </div>
        <div>
          <strong>Profile District ID:</strong> {profile?.district_id || 'Not found'}
        </div>
        <div>
          <strong>Profile Districts Object:</strong> {profile?.districts ? 'EXISTS' : 'NOT FOUND'}
        </div>
        {profile?.districts && (
          <div className="pl-4 space-y-1">
            <div><strong>Districts ID:</strong> {profile.districts.id || 'Not found'}</div>
            <div><strong>Districts Name:</strong> {profile.districts.name || 'Not found'}</div>
            <div><strong>Districts Logo URL:</strong> {(profile.districts as any)?.logo_url || 'Not found'}</div>
          </div>
        )}
        <div>
          <strong>Profile Role:</strong> {profile?.role || 'Not found'}
        </div>
      </div>

      <div className="mt-4">
        <h4 className="font-semibold text-blue-800">Full Profile JSON:</h4>
        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-60">
          {JSON.stringify(profile, null, 2)}
        </pre>
      </div>
    </div>
  );
}
