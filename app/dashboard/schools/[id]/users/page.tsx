// app/dashboard/schools/[id]/users/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect, notFound } from "next/navigation";
import SchoolUsersManagement from "@/components/dashboard/schools/SchoolUsersManagement";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SchoolUsersPage({ params }: PageProps) {
  const resolvedParams = await params;
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

  // Fetch school details
  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select(
      `
      *,
      districts:district_id(id, name)
    `
    )
    .eq("id", resolvedParams.id)
    .eq("district_id", profile.district_id) // Ensure school belongs to user's district
    .single();

  if (schoolError || !school) {
    notFound();
  }

  // For school admins, ensure they can only manage their own school
  if (profile.role === "school_admin" && profile.school_id !== school.id) {
    redirect("/dashboard");
  }

  // Fetch school users
  const { data: users } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("school_id", resolvedParams.id)
    .order("created_at", { ascending: false });

  // Fetch all district users (not assigned to any school) for potential assignment
  const { data: unassignedUsers } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("district_id", profile.district_id)
    .is("school_id", null)
    .in("role", ["school_admin", "teacher"]) // Only roles that can be assigned to schools
    .order("created_at", { ascending: false });

  return (
    <SchoolUsersManagement
      school={school}
      users={users || []}
      unassignedUsers={unassignedUsers || []}
      currentUserRole={profile.role}
      districtName={profile.districts?.name || "District"}
    />
  );
}
