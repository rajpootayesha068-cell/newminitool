// ========================================
// FIREBASE CONFIGURATION
// ========================================

// Import the functions you need from the SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAioI4UQlC-IgHvOTkJa7QWFLhPb-35Upw",
    authDomain: "minitoolbox-b8040.firebaseapp.com",
    databaseURL: "https://minitoolbox-b8040-default-rtdb.firebaseio.com",
    projectId: "minitoolbox-b8040",
    storageBucket: "minitoolbox-b8040.firebasestorage.app",
    messagingSenderId: "271458471633",
    appId: "1:271458471633:web:7512ddcfa443da1bedbff0",
    measurementId: "G-5Q6HFGN4F3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Google Provider Settings
googleProvider.setCustomParameters({
    'prompt': 'select_account'
});

// Export for use in other files
export { auth, db, storage, googleProvider };