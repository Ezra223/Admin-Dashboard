// Simple test to check Supabase connection
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://nbbtnqdvizaxajvaijbv.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iYnRucWR2aXpheGFqdmFpamJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0Njk3MjYsImV4cCI6MjA2ODA0NTcyNn0.nTNvDYvZgSErdEEX4GZ36BmGIsbHnMEqQZ40gKub6IU";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    enabled: false, // Disable realtime for this test
  },
});

async function testConnection() {
  try {
    console.log("Testing Supabase connection...");

    // Test basic connection
    const { data, error } = await supabase.from("routes").select("*").limit(5);

    if (error) {
      console.error("Error:", error);
    } else {
      console.log("Success! Found routes:", data?.length || 0);
      console.log("Routes data:", JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("Connection test failed:", err);
  }
}

testConnection();
