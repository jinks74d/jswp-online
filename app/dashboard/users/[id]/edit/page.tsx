// app/dashboard/users/[id]/edit/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect, notFound } from "next/navigation";
import EditUserForm from "@/components/dashboard/users/EditUserForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditUserPage({ params }: PageProps) {
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

  // Only district and school admins can edit users
  if (!["district_admin", "school_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  // Fetch user to edit
  const { data: userToEdit, error: userError } = await supabase
    .from("user_profiles")
    .select(
      `
      *,
      schools:school_id(id, name)
    `
    )
    .eq("id", resolvedParams.id)
    .eq("district_id", profile.district_id) // Ensure user belongs to same district
    .single();

  if (userError || !userToEdit) {
    notFound();
  }

  // For school admins, ensure they can only edit users from their school or unassigned users
  if (profile.role === "school_admin") {
    if (userToEdit.school_id && userToEdit.school_id !== profile.school_id) {
      redirect("/dashboard/users");
    }
    // School admins cannot edit district admins
    if (userToEdit.role === "district_admin") {
      redirect("/dashboard/users");
    }
  }

  // Fetch available schools for district admins
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
    <EditUserForm
      userToEdit={userToEdit}
      schools={schools}
      currentUserRole={profile.role}
      districtName={profile.districts?.name || "District"}
    />
  );
}
