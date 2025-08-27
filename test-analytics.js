// Simple test to check if analytics API is working
// Run with: node test-analytics.js

const fetch = require("node-fetch");

async function testAnalyticsAPI() {
  try {
    console.log("Testing analytics API...");

    // Test the analytics endpoint
    const response = await fetch(
      "http://localhost:3000/api/analytics/dashboard?range=7d&level=auto",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Response status:", response.status);

    if (response.ok) {
      const data = await response.json();
      console.log("Analytics data received:", JSON.stringify(data, null, 2));
    } else {
      const error = await response.text();
      console.log("Error response:", error);
    }
  } catch (error) {
    console.error("Error testing analytics API:", error.message);
  }
}

testAnalyticsAPI();
