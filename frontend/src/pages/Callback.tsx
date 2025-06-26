import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const Callback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState('Processing login...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const exchangeAuthCode = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const state = params.get('state'); // Capture state if present

      if (!code) {
        setError('Authorization code not found in callback URL.');
        setMessage('Login failed. Redirecting to login page...');
        setTimeout(() => navigate('/login', { replace: true }), 3000);
        return;
      }

      try {
        setMessage(`Exchanging authorization code...`);
        // POST the code (and state) to your new backend endpoint
        const response = await axios.post(
          'http://localhost:3005/auth/exchange-code',
          { code, state }, // Send code and state in the request body
          { withCredentials: true } // Important if your backend relies on any cookies for other purposes or if state validation is session-bound
        );

        const { accessToken, refreshToken, userInfo, message: successMessage } = response.data;

        if (accessToken) {
          localStorage.setItem('authToken', accessToken);
          if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
          }
          // Optionally store userInfo in localStorage or context if needed globally
          localStorage.setItem('userInfo', JSON.stringify(userInfo));
          
          setMessage(successMessage || 'Login successful! Redirecting to files...');
          setTimeout(() => navigate('/files', { replace: true }), 1000);
        } else {
          throw new Error('Access token not received from backend.');
        }

      } catch (err: any) {
        console.error('Error during code exchange:', err);
        const errorMessage = err.response?.data?.message || err.message || 'An unknown error occurred.';
        setError(`Login finalization failed: ${errorMessage}. Please try logging in again.`);
        setMessage('Login failed. Redirecting to login page...');
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userInfo');
        setTimeout(() => navigate('/login', { replace: true }), 4000);
      }
    };

    exchangeAuthCode();
  }, [navigate, location]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <h1>Login Callback</h1>
      <p>{message}</p>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  );
};

export default Callback;
