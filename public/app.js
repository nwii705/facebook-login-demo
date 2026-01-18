// ============================================
// AUTH STATE CHECK
// ============================================
document.addEventListener('DOMContentLoaded', checkAuth);

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
// LOGIN HANDLER
// ============================================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');
  
  errorDiv.style.display = 'none';
  
  // Add loading state
  const loginBtn = e.target.querySelector('.btn-login');
  const originalText = loginBtn.textContent;
  loginBtn.textContent = 'Logging in...';
  loginBtn.disabled = true;
  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showDashboard(data.user);
    } else {
      errorDiv.textContent = data.error;
      errorDiv.style.display = 'block';
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
