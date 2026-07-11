// Simple test to check if routes can be fetched from Supabase
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://nbbtnqdvizaxajvaijbv.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iYnRucWR2aXpheGFqdmFpamJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0Njk3MjYsImV4cCI6MjA2ODA0NTcyNn0.nTNvDYvZgSErdEEX4GZ36BmGIsbHnMEqQZ40gKub6IU";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRoutesConnection() {
  console.log("Testing Supabase connection for routes...");

  try {
    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from("routes")
      .select("count", { count: "exact", head: true });

    if (testError) {
      console.error("Error connecting to routes table:", testError);
      return;
    }

    console.log("✅ Successfully connected to routes table");
    console.log(`📊 Total routes in database: ${testData}`);

    // Fetch all routes
    const { data: routes, error } = await supabase
      .from("routes")
      .select("*")
      .limit(5);

    if (error) {
      console.error("Error fetching routes:", error);
      return;
    }

    console.log("✅ Successfully fetched routes:");
    console.log(JSON.stringify(routes, null, 2));

    if (routes.length === 0) {
      console.log(
        "⚠️  No routes found in database. You may need to add some routes first."
      );
    }
  } catch (err) {
    console.error("❌ Test failed:", err);
  }
}

testRoutesConnection();
