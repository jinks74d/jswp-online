// app/super-admin/districts/[id]/edit/page.tsx
import { createServerSupabaseClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import EditDistrictForm from "@/components/super-admin/EditDistrictForm";

interface EditDistrictPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditDistrictPage({ params }: EditDistrictPageProps) {
  const { id } = await params;

  // Create Supabase client
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  // Get user profile to verify role
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  // Get district data
  const { data: district, error: districtError } = await supabase
    .from("districts")
    .select("*")
    .eq("id", id)
    .single();

  if (districtError || !district) {
    redirect("/super-admin/districts");
  }

  // Get POC user data
  const { data: pocProfile, error: pocError } = await supabase
    .from("user_profiles")
    .select("id, first_name, last_name, email")
    .eq("district_id", district.id)
    .eq("role", "district_admin")
    .contains("metadata", { is_poc: true })
    .single();

  return (
    <div className="max-w-4xl mx-auto">
      <EditDistrictForm 
        district={district} 
        pocProfile={pocProfile || null} 
      />
    </div>
  );
}