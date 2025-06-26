/**
 * DigiLocker Authentication Module
 * Handles both Same-Device and QR Code authentication flows
 */

// DOM Elements
let sameDeviceTab, qrCodeTab;
let sameDeviceContent, qrCodeContent;
let qrContainer, qrStatus;
let loginBtn, generateQRBtn;

// Global variables
let pollingInterval = null;
const QR_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Initialize the authentication module
 */
function initAuth() {
  // Get DOM elements
  sameDeviceTab = document.getElementById('tab-device');
  qrCodeTab = document.getElementById('tab-qr');
  sameDeviceContent = document.getElementById('content-device');
  qrCodeContent = document.getElementById('content-qr');
  qrContainer = document.getElementById('qr-container');
  qrStatus = document.getElementById('qr-status');
  loginBtn = document.getElementById('login-btn');
  generateQRBtn = document.getElementById('generate-qr-btn');
  
  // Add event listeners
  if (sameDeviceTab) sameDeviceTab.addEventListener('click', () => switchTab('device'));
  if (qrCodeTab) qrCodeTab.addEventListener('click', () => switchTab('qr'));
  if (generateQRBtn) generateQRBtn.addEventListener('click', generateQRCode);
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);
  
  // Initialize based on URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('tab') && urlParams.get('tab') === 'qr') {
    switchTab('qr');
  }
  
  console.log('Auth module initialized');
}

/**
 * Switch between auth tabs
 */
function switchTab(id) {
  // Update tab classes
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.getElementById(`tab-${id}`).classList.add('active');
  
  // Update content visibility
  document.querySelectorAll('.auth-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`content-${id}`).classList.add('active');
  
  console.log(`Switched to ${id} tab`);
  
  // Clear polling if switching away from QR tab
  if (id !== 'qr' && pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/**
 * Handle DigiLocker login button click
 */
function handleLogin(event) {
  if (event) event.preventDefault();
  
  const callbackUrl = window.location.origin + '/auth/callback-page';
  const loginUrl = `${window.location.origin}/auth/login?frontend_callback=${encodeURIComponent(callbackUrl)}`;
  
  console.log('Redirecting to:', loginUrl);
  window.location.href = loginUrl;
}

/**
 * Generate QR code for cross-device authentication
 */
function generateQRCode() {
  if (!qrContainer || !qrStatus) return;
  
  qrStatus.textContent = 'Generating QR code...';
  
  fetch('/auth/qr-session')
    .then(response => response.json())
    .then(data => {
      console.log('QR session created:', data);
      
      // Display QR placeholder
      qrContainer.innerHTML = `
        <div style="text-align: center">
          <div style="font-size: 40px; margin-bottom: 10px;">📱</div>
          <div>Scan with DigiLocker App</div>
          <div style="font-size: 12px; margin-top: 10px;">Session: ${data.sessionId.substr(0, 6)}...</div>
        </div>
      `;
      
      qrStatus.textContent = 'QR code ready. Scan with the DigiLocker app.';
      
      // Poll for status
      pollQRStatus(data.sessionId, data.pollingUrl);
    })
    .catch(error => {
      console.error('Error generating QR code:', error);
      qrStatus.textContent = 'Error generating QR code. Please try again.';
    });
}

/**
 * Poll for QR authentication status
 */
function pollQRStatus(sessionId, pollingUrl) {
  // Set an expiry timeout
  const expiryTimeout = setTimeout(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      
      if (qrStatus) {
        qrStatus.textContent = 'QR code expired. Please generate a new one.';
      }
    }
  }, QR_EXPIRY_TIME);
  
  // Poll every 3 seconds
  pollingInterval = setInterval(() => {
    fetch(pollingUrl)
      .then(response => response.json())
      .then(data => {
        console.log('QR status update:', data);
        
        if (data.status === 'completed') {
          // Clear interval and timeout
          clearInterval(pollingInterval);
          clearTimeout(expiryTimeout);
          pollingInterval = null;
          
          // Update status
          if (qrStatus) {
            qrStatus.textContent = 'Authentication successful! Redirecting...';
          }
          
          // Redirect to the specified URL or dashboard
          setTimeout(() => {
            window.location.href = data.redirectUrl || '/auth/files-dashboard';
          }, 2000);
        } else if (data.status === 'expired') {
          // Clear interval and timeout
          clearInterval(pollingInterval);
          clearTimeout(expiryTimeout);
          pollingInterval = null;
          
          // Update status
          if (qrStatus) {
            qrStatus.textContent = 'Session expired. Please generate a new QR code.';
          }
        } else {
          // Update status
          if (qrStatus) {
            qrStatus.textContent = 'Waiting for authentication. Please scan the QR code.';
          }
        }
      })
      .catch(error => {
        console.error('Error polling status:', error);
        
        if (qrStatus) {
          qrStatus.textContent = 'Error checking status. Please try again.';
        }
        
        // Clear interval and timeout on error
        clearInterval(pollingInterval);
        clearTimeout(expiryTimeout);
        pollingInterval = null;
      });
  }, 3000);
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', initAuth); 