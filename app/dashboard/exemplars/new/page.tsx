/**
 * /dashboard/exemplars/new — create form (chunk 6.1).
 */

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createExemplar } from "@/lib/actions/exemplars";
import { ExemplarForm } from "../exemplar-form";

export const dynamic = "force-dynamic";

export default async function NewExemplarPage() {
  await requireRole([
    "teacher",
    "school_admin",
    "district_admin",
    "super_admin",
  ]);

  return (
    <div className="space-y-5 max-w-3xl">
      <Link
        href="/dashboard/exemplars"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Exemplars
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-gray-900">New exemplar</h1>
        <p className="text-gray-600">
          Save as draft first; toggle Published when you&apos;re ready to share
          with students.
        </p>
      </header>

      <ExemplarForm action={createExemplar} formMode="create" />
    </div>
  );
}
