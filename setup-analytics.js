// Setup analytics tables in Supabase
// Run with: node setup-analytics.js

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables");
  console.log("NEXT_PUBLIC_SUPABASE_URL:", !!supabaseUrl);
  console.log("SUPABASE_SERVICE_ROLE_KEY:", !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupAnalytics() {
  try {
    console.log("🚀 Setting up analytics tables...\n");

    // Read the migration file
    const migrationPath = path.join(
      __dirname,
      "migrations",
      "create-analytics-schema.sql"
    );

    if (!fs.existsSync(migrationPath)) {
      console.error("❌ Migration file not found:", migrationPath);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      if (statement.trim().length === 0) continue;

      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);

        const { error } = await supabase.rpc("exec_sql", {
          sql: statement + ";",
        });

        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          // Continue with other statements
        } else {
          console.log(`✅ Statement ${i + 1} completed`);
        }
      } catch (error) {
        console.error(`❌ Exception in statement ${i + 1}:`, error.message);
      }
    }

    console.log("\n🔍 Verifying table creation...");

    // Verify tables were created
    const { data: userSessions, error: userSessionsError } = await supabase
      .from("user_sessions")
      .select("*", { count: "exact", head: true });

    const { data: pageViews, error: pageViewsError } = await supabase
      .from("user_page_views")
      .select("*", { count: "exact", head: true });

    const { data: actions, error: actionsError } = await supabase
      .from("user_actions")
      .select("*", { count: "exact", head: true });

    console.log("\n📊 Table Status:");
    console.log("- user_sessions:", userSessionsError ? "❌" : "✅");
    console.log("- user_page_views:", pageViewsError ? "❌" : "✅");
    console.log("- user_actions:", actionsError ? "❌" : "✅");

    if (!userSessionsError && !pageViewsError && !actionsError) {
      console.log("\n🎉 Analytics setup completed successfully!");
      console.log("\nNext steps:");
      console.log("1. Login to your dashboard");
      console.log("2. Navigate around to generate session data");
      console.log("3. Visit /dashboard/analytics to view your data");
    } else {
      console.log("\n⚠️  Some tables may not have been created properly.");
      console.log(
        "You may need to run the migration manually in Supabase SQL Editor."
      );
    }
  } catch (error) {
    console.error("❌ Error setting up analytics:", error.message);
  }
}

setupAnalytics();
