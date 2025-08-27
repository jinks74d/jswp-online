// Check if analytics tables exist in the database
// Run with: node check-db-tables.js

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables");
  console.log("NEXT_PUBLIC_SUPABASE_URL:", !!supabaseUrl);
  console.log("SUPABASE_SERVICE_ROLE_KEY:", !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  try {
    console.log("🔍 Checking database tables...\n");

    // Check if user_sessions table exists
    const { data: userSessions, error: userSessionsError } = await supabase
      .from("user_sessions")
      .select("*", { count: "exact", head: true });

    if (userSessionsError) {
      console.log("❌ user_sessions table:", userSessionsError.message);
    } else {
      console.log("✅ user_sessions table exists");
    }

    // Check if user_page_views table exists
    const { data: pageViews, error: pageViewsError } = await supabase
      .from("user_page_views")
      .select("*", { count: "exact", head: true });

    if (pageViewsError) {
      console.log("❌ user_page_views table:", pageViewsError.message);
    } else {
      console.log("✅ user_page_views table exists");
    }

    // Check if user_actions table exists
    const { data: actions, error: actionsError } = await supabase
      .from("user_actions")
      .select("*", { count: "exact", head: true });

    if (actionsError) {
      console.log("❌ user_actions table:", actionsError.message);
    } else {
      console.log("✅ user_actions table exists");
    }

    console.log("\n📊 Summary:");
    console.log("- user_sessions:", userSessionsError ? "❌" : "✅");
    console.log("- user_page_views:", pageViewsError ? "❌" : "✅");
    console.log("- user_actions:", actionsError ? "❌" : "✅");

    if (userSessionsError || pageViewsError || actionsError) {
      console.log(
        "\n💡 To fix: Run the analytics schema migration in Supabase SQL editor"
      );
      console.log("File: migrations/create-analytics-schema.sql");
    }
  } catch (error) {
    console.error("Error checking tables:", error.message);
  }
}

checkTables();
