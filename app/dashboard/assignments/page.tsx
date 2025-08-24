// app/dashboard/assignments/page.tsx
"use client";

import { useAuth } from "../auth-provider";
import AssignmentsList from "@/components/dashboard/assignments/AssignmentsList";

export default function AssignmentsPage() {
  const { profile } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Assignments</h1>
      <AssignmentsList 
        assignments={[]}
        currentUserRole={profile?.role || "student"}
        districtName={profile?.districts?.name || ""}
      />
    </div>
  );
}