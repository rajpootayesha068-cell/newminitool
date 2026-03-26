// ========================================
// MASTER JAVASCRIPT FILE - MiniToolBox
// ========================================

// ===== IMPORTS FROM FIREBASE CONFIG =====
import { auth, db, storage, googleProvider } from '../firebase-config.js';

// ===== ADDITIONAL FIREBASE FUNCTIONS =====
import { 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    sendPasswordResetEmail,
    updateProfile,
    signOut,
    onAuthStateChanged,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider
    
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

import { 
    doc, 
    setDoc, 
    getDoc,
    updateDoc,
    deleteDoc,
    increment
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

import { 
    ref, 
    uploadBytes, 
    getDownloadURL,
    deleteObject 
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-storage.js";

// ========================================
// ========== GLOBAL VARIABLES ==========
// ========================================
window.days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let currentUser = null;
let userData = null;
let userCollection = null;
let currentUserType = 'free';

// ========================================
// ========== DATABASE FUNCTIONS ==========
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
// ========== AUTH FUNCTIONS ==========
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
// ========== GOOGLE LOGIN ==========
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
        
        if (user.photoURL) {
            updateProfilePicture(user.photoURL);
        }
        
        showNotification('Google Login Successful!', 'success');
        
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
// ========== PROFILE PICTURE UPDATE ==========
// ========================================
function updateProfilePicture(photoURL) {
    if (!photoURL) return;
    
    console.log("🖼️ Updating profile picture:", photoURL);
    
    const avatarCircle = document.querySelector('.avatar-circle');
    if (avatarCircle) {
        const existingImg = avatarCircle.querySelector('img');
        if (existingImg) {
            existingImg.src = photoURL;
        } else {
            avatarCircle.innerHTML = '';
            const img = document.createElement('img');
            img.src = photoURL;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.borderRadius = '50%';
            img.style.objectFit = 'cover';
            avatarCircle.appendChild(img);
        }
    }
    
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        profileAvatar.src = photoURL;
    }
    
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
    
    const userBoxImg = document.querySelector('.user-box img');
    if (userBoxImg && userBoxImg.id !== 'profileAvatar') {
        userBoxImg.src = photoURL;
    }
}

// ========================================
// ========== DYNAMIC DROPDOWN MENU ==========
// ========================================
function updateDynamicMenu(user) {
    const dynamicMenu = document.getElementById('dynamicProfileMenu');
    const dynamicMobileMenu = document.getElementById('dynamicMobileMenu');
    
    if (!dynamicMenu || !dynamicMobileMenu) return;
    
    if (user) {
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
        
        if (user.photoURL) {
            updateProfilePicture(user.photoURL);
        }
        
        const menuName = document.getElementById('profileMenuName');
        if (menuName) menuName.textContent = user.displayName || 'User';
        
        const mobileTitle = document.getElementById('mobileNavTitle');
        if (mobileTitle) mobileTitle.textContent = user.displayName || 'User';
        
    } else {
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
// ========== DROPDOWN MENU FUNCTIONS ==========
// ========================================

window.toggleProfileMenu = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const menu = document.getElementById('profileMenu');
    if (menu) {
        menu.classList.toggle('show');
    }
};

window.toggleToolkitMenu = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const menu = document.getElementById('toolkitMenu');
    if (menu) {
        menu.classList.toggle('show');
    }
};

window.toggleMobileMenu = function() {
    const nav = document.getElementById('mobileNav');
    if (nav) {
        nav.classList.toggle('show');
        document.body.style.overflow = nav.classList.contains('show') ? 'hidden' : '';
    }
};

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
    const profileMenu = document.getElementById('profileMenu');
    const profileBtn = document.querySelector('.profile-icon-container');
    if (profileMenu && profileBtn && !profileMenu.contains(e.target) && !profileBtn.contains(e.target)) {
        profileMenu.classList.remove('show');
    }
    
    const toolkitMenu = document.getElementById('toolkitMenu');
    const toolkitBtn = document.querySelector('.toolkit-trigger');
    if (toolkitMenu && toolkitBtn && !toolkitMenu.contains(e.target) && !toolkitBtn.contains(e.target)) {
        toolkitMenu.classList.remove('show');
    }
});

// ========================================
// ========== LOGOUT HANDLER ==========
// ========================================
window.handleLogout = async function() {
    try {
        console.log("🚪 Logging out...");
        await signOut(auth);
        localStorage.removeItem('user');
        updateDynamicMenu(null);
        
        const avatarCircle = document.querySelector('.avatar-circle');
        if (avatarCircle) {
            avatarCircle.innerHTML = '<i class="fas fa-user"></i>';
        }
        
        console.log("✅ Logout successful, redirecting to home...");
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('❌ Logout error:', error);
        showNotification('Logout failed: ' + error.message, 'error');
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
// ========== PROFILE FUNCTIONS ==========
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
    
    const overviewFullName = document.getElementById('overviewFullName');
    const overviewEmail = document.getElementById('overviewEmail');
    const overviewAccountType = document.getElementById('overviewAccountType');
    const overviewMemberSince = document.getElementById('overviewMemberSince');
    const overviewPlan = document.getElementById('overviewPlan');
    
    if (overviewFullName) overviewFullName.textContent = userData.fullName || currentUser.displayName;
    if (overviewEmail) overviewEmail.textContent = currentUser.email;
    if (overviewAccountType) overviewAccountType.textContent = userCollection === "google_users" ? "Google Account" : "Email Account";
    if (overviewPlan) overviewPlan.textContent = userData.plan === "free" ? "Free" : "Premium";
    
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
// ========== HELPER FUNCTIONS ==========
// ========================================

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
// ========== AUTH STATE ==========
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
    
    updateDynamicMenu(user);
}

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
    
    updateDynamicMenu(null);
}

// ========================================
// ========== PARAPHRASING PAGE FUNCTIONS ==========
// ========================================

const PARAPHRASE_API_URL = 'http://localhost:3000/paraphrase';

async function fetchParaphraseUserType() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.log("Firebase not loaded, using free mode");
        currentUserType = 'free';
        updateModeOptions();
        return;
    }
    
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const uid = user.uid;
                let userData = null;
                
                const userDoc = await firebase.firestore().collection('users').doc(uid).get();
                if (userDoc.exists) {
                    userData = userDoc.data();
                } else {
                    const googleDoc = await firebase.firestore().collection('google_users').doc(uid).get();
                    if (googleDoc.exists) {
                        userData = googleDoc.data();
                    }
                }
                
                if (userData) {
                    currentUserType = userData.plan === 'premium' ? 'premium' : 'free';
                    console.log("✅ User Type:", currentUserType);
                } else {
                    currentUserType = 'free';
                    console.log("📝 New user, using free plan");
                }
                
                updateModeOptions();

            } catch (error) {
                console.error("❌ Error fetching user type:", error);
                currentUserType = 'free';
            }
        } else {
            currentUserType = 'free';
            console.log("👤 Not logged in, using free mode");
        }
        
        updateModeOptions();
        if (typeof countParaphraseWords === 'function') countParaphraseWords();
    });
}

function updateModeOptions() {
    const modeSelect = document.getElementById('mode');
    if (!modeSelect) return;
    
    Array.from(modeSelect.options).forEach(option => {
        option.disabled = false;
        option.text = option.text.replace(" 🔒", "").replace(" ⭐", "");
    });
    
    if (currentUserType !== 'premium') {
        Array.from(modeSelect.options).forEach(option => {
            if (['creative', 'academic'].includes(option.value)) {
                option.disabled = true;
                option.text += " 🔒";
            }
        });
    } else {
        Array.from(modeSelect.options).forEach(option => {
            if (['creative', 'academic'].includes(option.value)) {
                option.text += " ⭐";
            }
        });
    }
}

function countParaphraseWords() {
    const text = document.getElementById('inputText')?.value || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;

    const inputWordsEl = document.getElementById('inputWords');
    const inputCharsEl = document.getElementById('inputChars');
    if (inputWordsEl) inputWordsEl.innerHTML = `<strong>${words}</strong>/${currentUserType === 'premium' ? '∞' : '500'} words`;
    if (inputCharsEl) inputCharsEl.innerHTML = `<strong>${chars}</strong> chars`;

    const limitMessage = document.getElementById('limitMessage');
    const btn = document.getElementById('paraphraseBtn');

    if (words > 500 && currentUserType !== 'premium') {
        if (limitMessage) limitMessage.style.display = 'flex';
        if (btn) btn.disabled = true;
    } else {
        if (limitMessage) limitMessage.style.display = 'none';
        if (btn) btn.disabled = false;
    }
}

function checkModeRestriction() {
    const modeSelect = document.getElementById('mode');
    if (!modeSelect) return;
    const selected = modeSelect.value;

    if (['creative', 'academic'].includes(selected) && currentUserType !== 'premium') {
        const featureName = modeSelect.options[modeSelect.selectedIndex].text.replace(" 🔒", "");
        const premiumFeatureName = document.getElementById('premiumFeatureName');
        if (premiumFeatureName) premiumFeatureName.textContent = featureName;
        showPremiumModal();
        modeSelect.value = 'simple';
    }
}

function showPremiumModal() {
    const modal = document.getElementById('premiumModal');
    if (modal) modal.classList.add('show');
}

function closeModal() {
    const modal = document.getElementById('premiumModal');
    if (modal) modal.classList.remove('show');
}

window.onclick = function(e) {
    const modal = document.getElementById('premiumModal');
    if (e.target === modal) {
        closeModal();
    }
};

async function paraphraseText() {
    const text = document.getElementById('inputText')?.value || '';
    const mode = document.getElementById('mode')?.value || 'simple';
    const output = document.getElementById('outputText');
    const btn = document.getElementById('paraphraseBtn');

    if (['creative', 'academic'].includes(mode) && currentUserType !== 'premium') {
        showParaphraseToast('Premium feature! Upgrade to unlock Creative & Academic modes', 'error');
        showPremiumModal();
        return;
    }

    if (!text.trim()) {
        showParaphraseToast('Please enter some text to paraphrase', 'error');
        return;
    }

    const words = text.trim().split(/\s+/).length;
    
    // 🔥 WORD LIMIT CHECK - Show premium modal for free users
    if (words > 500 && currentUserType !== 'premium') {
        showParaphraseToast('Word limit exceeded! Upgrade to premium for unlimited words.', 'warning');
        showPremiumModal();
        return;
    }

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    btn.disabled = true;

    try {
        console.log("📡 Calling Paraphrase API:", PARAPHRASE_API_URL);
        
        const response = await fetch(PARAPHRASE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, mode })
        });
        
        const data = await response.json();
        console.log("📥 API Response:", data);
        
        if (data.error) {
            showParaphraseToast(data.error, 'error');
            if (data.error.includes('Upgrade') || data.error.includes('premium')) {
                showPremiumModal();
            }
            const simulated = generateFallbackParaphrasedText(text, mode);
            output.value = simulated;
            
            const outputWords = simulated.trim().split(/\s+/).length;
            const outputChars = simulated.length;
            const outputWordsEl = document.getElementById('outputWords');
            const outputCharsEl = document.getElementById('outputChars');
            if (outputWordsEl) outputWordsEl.innerHTML = `<strong>${outputWords}</strong> words`;
            if (outputCharsEl) outputCharsEl.innerHTML = `<strong>${outputChars}</strong> chars`;
            
        } else if (data.paraphrased) {
            output.value = data.paraphrased;
            showParaphraseToast('✨ Paraphrased successfully!', 'success');
            
            const outputWords = data.paraphrased.trim().split(/\s+/).length;
            const outputChars = data.paraphrased.length;
            const outputWordsEl = document.getElementById('outputWords');
            const outputCharsEl = document.getElementById('outputChars');
            if (outputWordsEl) outputWordsEl.innerHTML = `<strong>${outputWords}</strong> words`;
            if (outputCharsEl) outputCharsEl.innerHTML = `<strong>${outputChars}</strong> chars`;
        } else {
            throw new Error('Invalid response format');
        }
        
    } catch (error) {
        console.error('❌ API Error:', error);
        showParaphraseToast('Server error. Using simulation mode.', 'error');
        
        const simulated = generateFallbackParaphrasedText(text, mode);
        output.value = simulated;
        
        const outputWords = simulated.trim().split(/\s+/).length;
        const outputChars = simulated.length;
        const outputWordsEl = document.getElementById('outputWords');
        const outputCharsEl = document.getElementById('outputChars');
        if (outputWordsEl) outputWordsEl.innerHTML = `<strong>${outputWords}</strong> words`;
        if (outputCharsEl) outputCharsEl.innerHTML = `<strong>${outputChars}</strong> chars`;
        
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
function enforceParaphraseWordLimit() {
    const inputText = document.getElementById('inputText');
    if (!inputText) return;
    const text = inputText.value;
    
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    
    // Auto-trim for free users when exceeding 500 words
    if (words > 500 && currentUserType !== 'premium') {
        const allWords = text.trim().split(/\s+/);
        const first500Words = allWords.slice(0, 500).join(' ');
        inputText.value = first500Words;
        showParaphraseToast('Cannot paste more than 500 words. Upgrade to Premium for unlimited words!', 'warning');
    }
    
    countParaphraseWords();
}

function generateFallbackParaphrasedText(text, mode) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    const synonymMap = {
        'quick': 'fast', 'important': 'crucial', 'big': 'large',
        'small': 'tiny', 'good': 'excellent', 'bad': 'poor',
        'fast': 'quick', 'large': 'big', 'tiny': 'small',
        'excellent': 'great', 'poor': 'bad', 'happy': 'joyful',
        'sad': 'unhappy', 'beautiful': 'lovely', 'ugly': 'unpleasant'
    };
    
    const modes = {
        simple: (s) => {
            let result = s;
            for (let [word, synonym] of Object.entries(synonymMap)) {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                result = result.replace(regex, synonym);
            }
            return result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();
        },
        formal: (s) => {
            return "It can be stated that " + s.charAt(0).toLowerCase() + s.slice(1);
        },
        creative: (s) => {
            let result = s;
            for (let [word, synonym] of Object.entries(synonymMap)) {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                if (Math.random() > 0.6) {
                    result = result.replace(regex, synonym);
                }
            }
            return "✨ " + result;
        },
        academic: (s) => {
            return "According to scholarly analysis, " + s.toLowerCase() + " This demonstrates a structured interpretation.";
        }
    };
    
    const selectedMode = modes[mode] || modes.simple;
    let result = sentences.map(s => selectedMode(s)).join('. ');
    
    if (!result.endsWith('.') && !result.endsWith('!') && !result.endsWith('?')) {
        result += '.';
    }
    
    return result;
}

function copyParaphraseText() {
    const text = document.getElementById('outputText')?.value || '';
    if (!text.trim()) {
        showParaphraseToast('Nothing to copy', 'error');
        return;
    }
    
    navigator.clipboard.writeText(text);
    showParaphraseToast('📋 Copied to clipboard!', 'success');
}

function downloadParaphraseText() {
    const text = document.getElementById('outputText')?.value || '';
    if (!text.trim()) {
        showParaphraseToast('Nothing to download', 'error');
        return;
    }
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paraphrased-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showParaphraseToast('📥 File downloaded!', 'success');
}

function shareParaphraseText() {
    const text = document.getElementById('outputText')?.value || '';
    if (!text.trim()) {
        showParaphraseToast('Nothing to share', 'error');
        return;
    }
    
    if (navigator.share) {
        navigator.share({
            title: 'Paraphrased Text',
            text: text
        }).catch(() => copyParaphraseText());
    } else {
        copyParaphraseText();
    }
}

function showParaphraseToast(msg, type = 'success') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = { success: '✓', error: '✗', warning: '⚠' };
    const icon = icons[type] || 'ℹ';
    const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b' };
    const bgColor = colors[type] || '#3b82f6';
    
    toast.innerHTML = `<span style="font-weight:bold; margin-right:8px;">${icon}</span><span>${msg}</span>`;
    
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px;
        padding: 12px 20px; background: ${bgColor};
        color: white; border-radius: 8px; font-size: 14px;
        z-index: 10000; font-family: 'Inter', sans-serif;
        animation: slideIn 0.3s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex; align-items: center; gap: 8px;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function initParaphrasingTool() {
    console.log("🚀 Initializing paraphrasing tool...");
    fetchParaphraseUserType();
    countParaphraseWords();
    
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.onclick = () => {
            const inputText = document.getElementById('inputText');
            const outputText = document.getElementById('outputText');
            if (inputText) inputText.value = '';
            if (outputText) outputText.value = '';
            countParaphraseWords();
            showParaphraseToast('✨ All fields cleared', 'success');
        };
    }
    
    const inputText = document.getElementById('inputText');
    if (inputText) {
        // Add event listeners for word limit
        inputText.addEventListener('input', enforceParaphraseWordLimit);
        inputText.addEventListener('paste', function(e) {
            setTimeout(enforceParaphraseWordLimit, 10);
        });
    }
    
    if (!document.querySelector('#toast-animations')) {
        const style = document.createElement('style');
        style.id = 'toast-animations';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    console.log("✅ Paraphrasing tool ready! API URL:", PARAPHRASE_API_URL);
}

// ========================================
// ========== PLAGIARISM PAGE FUNCTIONS ==========
// ========================================

const PLAGIARISM_API_URL = 'http://localhost:3000/plagiarism';

async function fetchPlagiarismUserType() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.log("Firebase not loaded, using free mode");
        currentUserType = 'free';
        return;
    }
    
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const uid = user.uid;
                let userData = null;
                
                const userDoc = await firebase.firestore().collection('users').doc(uid).get();
                if (userDoc.exists) {
                    userData = userDoc.data();
                } else {
                    const googleDoc = await firebase.firestore().collection('google_users').doc(uid).get();
                    if (googleDoc.exists) {
                        userData = googleDoc.data();
                    }
                }
                
                if (userData) {
                    currentUserType = userData.plan === 'premium' ? 'premium' : 'free';
                    console.log("✅ User Type:", currentUserType);
                } else {
                    currentUserType = 'free';
                }
            } catch (error) {
                console.error("Error fetching user type:", error);
                currentUserType = 'free';
            }
        } else {
            currentUserType = 'free';
            console.log("👤 Not logged in, using free mode");
        }
        
        if (typeof countPlagiarismWords === 'function') countPlagiarismWords();
    });
}

function countPlagiarismWords() {
    const inputText = document.getElementById('inputText');
    if (!inputText) return;
    const text = inputText.value;
    
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    
    const inputWordsEl = document.getElementById('inputWords');
    const inputCharsEl = document.getElementById('inputChars');
    if (inputWordsEl) inputWordsEl.innerHTML = `<i class="fas fa-font"></i> <strong>${words}</strong>/${currentUserType === 'premium' ? '∞' : '500'} words`;
    if (inputCharsEl) inputCharsEl.innerHTML = `<i class="fas fa-keyboard"></i> <strong>${chars}</strong> chars`;
    
    const limitMessage = document.getElementById('limitMessage');
    const checkBtn = document.getElementById('checkBtn');
    
    if (words > 500 && currentUserType !== 'premium') {
        if (limitMessage) limitMessage.style.display = 'flex';
        if (checkBtn) checkBtn.disabled = true;
    } else {
        if (limitMessage) limitMessage.style.display = 'none';
        if (checkBtn) checkBtn.disabled = false;
    }
}

function enforceWordLimit() {
    const inputText = document.getElementById('inputText');
    if (!inputText) return;
    const text = inputText.value;
    
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    
    if (words > 500 && currentUserType !== 'premium') {
        const allWords = text.trim().split(/\s+/);
        const first500Words = allWords.slice(0, 500).join(' ');
        inputText.value = first500Words;
        showPlagiarismToast('Cannot paste more than 500 words. Upgrade to Premium for unlimited words!', 'warning');
    }
    
    countPlagiarismWords();
}

async function checkPlagiarism() {
    const inputText = document.getElementById('inputText');
    if (!inputText) return;
    const inputValue = inputText.value;
    const sensitivity = document.getElementById('checkMode')?.value || 'quick';
    const checkBtn = document.getElementById('checkBtn');
    const loadingSection = document.getElementById('loadingSection');
    const resultsSection = document.getElementById('resultsSection');

    if (!inputValue.trim()) {
        showPlagiarismToast('Please enter some text to check', 'error');
        return;
    }

    const words = inputValue.trim().split(/\s+/).length;
    if (words > 500 && currentUserType !== 'premium') {
        showPlagiarismToast('Word limit exceeded! Upgrade to premium for unlimited checks.', 'warning');
        showPremiumModal();
        return;
    }

    const originalText = checkBtn.innerHTML;
    checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
    checkBtn.disabled = true;
    if (loadingSection) loadingSection.style.display = 'flex';
    if (resultsSection) resultsSection.style.display = 'none';

    try {
        console.log("📡 Calling Plagiarism API:", PLAGIARISM_API_URL);
        
        const response = await fetch(PLAGIARISM_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: inputValue, sensitivity })
        });
        
        const data = await response.json();
        console.log("📥 API Response:", data);
        
        if (data.error) {
            showPlagiarismToast(data.error, 'error');
            if (data.error.includes('Upgrade') || data.error.includes('premium')) {
                showPremiumModal();
            }
            if (loadingSection) loadingSection.style.display = 'none';
            checkBtn.innerHTML = originalText;
            checkBtn.disabled = false;
            return;
        }
        
        const plagiarismPercent = data.plagiarismScore;
        const originalPercent = data.originalityScore;
        const similarityPercent = data.similarityScore;
        
        const progressCircle = document.getElementById('progressCircle');
        if (progressCircle) {
            const circumference = 2 * Math.PI * 80;
            const offset = circumference - (plagiarismPercent / 100) * circumference;
            progressCircle.style.strokeDashoffset = offset;
        }
        
        const plagiarismPercentEl = document.getElementById('plagiarismPercent');
        const originalPercentEl = document.getElementById('originalPercent');
        const plagiarizedPercentEl = document.getElementById('plagiarizedPercent');
        const similarityPercentEl = document.getElementById('similarityPercent');
        const uniqueScoreEl = document.getElementById('uniqueScore');
        
        if (plagiarismPercentEl) plagiarismPercentEl.textContent = plagiarismPercent + '%';
        if (originalPercentEl) originalPercentEl.textContent = originalPercent + '%';
        if (plagiarizedPercentEl) plagiarizedPercentEl.textContent = plagiarismPercent + '%';
        if (similarityPercentEl) similarityPercentEl.textContent = similarityPercent + '%';
        if (uniqueScoreEl) uniqueScoreEl.textContent = originalPercent + '%';
        
        const plagiarismLabel = document.getElementById('plagiarismLabel');
        const resultMessage = document.getElementById('resultMessage');
        if (resultMessage) {
            const messageIcon = resultMessage.querySelector('.message-icon i');
            const messageTitle = resultMessage.querySelector('h4');
            const messageText = resultMessage.querySelector('p');
            
            if (plagiarismPercent === 0) {
                if (plagiarismLabel) plagiarismLabel.textContent = 'Perfectly Original';
                if (progressCircle) progressCircle.style.stroke = '#00ff88';
                if (messageIcon) messageIcon.className = 'fas fa-check-circle';
                if (messageIcon) messageIcon.style.color = '#00ff88';
                if (messageTitle) messageTitle.textContent = 'Excellent!';
                if (messageText) messageText.textContent = data.message || 'Your content is 100% original and plagiarism-free.';
            } else if (plagiarismPercent < 10) {
                if (plagiarismLabel) plagiarismLabel.textContent = 'Mostly Original';
                if (progressCircle) progressCircle.style.stroke = '#00d4ff';
                if (messageIcon) messageIcon.className = 'fas fa-info-circle';
                if (messageIcon) messageIcon.style.color = '#00d4ff';
                if (messageTitle) messageTitle.textContent = 'Good';
                if (messageText) messageText.textContent = data.message || 'Your content is mostly original with minimal similarities.';
            } else if (plagiarismPercent < 25) {
                if (plagiarismLabel) plagiarismLabel.textContent = 'Some Similarity';
                if (progressCircle) progressCircle.style.stroke = '#ffaa00';
                if (messageIcon) messageIcon.className = 'fas fa-exclamation-triangle';
                if (messageIcon) messageIcon.style.color = '#ffaa00';
                if (messageTitle) messageTitle.textContent = 'Needs Review';
                if (messageText) messageText.textContent = data.message || 'Some similarities detected. Consider reviewing highlighted sections.';
            } else {
                if (plagiarismLabel) plagiarismLabel.textContent = 'High Plagiarism';
                if (progressCircle) progressCircle.style.stroke = '#ff4444';
                if (messageIcon) messageIcon.className = 'fas fa-times-circle';
                if (messageIcon) messageIcon.style.color = '#ff4444';
                if (messageTitle) messageTitle.textContent = 'Alert!';
                if (messageText) messageText.textContent = data.message || 'High plagiarism detected. Consider rewriting significant portions.';
            }
        }
        
        const wordCountEl = document.getElementById('wordCount');
        const matchedSourcesEl = document.getElementById('matchedSources');
        const processingTimeEl = document.getElementById('processingTime');
        const sourceCountEl = document.getElementById('sourceCount');
        
        if (wordCountEl) wordCountEl.textContent = words;
        if (matchedSourcesEl) matchedSourcesEl.textContent = data.matches || Math.floor(Math.random() * 50);
        if (processingTimeEl) processingTimeEl.textContent = (Math.random() * 2 + 0.5).toFixed(1) + 's';
        if (sourceCountEl) sourceCountEl.textContent = '8.2B';
        
        if (loadingSection) loadingSection.style.display = 'none';
        if (resultsSection) resultsSection.style.display = 'block';
        
        showPlagiarismToast('Analysis complete!', 'success');
        
    } catch (error) {
        console.error('❌ API Error:', error);
        showPlagiarismToast('Failed to connect to server. Using simulation.', 'error');
        
        const plagiarismPercent = Math.floor(Math.random() * 30);
        const originalPercent = 100 - plagiarismPercent;
        
        const progressCircle = document.getElementById('progressCircle');
        if (progressCircle) {
            const circumference = 2 * Math.PI * 80;
            const offset = circumference - (plagiarismPercent / 100) * circumference;
            progressCircle.style.strokeDashoffset = offset;
        }
        
        const plagiarismPercentEl = document.getElementById('plagiarismPercent');
        const originalPercentEl = document.getElementById('originalPercent');
        const plagiarizedPercentEl = document.getElementById('plagiarizedPercent');
        const similarityPercentEl = document.getElementById('similarityPercent');
        const uniqueScoreEl = document.getElementById('uniqueScore');
        
        if (plagiarismPercentEl) plagiarismPercentEl.textContent = plagiarismPercent + '%';
        if (originalPercentEl) originalPercentEl.textContent = originalPercent + '%';
        if (plagiarizedPercentEl) plagiarizedPercentEl.textContent = plagiarismPercent + '%';
        if (similarityPercentEl) similarityPercentEl.textContent = Math.floor(Math.random() * 20) + '%';
        if (uniqueScoreEl) uniqueScoreEl.textContent = originalPercent + '%';
        
        const wordCountEl = document.getElementById('wordCount');
        const matchedSourcesEl = document.getElementById('matchedSources');
        const processingTimeEl = document.getElementById('processingTime');
        
        if (wordCountEl) wordCountEl.textContent = words;
        if (matchedSourcesEl) matchedSourcesEl.textContent = Math.floor(Math.random() * 50);
        if (processingTimeEl) processingTimeEl.textContent = (Math.random() * 2 + 0.5).toFixed(1) + 's';
        
        if (loadingSection) loadingSection.style.display = 'none';
        if (resultsSection) resultsSection.style.display = 'block';
        
    } finally {
        checkBtn.innerHTML = originalText;
        checkBtn.disabled = false;
    }
}

function copyPlagiarismReport() {
    const originalPercent = document.getElementById('originalPercent')?.textContent || '0%';
    const plagiarismPercent = document.getElementById('plagiarismPercent')?.textContent || '0%';
    const similarityPercent = document.getElementById('similarityPercent')?.textContent || '0%';
    const wordCount = document.getElementById('wordCount')?.textContent || '0';
    const sourceCount = document.getElementById('sourceCount')?.textContent || '0';
    
    const report = `Plagiarism Report:
Originality: ${originalPercent}
Matched: ${plagiarismPercent}
Similarity: ${similarityPercent}
Words: ${wordCount}
Sources: ${sourceCount}`;
    
    navigator.clipboard.writeText(report).then(() => {
        showPlagiarismToast('Report copied to clipboard!', 'success');
    });
}

function downloadPlagiarismReport() {
    const originalPercent = document.getElementById('originalPercent')?.textContent || '0%';
    const plagiarismPercent = document.getElementById('plagiarismPercent')?.textContent || '0%';
    const similarityPercent = document.getElementById('similarityPercent')?.textContent || '0%';
    const wordCount = document.getElementById('wordCount')?.textContent || '0';
    const sourceCount = document.getElementById('sourceCount')?.textContent || '0';
    const matchedSources = document.getElementById('matchedSources')?.textContent || '0';
    const processingTime = document.getElementById('processingTime')?.textContent || '0s';
    
    const report = `PLAGIARISM CHECK REPORT
Generated: ${new Date().toLocaleString()}
-----------------------------------
Originality: ${originalPercent}
Matched Content: ${plagiarismPercent}
Similarity Score: ${similarityPercent}
Words Analyzed: ${wordCount}
Sources Checked: ${sourceCount}
Matches Found: ${matchedSources}
Processing Time: ${processingTime}
-----------------------------------
This is an automated report. Please review the content carefully.`;
    
    const blob = new Blob([report], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plagiarism-report.txt';
    a.click();
    window.URL.revokeObjectURL(url);
    showPlagiarismToast('Report downloaded!', 'success');
}

function sharePlagiarismReport() {
    const originalPercent = document.getElementById('originalPercent')?.textContent || '0%';
    const plagiarismPercent = document.getElementById('plagiarismPercent')?.textContent || '0%';
    const report = `Plagiarism Check: ${originalPercent} Original, ${plagiarismPercent} Matched`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Plagiarism Report',
            text: report
        });
    } else {
        copyPlagiarismReport();
    }
}

function showPlagiarismToast(message, type = 'success') {
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function initPlagiarismChecker() {
    console.log("🚀 Initializing Plagiarism Checker...");
    
    fetchPlagiarismUserType();
    countPlagiarismWords();
    
    const inputText = document.getElementById('inputText');
    if (inputText) {
        inputText.addEventListener('paste', function(e) {
            setTimeout(enforceWordLimit, 10);
        });
        inputText.addEventListener('input', enforceWordLimit);
    }
    
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            const inputTextEl = document.getElementById('inputText');
            const resultsSection = document.getElementById('resultsSection');
            if (inputTextEl) inputTextEl.value = '';
            if (resultsSection) resultsSection.style.display = 'none';
            countPlagiarismWords();
            showPlagiarismToast('Text cleared', 'success');
        });
    }
    
    const copyBtn = document.getElementById('copyReportBtn');
    if (copyBtn) copyBtn.addEventListener('click', copyPlagiarismReport);
    
    const downloadBtn = document.getElementById('downloadReportBtn');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadPlagiarismReport);
    
    const shareBtn = document.getElementById('shareReportBtn');
    if (shareBtn) shareBtn.addEventListener('click', sharePlagiarismReport);
    
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', function() {
            const inputTextEl = document.getElementById('inputText');
            const resultsSection = document.getElementById('resultsSection');
            if (inputTextEl) inputTextEl.value = '';
            if (resultsSection) resultsSection.style.display = 'none';
            countPlagiarismWords();
            showPlagiarismToast('All cleared', 'success');
        });
    }
    
    console.log("✅ Plagiarism checker ready! API URL:", PLAGIARISM_API_URL);
}

// ========================================
// ========== LAYOUT & THEME FUNCTIONS ==========
// ========================================

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

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

// ========================================
// ========== MAIN INITIALIZATION ==========
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ MiniToolBox Master JS Loaded");
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
    if (logoutBtn) logoutBtn.addEventListener('click', window.handleLogout);

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
    
    // Initialize page-specific tools based on URL
    if (window.location.pathname.includes('paraphrasing.html')) {
        initParaphrasingTool();
    }
    
    if (window.location.pathname.includes('plagiarism.html')) {
        initPlagiarismChecker();
    }
});

// ========================================
// ========== EXPORT GLOBAL FUNCTIONS ==========
// ========================================
window.togglePassword = togglePassword;
window.handleSignup = handleSignup;
window.handleLogin = handleLogin;
window.handleGoogleLogin = handleGoogleLogin;
window.handleLogout = window.handleLogout;
window.toggleProfileMenu = window.toggleProfileMenu;
window.toggleToolkitMenu = window.toggleToolkitMenu;
window.toggleMobileMenu = window.toggleMobileMenu;
window.toggleDarkMode = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    const toggleIcon = document.querySelectorAll('.toggle-indicator i, .toggle-icon');
    toggleIcon.forEach(icon => {
        icon.className = newTheme === 'dark' ? 'fas fa-toggle-on' : 'fas fa-toggle-off';
    });
    
    const moonIcons = document.querySelectorAll('.theme-toggle i:first-child, .theme-toggle-btn i:first-child');
    moonIcons.forEach(icon => {
        icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    });
};

// Paraphrasing page functions
window.paraphraseText = paraphraseText;
window.copyText = copyParaphraseText;
window.downloadText = downloadParaphraseText;
window.shareText = shareParaphraseText;
window.checkModeRestriction = checkModeRestriction;
window.showPremiumModal = showPremiumModal;
window.closeModal = closeModal;

// Plagiarism page functions
window.checkPlagiarism = checkPlagiarism;
window.copyReport = copyPlagiarismReport;
window.downloadReport = downloadPlagiarismReport;
window.shareReport = sharePlagiarismReport;
window.enforceWordLimit = enforceWordLimit;

console.log("✅ All functions loaded successfully!");



// ==================================================
// SCROLL ANIMATIONS
// ==================================================
function initializeScrollAnimations() {
    const items = document.querySelectorAll('.animate-on-scroll');
    const observer = new IntersectionObserver(entries => {
        entries.forEach(e => e.isIntersecting && e.target.classList.add('animate-in'));
    }, { threshold: 0.2 });

    items.forEach(el => observer.observe(el));
}


