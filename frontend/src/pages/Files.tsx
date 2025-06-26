import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// Define an interface for the file structure
interface DigiLockerFile {
  name: string;
  uri: string;
  type: string; // e.g., 'file' or 'folder' - adjust as per your API response
  mime: string; // Mime type, e.g., 'application/pdf'
  size: string; // File size as string, e.g., "1.2 MB"
  issuedon: string; // Date string
  issuer: string; // Issuer name
  issuerid: string;
  description?: string; // Optional
}

const Files: React.FC = () => {
  const [files, setFiles] = useState<DigiLockerFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Create an axios instance for API calls that will include the auth token
  const apiClient = useCallback(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.error('No auth token found, redirecting to login.');
      navigate('/login', { replace: true });
      return null; // Return null or throw error if no token
    }
    return axios.create({
      baseURL: 'http://localhost:3005',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      withCredentials: true, // Keep this if your backend might still use cookies for other things or if CORS requires it
    });
  }, [navigate]);

  useEffect(() => {
    const fetchFiles = async () => {
      const client = apiClient();
      if (!client) return; // Early exit if no token/client

      try {
        setLoading(true);
        setError(null);
        const response = await client.get('/digilocker/files');
        setFiles(response.data.items || response.data || []); // Adjust based on actual API response
      } catch (err: any) {
        console.error('Error fetching files:', err);
        if (axios.isAxiosError(err) && err.response) {
          if (err.response.status === 401 || err.response.status === 403) {
            setError('Unauthorized or session expired. Please log in again.');
            localStorage.removeItem('authToken'); // Clear invalid token
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('userInfo');
            navigate('/login', { replace: true });
          } else {
            setError(err.response.data?.message || err.message || 'Failed to fetch files.');
          }
        } else {
          setError(err.message || 'Failed to fetch files. Please try again later.');
        }
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [apiClient, navigate]);

  const handleFileAction = async (fileUri: string, fileName: string, mimeType: string) => {
    const client = apiClient();
    if (!client) return;

    try {
      const response = await client.get(`/digilocker/file?uri=${encodeURIComponent(fileUri)}`, {
        responseType: 'blob',
      });

      const fileURL = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(fileURL);

    } catch (err: any) {
      console.error('Error downloading/viewing file:', err);
      if (axios.isAxiosError(err) && err.response && (err.response.status === 401 || err.response.status === 403)){
        alert('Session expired. Please log in again.');
        navigate('/login', { replace: true });
      } else {
        alert(`Failed to download file: ${err.response?.data?.message || err.message}`);
      }
    }
  };
  
  const handleLogout = async () => {
    const client = apiClient();
    // Even if client setup fails (no token), proceed to clear localStorage and redirect.
    
    try {
      if (client) {
        // Optional: Call backend logout endpoint if it exists and handles server-side session/token invalidation
        await client.post('/auth/logout'); 
        console.log('Called backend logout');
      }
    } catch (logoutError) {
      console.error('Error calling backend logout, proceeding with frontend logout:', logoutError);
    }
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userInfo');
    console.log('Frontend logout: Cleared tokens, navigating to login.');
    navigate('/login', { replace: true }); // Use navigate for SPA-style navigation
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading files...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Your DigiLocker Files</h1>
        <button onClick={handleLogout} style={{ padding: '8px 15px'}}>Logout</button>
      </div>
      
      {error && <p style={{ color: 'red', border: '1px solid red', padding: '10px', marginBottom: '15px' }}>Error: {error}</p>}

      {!loading && files.length === 0 && !error && (
        <p>No files found in your DigiLocker account.</p>
      )}

      {files.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {files.map((file) => (
            <li 
              key={file.uri} 
              style={{
                border: '1px solid #ddd',
                marginBottom: '10px',
                padding: '15px',
                borderRadius: '5px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <strong style={{ fontSize: '1.1em' }}>{file.name}</strong>
                <p style={{ fontSize: '0.9em', color: '#555' }}>
                  Type: {file.mime} | Size: {file.size} | Issued by: {file.issuer} on {new Date(file.issuedon).toLocaleDateString()}
                </p>
              </div>
              <button 
                onClick={() => handleFileAction(file.uri, file.name, file.mime)}
                style={{ padding: '8px 12px', cursor: 'pointer' }}
              >
                Download/View
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Files;
