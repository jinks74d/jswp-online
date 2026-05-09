/**
 * Teacher landing. Server-rendered greeting + placeholder quick stats.
 * Real stats land in chunks 3.2-3.4 as classes / assignments / students
 * get rebuilt against the v2 schema.
 */

import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const profile = await requireUser();

  const greeting = profile.first_name ? `Welcome back, ${profile.first_name}` : "Welcome back";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
        <p className="text-gray-600">
          Your classes, assignments, and students will appear here.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <PlaceholderCard label="Classes" hint="Chunk 3.2 lands the class list and roster view." />
        <PlaceholderCard label="Active assignments" hint="Chunk 3.4 lands the assignment authoring flow." />
        <PlaceholderCard label="Students" hint="Chunk 3.2 lands the student list scoped to your class periods." />
      </div>
    </div>
  );
}

function PlaceholderCard({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
        {label}
      </div>
      <div className="text-3xl font-semibold text-gray-300 mb-2">—</div>
      <p className="text-xs text-gray-500">{hint}</p>
    </div>
  );
}
