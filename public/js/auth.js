// ========================================
//  COMPLETE AUTH & PROFILE SYSTEM
// ========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    sendPasswordResetEmail,
    updateProfile,
    signOut,
    onAuthStateChanged,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc,
    updateDoc,
    deleteDoc,
    increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL,
    deleteObject 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ========================================
//  FIREBASE CONFIGURATION
// ========================================

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

// ========================================
//  ========== GLOBAL VARIABLES ==========
// ========================================
let currentUser = null;
let userData = null;
let userCollection = null;

// ========================================
//  ========== DATABASE FUNCTIONS ==========
// ========================================

// Save email/password users to "users" collection
async function saveUserToDatabase(uid, userData) {
    try {
        await setDoc(doc(db, "users", uid), userData, { merge: true });
        console.log("✅ Email user saved to 'users' collection");
        return true;
    } catch (error) {
        console.error('❌ Firestore Save Error:', error);
        return null;
    }
}

// Get email/password user from "users" collection
async function getUserFromDatabase(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (error) {
        console.error('❌ Firestore Get Error:', error);
        return null;
    }
}

// Save Google users to "google_users" collection
async function saveGoogleUserToDatabase(uid, userData) {
    try {
        await setDoc(doc(db, "google_users", uid), userData, { merge: true });
        console.log("✅ Google user saved to 'google_users' collection");
        return true;
    } catch (error) {
        console.error('❌ Google User Firestore Save Error:', error);
        return null;
    }
}

// Get Google user from "google_users" collection
async function getGoogleUserFromDatabase(uid) {
    try {
        const docRef = doc(db, "google_users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (error) {
        console.error('❌ Google User Firestore Get Error:', error);
        return null;
    }
}

// Record Login Activity
async function recordLoginActivity(uid, authMethod) {
    try {
        const collection = authMethod === 'google' ? 'google_users' : 'users';
        const userRef = doc(db, collection, uid);
        
        await updateDoc(userRef, {
            lastLogin: new Date().toISOString(),
            loginCount: increment
        });
        console.log(`✅ Login recorded for ${authMethod} user`);
    } catch (error) {
        console.log('Error recording login:', error);
    }
}

// ========================================
//  ========== AUTH FUNCTIONS ==========
// ========================================

// Password Visibility Toggle
function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input || !button) return;
    
    const icon = button.querySelector('i');
    if (!icon) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// Forgot Password
async function handleForgotPassword(email) {
    if (!email) {
        showNotification('Please enter your email address', 'error');
        return false;
    }
    
    try {
        await sendPasswordResetEmail(auth, email);
        showNotification('Password reset email sent! Check your inbox.', 'success');
        return true;
    } catch (error) {
        console.error('Password reset error:', error);
        
        switch (error.code) {
            case 'auth/user-not-found':
                showNotification('No account found with this email address.', 'error');
                break;
            case 'auth/invalid-email':
                showNotification('Please enter a valid email address.', 'error');
                break;
            default:
                showNotification('Failed to send reset email. Please try again.', 'error');
        }
        return false;
    }
}

// Signup Handler
async function handleSignup(event) {
    event.preventDefault();
    
    const fullName = document.getElementById('fullName')?.value;
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    const terms = document.getElementById('terms')?.checked;
    const btn = document.getElementById('signupBtn');
    const errorDiv = document.getElementById('signupError');
    const successDiv = document.getElementById('signupSuccess');
    
    if (errorDiv) errorDiv.style.display = 'none';
    if (successDiv) successDiv.style.display = 'none';
    
    if (!fullName || !email || !password || !confirmPassword) {
        showError(errorDiv, 'Please fill in all fields');
        return;
    }
    if (password !== confirmPassword) {
        showError(errorDiv, 'Passwords do not match');
        return;
    }
    if (!terms) {
        showError(errorDiv, 'Please agree to terms');
        return;
    }
    
    setLoading(btn, true);
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await updateProfile(user, { displayName: fullName });
        
        await saveUserToDatabase(user.uid, {
            fullName,
            email,
            plan: 'free',
            authMethod: 'email',
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            loginCount: 1,
            emailVerified: false
        });
        
        showSuccess(successDiv, 'Account created! Redirecting...');
        setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        
    } catch (error) {
        console.error(error);
        let errorMessage = error.message;
        
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered. Please login instead.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters.';
        }
        
        showError(errorDiv, errorMessage);
    } finally {
        setLoading(btn, false);
    }
}

// Login Handler
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    const btn = document.getElementById('loginBtn');
    const errorDiv = document.getElementById('loginError');
    const successDiv = document.getElementById('loginSuccess');
    
    if (errorDiv) errorDiv.style.display = 'none';
    if (!email || !password) {
        showError(errorDiv, 'Please enter email and password');
        return;
    }
    
    setLoading(btn, true);
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        const userData = await getUserFromDatabase(user.uid);
        await recordLoginActivity(user.uid, 'email');
        
        localStorage.setItem('user', JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            plan: userData?.plan || 'free',
            authMethod: 'email'
        }));
        
        showSuccess(successDiv, 'Login successful!');
        
        // REDIRECT TO PROFILE PAGE
        window.location.href = 'profile.html';

    } catch (error) {
        console.error(error);
        let errorMessage = 'Invalid email or password.';
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Try again later.';
        }
        
        showError(errorDiv, errorMessage);
    } finally {
        setLoading(btn, false);
    }
}

// ========================================
//  ========== GOOGLE LOGIN WITH PROFILE PICTURE ==========
// ========================================
async function handleGoogleLogin() {
    const btn = document.querySelector('.google-btn');
    setGoogleLoading(btn, true);
    
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        console.log("✅ Google Sign-In successful for:", user.email);
        console.log("📸 Profile photo URL:", user.photoURL);
        
        let userData = await getGoogleUserFromDatabase(user.uid);
        
        if (!userData) {
            userData = {
                fullName: user.displayName || 'Google User',
                firstName: user.displayName?.split(' ')[0] || '',
                lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
                email: user.email,
                photoURL: user.photoURL || null,
                plan: 'free',
                authMethod: 'google',
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                emailVerified: user.emailVerified,
                loginCount: 1,
                uid: user.uid
            };
            
            await saveGoogleUserToDatabase(user.uid, userData);
            console.log("✅ New Google user created");
        } else {
            await recordLoginActivity(user.uid, 'google');
            console.log("✅ Existing Google user login recorded");
        }
        
        localStorage.setItem('user', JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            plan: 'free',
            authMethod: 'google'
        }));
        
        // 🔥 UPDATE PROFILE PICTURE EVERYWHERE
        if (user.photoURL) {
            updateProfilePicture(user.photoURL);
        }
        
        showNotification('Google Login Successful!', 'success');
        
        // REDIRECT TO PROFILE PAGE
        setTimeout(() => { 
            window.location.href = 'profile.html'; 
        }, 1000);
        
    } catch (error) {
        console.error('❌ Google Sign-In Error:', error);
        
        let errorMessage = 'Google login failed. ';
        
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Sign-in cancelled. Please try again.';
        } else if (error.code === 'auth/popup-blocked') {
            errorMessage = 'Pop-up blocked. Please allow pop-ups for this site.';
        } else if (error.code === 'auth/unauthorized-domain') {
            errorMessage = 'This domain is not authorized for Google Sign-In.';
        } else {
            errorMessage += error.message;
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        setGoogleLoading(btn, false);
    }
}

// ========================================
//  ========== PROFILE PICTURE UPDATE FUNCTION ==========
// ========================================
function updateProfilePicture(photoURL) {
    if (!photoURL) return;
    
    console.log("🖼️ Updating profile picture:", photoURL);
    
    // 1. Header profile icon (avatar-circle)
    const avatarCircle = document.querySelector('.avatar-circle');
    if (avatarCircle) {
        const existingImg = avatarCircle.querySelector('img');
        if (existingImg) {
            existingImg.src = photoURL;
        } else {
            avatarCircle.innerHTML = ''; // Clear icon
            const img = document.createElement('img');
            img.src = photoURL;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.borderRadius = '50%';
            img.style.objectFit = 'cover';
            avatarCircle.appendChild(img);
        }
    }
    
    // 2. Profile page avatar
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        profileAvatar.src = photoURL;
    }
    
    // 3. Mobile navigation avatar
    const mobileAvatarIcon = document.querySelector('.mobile-nav-avatar i');
    const mobileAvatarImg = document.querySelector('.mobile-nav-avatar img');
    
    if (mobileAvatarIcon) {
        const parent = mobileAvatarIcon.parentNode;
        const img = document.createElement('img');
        img.src = photoURL;
        img.style.width = '40px';
        img.style.height = '40px';
        img.style.borderRadius = '50%';
        img.style.objectFit = 'cover';
        parent.replaceChild(img, mobileAvatarIcon);
    } else if (mobileAvatarImg) {
        mobileAvatarImg.src = photoURL;
    }
    
    // 4. User box image (profile-left)
    const userBoxImg = document.querySelector('.user-box img');
    if (userBoxImg && userBoxImg.id !== 'profileAvatar') {
        userBoxImg.src = photoURL;
    }
}

// ========================================
//  ========== DYNAMIC DROPDOWN MENU UPDATE ==========
// ========================================
function updateDynamicMenu(user) {
    const dynamicMenu = document.getElementById('dynamicProfileMenu');
    const dynamicMobileMenu = document.getElementById('dynamicMobileMenu');
    
    if (!dynamicMenu || !dynamicMobileMenu) return;
    
    if (user) {
        // ✅ LOGGED IN STATE - Dashboard ab index.html par jayega
        dynamicMenu.innerHTML = `
            <a href="profile.html" class="profile-menu-item">
                <i class="fas fa-user"></i><span>Profile</span>
            </a>
            <a href="index.html" class="profile-menu-item">
                <i class="fas fa-chart-bar"></i><span>Dashboard</span>
            </a>
            <button onclick="handleLogout()" class="profile-menu-item">
                <i class="fas fa-sign-out-alt"></i><span>Logout</span>
            </button>
        `;
        
        dynamicMobileMenu.innerHTML = `
            <a href="profile.html" class="mobile-nav-link">
                <i class="fas fa-user"></i><span>Profile</span>
            </a>
            <a href="index.html" class="mobile-nav-link">
                <i class="fas fa-chart-bar"></i><span>Dashboard</span>
            </a>
            <button onclick="handleLogout()" class="mobile-nav-link">
                <i class="fas fa-sign-out-alt"></i><span>Logout</span>
            </button>
        `;
        
        // Update profile picture
        if (user.photoURL) {
            updateProfilePicture(user.photoURL);
        }
        
        // Update name in header
        const menuName = document.getElementById('profileMenuName');
        if (menuName) menuName.textContent = user.displayName || 'User';
        
        const mobileTitle = document.getElementById('mobileNavTitle');
        if (mobileTitle) mobileTitle.textContent = user.displayName || 'User';
        
    } else {
        // ❌ LOGGED OUT STATE
        dynamicMenu.innerHTML = `
            <a href="login.html" class="profile-menu-item">
                <i class="fas fa-sign-in-alt"></i><span>Login</span>
            </a>
            <a href="signup.html" class="profile-menu-item">
                <i class="fas fa-user-plus"></i><span>Sign Up</span>
            </a>
        `;
        
        dynamicMobileMenu.innerHTML = `
            <a href="login.html" class="mobile-nav-link">
                <i class="fas fa-sign-in-alt"></i><span>Login</span>
            </a>
            <a href="signup.html" class="mobile-nav-link">
                <i class="fas fa-user-plus"></i><span>Sign Up</span>
            </a>
        `;
        
        // Reset header
        const avatarCircle = document.querySelector('.avatar-circle');
        if (avatarCircle) {
            avatarCircle.innerHTML = '<i class="fas fa-user"></i>';
        }
        
        const menuName = document.getElementById('profileMenuName');
        if (menuName) menuName.textContent = 'Account';
        
        const mobileTitle = document.getElementById('mobileNavTitle');
        if (mobileTitle) mobileTitle.textContent = 'Menu';
    }
}

// ========================================
//  ========== LOGOUT HANDLER ==========
// ========================================
window.handleLogout = async function() {
    try {
        console.log("🚪 Logging out...");
        
        // Sign out from Firebase
        await signOut(auth);
        
        // Clear localStorage
        localStorage.removeItem('user');
        
        // Update dropdown to logged out state
        updateDynamicMenu(null);
        
        // Reset header avatar (extra safety)
        const avatarCircle = document.querySelector('.avatar-circle');
        if (avatarCircle) {
            avatarCircle.innerHTML = '<i class="fas fa-user"></i>';
        }
        
        console.log("✅ Logout successful, redirecting to home...");
        
        // Redirect to home page
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('❌ Logout error:', error);
        showNotification('Logout failed: ' + error.message, 'error');
    }
};

// Make other functions globally available
window.toggleProfileMenu = function(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('profileMenu')?.classList.toggle('show');
};

window.toggleToolkitMenu = function(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('toolkitMenu')?.classList.toggle('show');
};

window.toggleMobileMenu = function() {
    const nav = document.getElementById('mobileNav');
    if (nav) {
        nav.classList.toggle('show');
        document.body.style.overflow = nav.classList.contains('show') ? 'hidden' : '';
    }
};

// Forgot Password Handler
function setupForgotPasswordHandler() {
    const forgotLink = document.getElementById('forgotPassword');
    if (forgotLink) {
        forgotLink.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('email');
            const email = emailInput ? emailInput.value : '';
            
            if (email) {
                const confirmed = confirm(`Send password reset email to ${email}?`);
                if (confirmed) {
                    await handleForgotPassword(email);
                }
            } else {
                const emailPrompt = prompt('Please enter your email address to reset password:');
                if (emailPrompt) {
                    await handleForgotPassword(emailPrompt);
                }
            }
        });
    }
}

// ========================================
//  ========== PROFILE FUNCTIONS ==========
// ========================================

// Load User Profile
async function loadUserProfile() {
    try {
        showLoading(true);
        
        const googleDoc = await getDoc(doc(db, "google_users", currentUser.uid));
        const emailDoc = await getDoc(doc(db, "users", currentUser.uid));
        
        if (googleDoc.exists()) {
            userData = googleDoc.data();
            userCollection = 'google_users';
            console.log("📁 Google user data loaded");
        } else if (emailDoc.exists()) {
            userData = emailDoc.data();
            userCollection = 'users';
            console.log("📁 Email user data loaded");
        } else {
            userData = {
                fullName: currentUser.displayName || 'User',
                email: currentUser.email,
                plan: 'free',
                createdAt: new Date().toISOString(),
                authMethod: 'email'
            };
            
            await setDoc(doc(db, "users", currentUser.uid), userData);
            userCollection = 'users';
            console.log("📁 New user profile created");
        }
        
        displayUserProfile();
        
        // 🔥 Update profile picture if available
        if (currentUser.photoURL) {
            updateProfilePicture(currentUser.photoURL);
        }
        
    } catch (error) {
        console.error('❌ Error loading profile:', error);
        showNotification('Error loading profile', 'error');
    } finally {
        showLoading(false);
    }
}

// Display User Profile
function displayUserProfile() {
    const avatar = document.getElementById('profileAvatar');
    const displayName = document.getElementById('profileDisplayName');
    const email = document.getElementById('profileEmail');
    
    if (avatar && (userData.photoURL || currentUser.photoURL)) {
        avatar.src = userData.photoURL || currentUser.photoURL;
    }
    
    if (displayName) {
        displayName.textContent = userData.fullName || currentUser.displayName || 'User';
    }
    
    if (email) {
        email.textContent = currentUser.email;
    }
    
    /* ACCOUNT INFO */
    const overviewFullName = document.getElementById('overviewFullName');
    const overviewEmail = document.getElementById('overviewEmail');
    const overviewAccountType = document.getElementById('overviewAccountType');
    const overviewMemberSince = document.getElementById('overviewMemberSince');
    const overviewPlan = document.getElementById('overviewPlan');
    
    if (overviewFullName)
        overviewFullName.textContent = userData.fullName || currentUser.displayName;
    
    if (overviewEmail)
        overviewEmail.textContent = currentUser.email;
    
    if (overviewAccountType)
        overviewAccountType.textContent = userCollection === "google_users" ? "Google Account" : "Email Account";
    
    if (overviewPlan)
        overviewPlan.textContent = userData.plan === "free" ? "Free" : "Premium";
    
    /* MEMBER SINCE */
    const memberSince = userData.createdAt || currentUser.metadata.creationTime;
    if (overviewMemberSince && memberSince) {
        const date = new Date(memberSince);
        overviewMemberSince.textContent = date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }
}

// Update Profile
async function updateProfileData(event) {
    event.preventDefault();
    
    const saveBtn = document.getElementById('saveProfileBtn');
    const successDiv = document.getElementById('editSuccess');
    const errorDiv = document.getElementById('editError');
    
    if (successDiv) successDiv.style.display = 'none';
    if (errorDiv) errorDiv.style.display = 'none';
    
    setButtonLoading(saveBtn, true);
    
    try {
        const fullName = document.getElementById('editFullName')?.value.trim();
        const bio = document.getElementById('editBio')?.value.trim();
        const location = document.getElementById('editLocation')?.value.trim();
        
        if (!fullName) {
            throw new Error('Full name is required');
        }
        
        const updateData = {
            fullName: fullName,
            bio: bio || '',
            location: location || '',
            updatedAt: new Date().toISOString()
        };
        
        await updateDoc(doc(db, userCollection, currentUser.uid), updateData);
        
        if (currentUser.displayName !== fullName) {
            await updateProfile(currentUser, { displayName: fullName });
        }
        
        userData = { ...userData, ...updateData };
        
        // Update UI
        const profileDisplayName = document.getElementById('profileDisplayName');
        const overviewFullName = document.getElementById('overviewFullName');
        const overviewBio = document.getElementById('overviewBio');
        const overviewLocation = document.getElementById('overviewLocation');
        
        if (profileDisplayName) profileDisplayName.textContent = fullName;
        if (overviewFullName) overviewFullName.textContent = fullName;
        if (overviewBio) overviewBio.textContent = bio || 'Not provided';
        if (overviewLocation) overviewLocation.textContent = location || 'Not provided';
        
        if (successDiv) {
            successDiv.style.display = 'block';
            successDiv.innerHTML = '<i class="fas fa-check-circle"></i> Profile updated successfully!';
            setTimeout(() => { successDiv.style.display = 'none'; }, 3000);
        }
        
    } catch (error) {
        console.error('❌ Update error:', error);
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${error.message}`;
        }
    } finally {
        setButtonLoading(saveBtn, false);
    }
}

// Change Password
async function changePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword')?.value;
    const newPassword = document.getElementById('newPassword')?.value;
    const confirmPassword = document.getElementById('confirmNewPassword')?.value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('New passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    const btn = document.getElementById('updatePasswordBtn');
    setButtonLoading(btn, true);
    
    try {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
        
        showNotification('Password updated successfully!', 'success');
        
        const currentPassInput = document.getElementById('currentPassword');
        const newPassInput = document.getElementById('newPassword');
        const confirmPassInput = document.getElementById('confirmNewPassword');
        
        if (currentPassInput) currentPassInput.value = '';
        if (newPassInput) newPassInput.value = '';
        if (confirmPassInput) confirmPassInput.value = '';
        
    } catch (error) {
        console.error('❌ Password change error:', error);
        
        let errorMessage = 'Failed to update password. ';
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'Current password is incorrect.';
        } else {
            errorMessage += error.message;
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

// Upload Avatar
function setupAvatarUpload() {
    const editBtn = document.getElementById('editAvatarBtn');
    
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                if (file.size > 2 * 1024 * 1024) {
                    showNotification('File size must be less than 2MB', 'error');
                    return;
                }
                
                if (!file.type.startsWith('image/')) {
                    showNotification('Please upload an image file', 'error');
                    return;
                }
                
                setButtonLoading(editBtn, true);
                
                try {
                    const storageRef = ref(storage, `avatars/${currentUser.uid}`);
                    await uploadBytes(storageRef, file);
                    
                    const photoURL = await getDownloadURL(storageRef);
                    
                    await updateProfile(currentUser, { photoURL: photoURL });
                    await updateDoc(doc(db, userCollection, currentUser.uid), {
                        photoURL: photoURL,
                        updatedAt: new Date().toISOString()
                    });
                    
                    const profileAvatar = document.getElementById('profileAvatar');
                    if (profileAvatar) profileAvatar.src = photoURL;
                    
                    showNotification('Profile picture updated!', 'success');
                    
                } catch (error) {
                    console.error('❌ Avatar upload error:', error);
                    showNotification('Failed to upload image', 'error');
                } finally {
                    setButtonLoading(editBtn, false);
                }
            };
            
            input.click();
        });
    }
}

// Delete Account
async function deleteAccount() {
    const confirmed = confirm(
        '⚠️ Are you sure you want to delete your account?\n\n' +
        'This action cannot be undone. All your data will be permanently deleted.'
    );
    
    if (!confirmed) return;
    
    const password = prompt('Please enter your password to confirm:');
    if (!password) return;
    
    const btn = document.getElementById('deleteAccountBtn');
    setButtonLoading(btn, true);
    
    try {
        if (userCollection === 'users') {
            const credential = EmailAuthProvider.credential(currentUser.email, password);
            await reauthenticateWithCredential(currentUser, credential);
        }
        
        if (currentUser.photoURL) {
            try {
                const storageRef = ref(storage, `avatars/${currentUser.uid}`);
                await deleteObject(storageRef);
            } catch (e) {
                console.log('No avatar to delete');
            }
        }
        
        await deleteDoc(doc(db, userCollection, currentUser.uid));
        await currentUser.delete();
        
        localStorage.removeItem('user');
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('❌ Delete account error:', error);
        
        let errorMessage = 'Failed to delete account. ';
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password.';
        } else {
            errorMessage += error.message;
        }
        
        showNotification(errorMessage, 'error');
        setButtonLoading(btn, false);
    }
}

// ========================================
//  ========== HELPER FUNCTIONS ==========
// ========================================

// Simple Tab Setup (only 2 tabs)
function setupSimpleTabs() {
    const overviewBtn = document.getElementById("overviewTabBtn");
    const editBtn = document.getElementById("editTabBtn");
    const overview = document.getElementById("overviewContent");
    const edit = document.getElementById("editContent");
    
    if (!overviewBtn || !editBtn) return;
    
    overviewBtn.addEventListener("click", () => {
        overviewBtn.classList.add("active");
        editBtn.classList.remove("active");
        overview.classList.add("active");
        edit.classList.remove("active");
    });
    
    editBtn.addEventListener("click", () => {
        editBtn.classList.add("active");
        overviewBtn.classList.remove("active");
        edit.classList.add("active");
        overview.classList.remove("active");
    });
}

function setupPasswordToggles() {
    const toggleBtns = document.querySelectorAll('.password-toggle');
    
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const wrapper = this.closest('.password-input-wrapper');
            if (wrapper) {
                const input = wrapper.querySelector('input');
                const icon = this.querySelector('i');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.className = 'fas fa-eye-slash';
                } else {
                    input.type = 'password';
                    icon.className = 'fas fa-eye';
                }
            }
        });
    });
}

function setupEventListeners() {
    const editForm = document.getElementById('editProfileForm');
    if (editForm) editForm.addEventListener('submit', updateProfileData);
    
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            const overviewBtn = document.getElementById('overviewTabBtn');
            if (overviewBtn) overviewBtn.click();
        });
    }
    
    const updatePasswordBtn = document.getElementById('updatePasswordBtn');
    if (updatePasswordBtn) {
        updatePasswordBtn.addEventListener('click', changePassword);
    }
    
    const deleteBtn = document.getElementById('deleteAccountBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', deleteAccount);
    
    setupAvatarUpload();
}

function setButtonLoading(btn, isLoading) {
    if (!btn) return;
    
    btn.disabled = isLoading;
    
    if (isLoading) {
        const originalText = btn.innerHTML;
        btn.dataset.originalText = originalText;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    } else {
        if (btn.dataset.originalText) {
            btn.innerHTML = btn.dataset.originalText;
        }
    }
}

function showLoading(show) {
    const loader = document.getElementById('loadingSpinner');
    if (loader) loader.style.display = show ? 'block' : 'none';
}

function showNotification(message, type) {
    let notification = document.getElementById('notification');
    
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 10px;
            color: white;
            font-weight: 500;
            z-index: 9999;
            display: none;
            animation: slideIn 0.3s ease;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(notification);
    }
    
    notification.style.backgroundColor = type === 'success' ? '#10b981' : '#ef4444';
    notification.innerHTML = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function setLoading(btn, isLoading) {
    if (!btn) return;
    btn.disabled = isLoading;
    
    const btnText = btn.querySelector('.btn-text');
    const btnIcon = btn.querySelector('i:not(.fa-spinner)');
    const loader = btn.querySelector('.btn-loader');
    
    if (isLoading) {
        if (btnText) btnText.style.opacity = '0.5';
        if (btnIcon) btnIcon.style.opacity = '0.5';
        if (loader) loader.style.display = 'inline-block';
    } else {
        if (btnText) btnText.style.opacity = '1';
        if (btnIcon) btnIcon.style.opacity = '1';
        if (loader) loader.style.display = 'none';
    }
}

function setGoogleLoading(btn, isLoading) {
    if (!btn) return;
    btn.disabled = isLoading;
    
    const btnText = btn.querySelector('.btn-text');
    const btnIcon = btn.querySelector('.fab');
    const loader = btn.querySelector('.btn-loader');
    
    if (isLoading) {
        if (btnText) btnText.style.opacity = '0.5';
        if (btnIcon) btnIcon.style.opacity = '0.5';
        if (loader) loader.style.display = 'inline-block';
    } else {
        if (btnText) btnText.style.opacity = '1';
        if (btnIcon) btnIcon.style.opacity = '1';
        if (loader) loader.style.display = 'none';
    }
}

function showError(div, message) {
    if (!div) return;
    div.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    div.style.display = 'block';
    
    setTimeout(() => {
        div.style.display = 'none';
    }, 5000);
}

function showSuccess(div, message) {
    if (!div) return;
    div.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    div.style.display = 'block';
}

// ========================================
//  ========== AUTH STATE ==========
// ========================================

function checkAuthState() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            const emailUser = await getUserFromDatabase(user.uid);
            const googleUser = await getGoogleUserFromDatabase(user.uid);
            
            if (emailUser) {
                updateUIForLoggedIn(user, 'email');
            } else if (googleUser) {
                updateUIForLoggedIn(user, 'google');
            } else {
                console.log('User authenticated but no Firestore record');
                updateUIForLoggedIn(user, 'unknown');
            }
            
            // Agar profile page hai to load karo
            if (window.location.pathname.includes('profile.html')) {
                await loadUserProfile();
                setupEventListeners();
                setupSimpleTabs();
                setupPasswordToggles();
            }
        } else {
            updateUIForLoggedOut();
        }
    });
}

// 🔥 UPDATED: Now calls updateDynamicMenu
function updateUIForLoggedIn(user, authMethod) {
    const dashboardLink = document.getElementById('dashboardLink');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginLink = document.getElementById('loginLink');
    const signupLink = document.getElementById('signupLink');
    
    if (dashboardLink) dashboardLink.style.display = 'flex';
    if (logoutBtn) logoutBtn.style.display = 'flex';
    if (loginLink) loginLink.style.display = 'none';
    if (signupLink) signupLink.style.display = 'none';
    
    localStorage.setItem('user', JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        authMethod: authMethod
    }));
    
    // 🔥 Update dynamic dropdown
    updateDynamicMenu(user);
}

// 🔥 UPDATED: Now calls updateDynamicMenu
function updateUIForLoggedOut() {
    const dashboardLink = document.getElementById('dashboardLink');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginLink = document.getElementById('loginLink');
    const signupLink = document.getElementById('signupLink');
    
    if (dashboardLink) dashboardLink.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (loginLink) loginLink.style.display = 'flex';
    if (signupLink) signupLink.style.display = 'flex';
    
    localStorage.removeItem('user');
    
    // 🔥 Update dynamic dropdown to logged out state
    updateDynamicMenu(null);
}

// ===== DARK MODE =====
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// ===== LAYOUT FIX =====
window.loadComponent = function(componentId, filePath) {
    const element = document.getElementById(componentId);
    if (!element) {
        console.log(`Element ${componentId} not found - skipping`);
        return;
    }
    
    fetch(filePath)
        .then(response => response.text())
        .then(data => {
            element.innerHTML = data;
        })
        .catch(error => {
            console.log('Error loading component:', error);
        });
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ Complete Auth+Profile System Loaded");
    loadTheme();
    checkAuthState();
    setupForgotPasswordHandler();
    
    // Signup form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) signupForm.addEventListener('submit', handleSignup);
    
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    // Google buttons
    const googleBtn = document.getElementById('googleLoginBtn') || document.getElementById('googleSignupBtn');
    if (googleBtn) {
        googleBtn.addEventListener('click', handleGoogleLogin);
        console.log("✅ Google button handler attached");
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Password toggle buttons
    const toggleBtns = document.querySelectorAll('.password-toggle');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const wrapper = this.closest('.password-input-wrapper');
            if (wrapper) {
                const input = wrapper.querySelector('input');
                if (input) {
                    togglePassword(input.id, this);
                }
            }
        });
    });
});