/**
 * Teacher landing. Server-rendered greeting. If the teacher has zero
 * classes AND zero assignments, show a "getting started" empty state
 * instead of placeholder stat cards.
 */

import Link from "next/link";
import { BookOpen, FileText, GraduationCap, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getTeacherClassPeriods } from "@/lib/queries/classes";
import { getTeacherAssignments } from "@/lib/queries/assignments";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const profile = await requireUser();
  const greeting = profile.first_name
    ? `Welcome back, ${profile.first_name}`
    : "Welcome back";

  const [classes, assignments] = await Promise.all([
    getTeacherClassPeriods(profile.id),
    getTeacherAssignments(profile.id),
  ]);

  const isFresh = classes.length === 0 && assignments.length === 0;

  if (isFresh) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
          <p className="text-gray-600">
            Let&apos;s get you set up. The JSWP method walks students through
            a structured writing flow — your classes and assignments live
            here.
          </p>
        </header>

        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <Sparkles className="w-10 h-10 text-blue-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">
            You&apos;re ready to start
          </h2>
          <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">
            Create your first assignment to get started. Once your admin
            assigns you to a class period, your students will appear here
            too.
          </p>
          <Link
            href="/dashboard/assignments/new"
            className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            <FileText className="w-4 h-4" />
            Create your first assignment
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
        <p className="text-gray-600">
          Quick overview of your classes, students, and assignments.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={BookOpen}
          label="Classes"
          value={classes.length}
          href="/dashboard/classes"
        />
        <StatCard
          icon={FileText}
          label="Assignments"
          value={assignments.length}
          href="/dashboard/assignments"
        />
        <StatCard
          icon={GraduationCap}
          label="Students"
          value={classes.reduce((acc, c) => acc + c.studentCount, 0)}
          href="/dashboard/students"
        />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-400"
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 mb-2">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <div className="text-3xl font-semibold text-gray-900">{value}</div>
    </Link>
  );
}
