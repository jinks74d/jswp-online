// app/super-admin/districts/[id]/page.tsx
import { createServerSupabaseClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DistrictDetailsView from "@/components/super-admin/DistrictDetailsView";

interface DistrictDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function DistrictDetailPage({ params }: DistrictDetailPageProps) {
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

  // Fetch district data with all related information
  const [districtResult, schoolsResult, adminsResult] = await Promise.all([
    // Get district information
    supabase
      .from("districts")
      .select("*")
      .eq("id", id)
      .single(),

    // Get schools in the district
    supabase
      .from("schools")
      .select(`
        id,
        name,
        address,
        principal_name,
        principal_email,
        phone,
        created_at,
        settings
      `)
      .eq("district_id", id)
      .order("name"),

    // Get district and school admins
    supabase
      .from("user_profiles")
      .select(`
        id,
        first_name,
        last_name,
        email,
        role,
        school_id,
        created_at,
        schools (
          id,
          name
        )
      `)
      .eq("district_id", id)
      .in("role", ["district_admin", "school_admin"])
      .order("role", { ascending: false })
      .order("last_name")
  ]);

  // Handle errors
  if (districtResult.error || !districtResult.data) {
    console.error("District not found:", districtResult.error);
    redirect("/super-admin/districts");
  }

  // Get total user count for the district
  const { count: totalUsers } = await supabase
    .from("user_profiles")
    .select("*", { count: "exact", head: true })
    .eq("district_id", id);

  // Get assignment count (if you have assignments table)
  let totalAssignments = 0;
  try {
    const { count } = await supabase
      .from("assignments")
      .select("*", { count: "exact", head: true })
      .eq("district_id", id);
    totalAssignments = count || 0;
  } catch (error) {
    // Table might not exist, use 0
    totalAssignments = 0;
  }

  const district = districtResult.data;
  const schools = schoolsResult.data || [];
  // Fix the admins mapping to handle the nested schools array
  const admins = (adminsResult.data || []).map(admin => ({
    ...admin,
    schools: Array.isArray(admin.schools) ? admin.schools[0] : admin.schools
  }));

  return (
    <div className="max-w-7xl mx-auto">
      <DistrictDetailsView 
        district={district}
        schools={schools}
        admins={admins}
        totalUsers={totalUsers || 0}
        totalAssignments={totalAssignments}
      />
    </div>
  );
}