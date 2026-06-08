import {
  requireSchoolAdminOfKind,
  SchoolAdminDashboardShell,
} from "../_dashboard";

export const dynamic = "force-dynamic";

export default async function CounselorDashboard() {
  const profile = await requireSchoolAdminOfKind("counselor");
  return <SchoolAdminDashboardShell kind="counselor" profile={profile} />;
}
