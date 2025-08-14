// app/super-admin/districts/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import DistrictsClientPage from "@/components/super-admin/DistrictsClientPage";

interface District {
  id: string;
  name: string;
  domain: string | null;
  poc_email: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  created_at: string;
  settings: Record<string, any>;
}

export default async function DistrictsPage() {
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  // Verify authentication and permissions
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

  // Fetch districts data on server
  let districts: District[] = [];
  try {
    const { data, error: districtsError } = await supabase
      .from("districts")
      .select("*")
      .order("created_at", { ascending: false });

    if (districtsError) {
      console.error("Error fetching districts:", districtsError);
    } else {
      districts = data || [];
    }
  } catch (error) {
    console.error("Error fetching districts:", error);
  }

  // Pass data to client component for interactivity
  return <DistrictsClientPage initialDistricts={districts} />;
}