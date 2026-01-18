// ============================================
// AUTH STATE CHECK & INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await initializeBiometric();
  await loadSavedCredentials();
});

// Check if user is already logged in
async function checkAuth() {
  try {
    const response = await fetch('/api/me');
    const data = await response.json();

    if (data.loggedIn) {
      showDashboard(data.user);
    }
  } catch (error) {
    console.error('Auth check error:', error);
  }
}

// ============================================
// BIOMETRIC AUTHENTICATION (WebAuthn)
// ============================================

// Check if biometric authentication is available
async function initializeBiometric() {
  const biometricBtn = document.getElementById('biometric-btn');

  if (!window.PublicKeyCredential || !navigator.credentials) {
    biometricBtn.style.display = 'none';
    return;
  }

  try {
    // Check if user has registered biometric
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) {
      biometricBtn.style.display = 'none';
      return;
    }

    biometricBtn.style.display = 'flex';
  } catch (error) {
    console.error('Biometric check error:', error);
    biometricBtn.style.display = 'none';
  }
}

// Handle biometric login
async function biometricLogin() {
  const biometricBtn = document.getElementById('biometric-btn');
  const originalText = biometricBtn.innerHTML;

  biometricBtn.innerHTML = '<span class="spinner"></span> Authenticating...';
  biometricBtn.disabled = true;

  try {
    // Create credential request
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credentialRequestOptions = {
      challenge: challenge,
      allowCredentials: [], // Empty means any credential
      userVerification: 'required',
      timeout: 60000
    };

    const credential = await navigator.credentials.get({
      publicKey: credentialRequestOptions
    });

    if (credential) {
      // Biometric authentication successful
      // For demo purposes, we'll simulate a successful login
      const demoUser = {
        id: Date.now(),
        username: 'biometric_user',
        email: 'biometric@example.com'
      };

      await performLogin('biometric@example.com', 'biometric_auth', demoUser);
    }
  } catch (error) {
    console.error('Biometric authentication error:', error);

    if (error.name === 'NotAllowedError') {
      showError('Biometric authentication was cancelled');
    } else if (error.name === 'SecurityError') {
      showError('Biometric authentication is not available');
    } else {
      showError('Biometric authentication failed. Please try again.');
    }
  } finally {
    biometricBtn.innerHTML = originalText;
    biometricBtn.disabled = false;
  }
}

// ============================================
// CREDENTIAL MANAGEMENT API
// ============================================

// Load saved credentials for auto-fill
async function loadSavedCredentials() {
  if (!navigator.credentials || !window.PasswordCredential) {
    return;
  }

  try {
    const credentials = await navigator.credentials.get({
      password: true,
      mediation: 'optional'
    });

    if (credentials) {
      document.getElementById('login-username').value = credentials.id;
      document.getElementById('login-password').value = credentials.password;
    }
  } catch (error) {
    console.error('Credential loading error:', error);
  }
}

// Save credentials after successful login
async function saveCredentials(username, password) {
  if (!navigator.credentials || !window.PasswordCredential) {
    return;
  }

  try {
    const credential = new PasswordCredential({
      id: username,
      password: password,
      name: username
    });

    await navigator.credentials.store(credential);
  } catch (error) {
    console.error('Credential saving error:', error);
  }
}

// ============================================
// SOCIAL LOGIN SIMULATION
// ============================================

async function socialLogin(provider) {
  const btn = event.target;
  const originalText = btn.innerHTML;

  btn.innerHTML = `<span class="spinner"></span> Connecting to ${provider}...`;
  btn.disabled = true;

  try {
    // Simulate social login delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // For demo purposes, create a social login user
    const socialUser = {
      id: Date.now(),
      username: `${provider}_user_${Date.now()}`,
      email: `${provider}@example.com`
    };

    await performLogin(socialUser.username, 'social_auth', socialUser);
  } catch (error) {
    console.error('Social login error:', error);
    showError(`Failed to connect to ${provider}`);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// ============================================
// LOGIN HANDLER
// ============================================

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const rememberMe = document.getElementById('remember-me').checked;

  if (!username || !password) {
    showError('Please enter both username and password');
    return;
  }

  await performLogin(username, password, null, rememberMe);
});

async function performLogin(username, password, userData = null, rememberMe = false) {
  const loginBtn = document.querySelector('.btn-login');
  const btnText = loginBtn.querySelector('.btn-text');
  const btnLoading = loginBtn.querySelector('.btn-loading');

  // Show loading state
  btnText.style.display = 'none';
  btnLoading.style.display = 'flex';
  loginBtn.disabled = true;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.success) {
      // Save credentials if remember me is checked
      if (rememberMe) {
        await saveCredentials(username, password);
      }

      showDashboard(userData || data.user);
    } else {
      showError(data.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('Network error. Please try again.');
  } finally {
    // Hide loading state
    btnText.style.display = 'flex';
    btnLoading.style.display = 'none';
    loginBtn.disabled = false;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showError(message) {
  const errorDiv = document.getElementById('login-error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';

  // Auto hide after 5 seconds
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

function togglePassword(fieldId) {
  const field = document.getElementById(fieldId);
  const eyeIcon = field.parentElement.querySelector('.eye-icon');

  if (field.type === 'password') {
    field.type = 'text';
    eyeIcon.textContent = '🙈';
  } else {
    field.type = 'password';
    eyeIcon.textContent = '👁️';
  }
}

function clearField(fieldId) {
  document.getElementById(fieldId).value = '';
}

// ============================================
// MODAL MANAGEMENT
// ============================================

function showRegister() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-modal').style.display = 'flex';
  document.getElementById('forgot-modal').style.display = 'none';
}

function showLogin() {
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('register-modal').style.display = 'none';
  document.getElementById('forgot-modal').style.display = 'none';
}

function showForgotPassword() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-modal').style.display = 'none';
  document.getElementById('forgot-modal').style.display = 'flex';
}

// ============================================
// REGISTER HANDLER
// ============================================

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const firstname = document.getElementById('reg-firstname').value;
  const lastname = document.getElementById('reg-lastname').value;
  const username = document.getElementById('reg-username').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;

  const errorDiv = document.getElementById('register-error');
  const successDiv = document.getElementById('register-success');

  errorDiv.style.display = 'none';
  successDiv.style.display = 'none';

  // Validation
  if (!firstname || !lastname || !username || !email || !password) {
    errorDiv.textContent = 'Please fill in all fields';
    errorDiv.style.display = 'block';
    return;
  }

  if (password !== confirm) {
    errorDiv.textContent = 'Passwords do not match';
    errorDiv.style.display = 'block';
    return;
  }

  if (password.length < 6) {
    errorDiv.textContent = 'Password must be at least 6 characters';
    errorDiv.style.display = 'block';
    return;
  }

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username,
        email: email,
        password: password
      })
    });

    const data = await response.json();

    if (data.success) {
      successDiv.textContent = 'Account created successfully! You can now log in.';
      successDiv.style.display = 'block';

      // Clear form
      e.target.reset();

      // Auto switch to login after 2 seconds
      setTimeout(() => {
        showLogin();
      }, 2000);
    } else {
      errorDiv.textContent = data.error;
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    console.error('Register error:', error);
    errorDiv.textContent = 'Network error. Please try again.';
    errorDiv.style.display = 'block';
  }
});

// ============================================
// FORGOT PASSWORD HANDLER
// ============================================

document.getElementById('forgotForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('forgot-email').value;
  const errorDiv = document.getElementById('forgot-error');
  const successDiv = document.getElementById('forgot-success');

  errorDiv.style.display = 'none';
  successDiv.style.display = 'none';

  if (!email) {
    errorDiv.textContent = 'Please enter your email address';
    errorDiv.style.display = 'block';
    return;
  }

  try {
    // For demo purposes, we'll simulate a successful password reset
    successDiv.textContent = 'If an account with that email exists, we have sent you a password reset link.';
    successDiv.style.display = 'block';

    // Clear form
    e.target.reset();

    // Auto close modal after 3 seconds
    setTimeout(() => {
      showLogin();
    }, 3000);
  } catch (error) {
    console.error('Forgot password error:', error);
    errorDiv.textContent = 'Network error. Please try again.';
    errorDiv.style.display = 'block';
  }
});

// ============================================
// DASHBOARD MANAGEMENT
// ============================================

function showDashboard(user) {
  // Hide login/register
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-modal').style.display = 'none';
  document.getElementById('forgot-modal').style.display = 'none';

  // Show dashboard
  document.getElementById('dashboard').style.display = 'block';

  // Update user info
  document.getElementById('user-name').textContent = user.username || 'User';
  document.getElementById('user-name-header').textContent = user.username || 'User';
  document.getElementById('user-email').textContent = user.email || 'N/A';
  document.getElementById('user-created').textContent = new Date(user.created_at || Date.now()).toLocaleDateString();

  // Add logged-in class to body
  document.body.classList.add('logged-in');
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch (error) {
    console.error('Logout error:', error);
  }

  // Hide dashboard
  document.getElementById('dashboard').style.display = 'none';

  // Show login
  document.getElementById('login-form').style.display = 'block';

  // Remove logged-in class
  document.body.classList.remove('logged-in');

  // Clear forms
  document.getElementById('loginForm').reset();
  document.getElementById('registerForm').reset();
  document.getElementById('forgotForm').reset();
}
    }
  } catch (error) {
    errorDiv.textContent = 'Connection error. Please try again.';
    errorDiv.style.display = 'block';
  } finally {
    loginBtn.textContent = originalText;
    loginBtn.disabled = false;
  }
});

// ============================================
// REGISTER HANDLER
// ============================================
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const firstname = document.getElementById('reg-firstname').value;
  const lastname = document.getElementById('reg-lastname').value;
  const username = document.getElementById('reg-username').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;
  const errorDiv = document.getElementById('register-error');
  const successDiv = document.getElementById('register-success');
  
  errorDiv.style.display = 'none';
  successDiv.style.display = 'none';
  
  // Validation
  if (password !== confirm) {
    errorDiv.textContent = 'Passwords do not match.';
    errorDiv.style.display = 'block';
    return;
  }
  
  if (password.length < 6) {
    errorDiv.textContent = 'Password must be at least 6 characters.';
    errorDiv.style.display = 'block';
    return;
  }
  
  // Add loading state
  const signupBtn = e.target.querySelector('.btn-signup');
  const originalText = signupBtn.textContent;
  signupBtn.textContent = 'Signing up...';
  signupBtn.disabled = true;
  
  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username, 
        email, 
        password,
        fullname: `${firstname} ${lastname}`
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      successDiv.textContent = 'Account created successfully! Redirecting to login...';
      successDiv.style.display = 'block';
      
      setTimeout(() => {
        showLogin();
        document.getElementById('login-username').value = email;
      }, 1500);
    } else {
      errorDiv.textContent = data.error;
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    errorDiv.textContent = 'Connection error. Please try again.';
    errorDiv.style.display = 'block';
  } finally {
    signupBtn.textContent = originalText;
    signupBtn.disabled = false;
  }
});

// ============================================
// VIEW NAVIGATION
// ============================================
function showRegister() {
  document.getElementById('register-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  
  // Reset form
  document.getElementById('registerForm').reset();
  document.getElementById('register-error').style.display = 'none';
  document.getElementById('register-success').style.display = 'none';
  
  // Focus first input
  setTimeout(() => {
    document.getElementById('reg-firstname').focus();
  }, 100);
}

function showLogin() {
  document.getElementById('register-modal').style.display = 'none';
  document.body.style.overflow = '';
  
  // Reset login form
  document.getElementById('loginForm').reset();
  document.getElementById('login-error').style.display = 'none';
}

function showDashboard(user) {
  document.body.classList.add('logged-in');
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-modal').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('main-footer').style.display = 'none';
  document.querySelector('.main-container').style.display = 'none';
  
  // Populate user info
  document.getElementById('user-name').textContent = user.username;
  document.getElementById('user-name-header').textContent = user.username;
  document.getElementById('user-email').textContent = user.email;
  
  const createdDate = new Date(user.created_at);
  document.getElementById('user-created').textContent = createdDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// ============================================
// LOGOUT HANDLER
// ============================================
async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    
    // Reset UI
    document.body.classList.remove('logged-in');
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('main-footer').style.display = 'block';
    document.querySelector('.main-container').style.display = 'flex';
    
    // Reset form
    document.getElementById('loginForm').reset();
    document.getElementById('login-error').style.display = 'none';
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
document.addEventListener('keydown', (e) => {
  // Close modal with Escape key
  if (e.key === 'Escape') {
    const modal = document.getElementById('register-modal');
    if (modal.style.display === 'flex') {
      showLogin();
    }
  }
});
