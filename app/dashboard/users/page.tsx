// app/dashboard/users/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import UsersList from "@/components/dashboard/users/UsersList";

export default async function UsersPage() {
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  // Get current user and verify permissions
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select(
      `
      *,
      districts:district_id(id, name)
    `
    )
    .eq("id", user.id)
    .single();

  if (!profile || !profile.district_id) {
    redirect("/");
  }

  // Only district and school admins can manage users
  if (!["district_admin", "school_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  // Fetch users for this district (or school for school admins)
  let usersQuery = supabase
    .from("user_profiles")
    .select(
      `
      *,
      schools:school_id(id, name)
    `
    )
    .eq("district_id", profile.district_id)
    .order("created_at", { ascending: false });

  // School admins can only see users from their school
  if (profile.role === "school_admin" && profile.school_id) {
    usersQuery = usersQuery.eq("school_id", profile.school_id);
  }

  const { data: users, error } = await usersQuery;

  if (error) {
    console.error("Error fetching users:", error);
  }

  // Fetch schools for the district (for district admins)
  let schools: any[] = [];
  if (profile.role === "district_admin") {
    const { data: schoolsData } = await supabase
      .from("schools")
      .select("id, name")
      .eq("district_id", profile.district_id)
      .order("name");

    schools = schoolsData || [];
  }

  return (
    <UsersList
      users={users || []}
      schools={schools}
      currentUserRole={profile.role}
      districtName={profile.districts?.name || "District"}
    />
  );
}
