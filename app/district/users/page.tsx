import type { Metadata } from "next";
/**
 * /district/users — district-wide users. Stat cards, name/email search with
 * role + school filters, and a table of every user. "Create User" opens a modal
 * (School Admin / Teacher). RLS scopes all reads to the district.
 */

import { requireRole } from "@/lib/auth";
import { listDistrictUsers } from "@/lib/queries/district-users";
import { listSchoolsForDistrict } from "@/lib/queries/schools";
import { UsersView } from "./users-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "District Users" };

export default async function DistrictUsersPage() {
  const profile = await requireRole("district_admin");
  if (!profile.district_id) {
    return (
      <p className="text-sm text-gray-500">
        Your account isn’t linked to a district yet.
      </p>
    );
  }

  const [users, schoolRows] = await Promise.all([
    listDistrictUsers(),
    listSchoolsForDistrict(profile.district_id),
  ]);

  const schools = schoolRows.map((s) => ({ id: s.id, name: s.name }));

  return <UsersView users={users} schools={schools} />;
}
