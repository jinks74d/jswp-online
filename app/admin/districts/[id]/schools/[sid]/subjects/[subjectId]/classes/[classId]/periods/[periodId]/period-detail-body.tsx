/**
 * Shared class-period detail body (edit period + teachers + students). The leaf
 * of Subject → Class → Period, rendered by both the super-admin route and the
 * district sidebar route. RLS scopes reads to the caller's district.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getClass } from "@/lib/queries/classes-admin";
import {
  getClassPeriod,
  listAssignedTeachers,
} from "@/lib/queries/class-periods-admin";
import { listSchoolUsersByRole } from "@/lib/queries/school-users";
import { listEnrolledStudents } from "@/lib/queries/period-students";
import { CsvImporter } from "@/components/admin/csv-importer";
import { PeriodForm } from "../../period-form";
import { TeacherAssignment } from "./teacher-assignment";
import { StudentEnrollment } from "./student-enrollment";

export async function PeriodDetailBody({
  schoolId,
  subjectId,
  classId,
  periodId,
  basePath,
}: {
  schoolId: string;
  subjectId: string;
  classId: string;
  periodId: string;
  basePath: string;
}) {
  const klass = await getClass(classId);
  if (!klass || klass.subject_id !== subjectId) notFound();

  const period = await getClassPeriod(periodId);
  if (!period || period.class_id !== classId) notFound();

  const [assigned, schoolTeachers, enrolled] = await Promise.all([
    listAssignedTeachers(period.id),
    listSchoolUsersByRole(period.school_id, "teacher"),
    listEnrolledStudents(period.id),
  ]);

  const base = `${basePath}/schools/${schoolId}/subjects/${subjectId}/classes/${classId}`;

  return (
    <div className="space-y-6 max-w-xl">
      <Link
        href={base}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to {klass.name}
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          Period {period.period_label}
        </h1>
        <p className="text-sm text-gray-500">
          {klass.name}
          {period.academic_year ? ` · ${period.academic_year}` : ""}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Period details
        </h2>
        <PeriodForm
          mode="edit"
          classId={classId}
          initial={{
            id: period.id,
            period_label: period.period_label,
            academic_year: period.academic_year,
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Teachers
        </h2>
        <TeacherAssignment
          periodId={period.id}
          assigned={assigned}
          schoolTeachers={schoolTeachers}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Students
        </h2>
        <StudentEnrollment periodId={period.id} enrolled={enrolled} />
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Import &amp; enroll students (CSV)
          </h3>
          <CsvImporter
            entity="class_students"
            sampleHeaders={["first_name", "last_name", "email", "grade_level"]}
            scope={{ classPeriodId: period.id }}
          />
        </div>
      </section>
    </div>
  );
}
