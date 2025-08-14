// app/super-admin/users/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import UsersList from "@/components/super-admin/UsersList";

export default async function SuperAdminUsersPage() {
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  // Get current user and verify super admin permissions
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/");
  }

  // Get user profile to verify super admin role
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "super_admin") {
    redirect("/");
  }

  // Fetch all users with their district and school information
  const { data: users, error: usersError } = await supabase
    .from("user_profiles")
    .select(
      `
      *,
      districts:district_id(id, name, domain),
      schools:school_id(id, name)
    `
    )
    .order("created_at", { ascending: false });

  if (usersError) {
    console.error("Error fetching users:", usersError);
  }

  return <UsersList users={users || []} />;
}
