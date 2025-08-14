// app/dashboard/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center gap-3 bg-white rounded-lg shadow-lg p-6">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Loading Dashboard</h2>
            <p className="text-sm text-gray-600">Preparing your workspace...</p>
          </div>
        </div>
      </div>
    </div>
  );
}