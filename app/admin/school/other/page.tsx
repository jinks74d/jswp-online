import {
  requireSchoolAdminOfKind,
  SchoolAdminDashboardShell,
} from "../_dashboard";

export const dynamic = "force-dynamic";

export default async function OtherDashboard() {
  const profile = await requireSchoolAdminOfKind("other");
  return <SchoolAdminDashboardShell kind="other" profile={profile} />;
}
