import React from 'react';

const Login: React.FC = () => {
  const handleLogin = () => {
    // Redirect to the backend's DigiLocker login initiation endpoint
    window.location.href = 'http://localhost:3005/auth/login';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <h1>DigiLocker Client</h1>
      <p>Please log in to access your files.</p>
      <button onClick={handleLogin} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
        Login with DigiLocker
      </button>
    </div>
  );
};

export default Login;

