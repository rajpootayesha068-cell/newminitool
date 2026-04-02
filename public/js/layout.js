// ========================================
//     LAYOUT.JS 
// ========================================

async function loadComponent(id, file) {
  // Pehle check karo element exist karta hai ya nahi
  const element = document.getElementById(id);
  
  if (!element) {
    console.log(`⚠️ Element "${id}" not found on this page - skipping`);
    return; // Exit function without error
  }
  
  try {
    const response = await fetch(file);
    
    // Check if file fetch successful
    if (!response.ok) {
      console.log(`⚠️ File "${file}" not found - skipping`);
      return;
    }
    
    const html = await response.text();
    element.innerHTML = html;
    console.log(`✅ Loaded ${id} from ${file}`);
  } catch (error) {
    console.log(`❌ Error loading ${id}:`, error.message);
    // Don't throw error - just log it
  }
}

// // Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  console.log("📦 Layout.js initializing...");
  
  // Load components only if elements exist
  loadComponent("header", "Global Component/header.html");
  loadComponent("footer", "Global Component/footer.html");
  loadComponent("background-wrapper", "Global Component/background.html");
  
  console.log("📦 Layout.js initialization complete");
});

// Optional: Add retry function if needed
window.reloadComponents = function() {
  console.log("🔄 Reloading components...");
  loadComponent("header", "Global Component/header.html");
  loadComponent("footer", "Global Component/footer.html");
  loadComponent("background-wrapper", "Global Component/background.html");
};


