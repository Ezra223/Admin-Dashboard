// Test route deletion
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://nbbtnqdvizaxajvaijbv.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iYnRucWR2aXpheGFqdmFpamJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0Njk3MjYsImV4cCI6MjA2ODA0NTcyNn0.nTNvDYvZgSErdEEX4GZ36BmGIsbHnMEqQZ40gKub6IU";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRouteOperations() {
  console.log("Testing route operations...");

  try {
    // First, let's get all routes
    console.log("\n1. Getting all routes...");
    const { data: routes, error: fetchError } = await supabase
      .from("routes")
      .select("*");

    if (fetchError) {
      console.error("Error fetching routes:", fetchError);
      return;
    }

    console.log("Current routes:", routes);
    console.log("Total routes:", routes?.length || 0);

    // Check current user and permissions
    console.log("\n2. Checking current user...");
    const { data: user, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error("Error getting user:", userError);
    } else {
      console.log("Current user:", user?.user?.email || "No user");
      console.log("User authenticated:", !!user?.user);
    }

    // Test RLS policies by trying a delete with fake ID
    console.log("\n3. Testing delete permissions...");
    const { error: deleteError } = await supabase
      .from("routes")
      .delete()
      .eq("id", "00000000-0000-0000-0000-000000000000"); // Fake ID

    if (deleteError) {
      console.log("Delete permission test result:", deleteError.message);
    } else {
      console.log("Delete permission test: No error (good)");
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testRouteOperations()
  .then(() => {
    console.log("Test completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test error:", error);
    process.exit(1);
  });
