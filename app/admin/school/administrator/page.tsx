import {
  requireSchoolAdminOfKind,
  SchoolAdminDashboardShell,
} from "../_dashboard";

export const dynamic = "force-dynamic";

export default async function AdministratorDashboard() {
  const profile = await requireSchoolAdminOfKind("administrator");
  return <SchoolAdminDashboardShell kind="administrator" profile={profile} />;
}
