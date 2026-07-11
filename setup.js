#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

console.log("🚀 Setting up Miniway Admin Dashboard...\n");

// Check if .env.local already exists
const envPath = path.join(__dirname, ".env.local");
if (fs.existsSync(envPath)) {
  console.log(
    "⚠️  .env.local already exists. Skipping environment file creation."
  );
} else {
  // Create .env.local file
  const envContent = `# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://nbbtnqdvizaxajvaijbv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Google Maps API Key (optional)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
`;

  fs.writeFileSync(envPath, envContent);
  console.log("✅ Created .env.local file");
  console.log(
    "📝 Please update the environment variables with your actual values\n"
  );
}

// Check if node_modules exists
const nodeModulesPath = path.join(__dirname, "node_modules");
if (!fs.existsSync(nodeModulesPath)) {
  console.log("📦 Installing dependencies...");
  const { execSync } = require("child_process");
  try {
    execSync("npm install", { stdio: "inherit" });
    console.log("✅ Dependencies installed successfully\n");
  } catch (error) {
    console.error("❌ Failed to install dependencies:", error.message);
    process.exit(1);
  }
} else {
  console.log("✅ Dependencies already installed\n");
}

console.log("🎉 Setup complete!");
console.log("\nNext steps:");
console.log("1. Update .env.local with your Supabase credentials");
console.log("2. Run: npm run dev");
console.log("3. Open: http://localhost:3000");
console.log("\nFor detailed setup instructions, see README.md");
