import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';

const ApiSetuCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [message, setMessage] = useState('Processing consent...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const searchParams = new URLSearchParams(location.search);
      const hash = new URLSearchParams(location.hash.substring(1)); // Remove # from hash
      
      // Extract request ID from URL path (e.g., /apisetu-callback/REQUEST_ID)
      const pathParts = location.pathname.split('/');
      const pathRequestId = pathParts[pathParts.length - 1];
      
      // Get stored request ID from localStorage
      const storedRequestId = localStorage.getItem('currentRequestId');
      
      // Log all parameters for debugging
      console.log('[CALLBACK] Full URL analysis', {
        fullUrl: window.location.href,
        pathname: location.pathname,
        pathParts,
        pathRequestId,
        storedRequestId,
        search: location.search,
        hash: location.hash,
        allSearchParams: Object.fromEntries(searchParams.entries()),
        allHashParams: Object.fromEntries(hash.entries())
      });

      // Check common Setu callback parameters
      const success = searchParams.get('success') || searchParams.get('status') || hash.get('success') || hash.get('status');
      const requestId = searchParams.get('id') || searchParams.get('requestId') || searchParams.get('request_id') || 
                       hash.get('id') || hash.get('requestId') || hash.get('request_id') ||
                       params.requestId || // From React Router URL params
                       (pathRequestId && pathRequestId !== 'apisetu-callback' ? pathRequestId : null) ||
                       storedRequestId; // Fallback to stored ID
      const scope = searchParams.get('scope') || hash.get('scope');
      const errorParam = searchParams.get('error') || hash.get('error');
      const errorDescription = searchParams.get('error_description') || hash.get('error_description');
      const code = searchParams.get('code') || hash.get('code');
      const state = searchParams.get('state') || hash.get('state');

      console.log('[CALLBACK] Parsed parameters', {
        success,
        requestId,
        scope,
        error: errorParam,
        errorDescription,
        code,
        state,
        usingStoredId: requestId === storedRequestId
      });

      // Handle explicit error case
      if (errorParam) {
        const finalErrorDescription = errorDescription || 'User denied access or authentication failed';
        setError(`Consent failed: ${finalErrorDescription}`);
        setMessage('Consent was denied. Redirecting back...');
        setTimeout(() => {
          navigate('/', { replace: true, state: { error: finalErrorDescription } });
        }, 3000);
        return;
      }

      // Handle success cases - more flexible parameter detection
      const isSuccessful = success === 'true' || 
                          success === '1' || 
                          success === 'success' ||
                          code || // OAuth code indicates success
                          (requestId && !errorParam) || // Having a requestId without error is usually success
                          (storedRequestId && !errorParam); // If we're on callback page with stored ID, assume success

      if (isSuccessful && requestId) {
        setMessage(`Consent completed successfully! Returning to main app...`);
        
        // Store the successful request ID to continue the flow
        localStorage.setItem('currentRequestId', requestId);
        localStorage.setItem('consentCompleted', 'true');
        localStorage.setItem('consentTimestamp', Date.now().toString());
        
        console.log('[CALLBACK] Consent successful, redirecting to main app', {
          requestId,
          scope,
          code,
          state
        });

        // Redirect back to main app with success state
        setTimeout(() => {
          navigate('/', { 
            replace: true, 
            state: { 
              consentCompleted: true, 
              requestId,
              scope,
              code,
              state
            } 
          });
        }, 1500);
      } else if (storedRequestId && !errorParam) {
        // We have a stored requestId and no error - likely a successful callback
        console.log('[CALLBACK] Using stored requestId, assuming success', {
          storedRequestId,
          currentUrl: window.location.href
        });
        
        setMessage(`Processing successful consent... Returning to main app...`);
        
        localStorage.setItem('consentCompleted', 'true');
        localStorage.setItem('consentTimestamp', Date.now().toString());
        
        setTimeout(() => {
          navigate('/', { 
            replace: true, 
            state: { 
              consentCompleted: true, 
              requestId: storedRequestId
            } 
          });
        }, 2000);
      } else {
        // No clear success indicators and no requestId
        console.warn('[CALLBACK] Invalid callback - no success indicators or requestId', {
          allSearchParams: Object.fromEntries(searchParams.entries()),
          allHashParams: Object.fromEntries(hash.entries()),
          pathParts,
          storedRequestId,
          hasStoredId: !!storedRequestId
        });
        
        // If we have a stored request ID, still try to proceed
        if (storedRequestId) {
          console.log('[CALLBACK] No clear success/failure, but stored ID exists - proceeding anyway');
          setMessage(`Uncertain callback status, but proceeding with stored request...`);
          
          localStorage.setItem('consentCompleted', 'true');
          localStorage.setItem('consentTimestamp', Date.now().toString());
          
          setTimeout(() => {
            navigate('/', { 
              replace: true, 
              state: { 
                consentCompleted: true, 
                requestId: storedRequestId,
                uncertain: true
              } 
            });
          }, 2000);
        } else {
          setError('No active DigiLocker request found');
          setMessage('Invalid callback - no active request. Please start over...');
          setTimeout(() => {
            navigate('/', { replace: true, state: { error: 'No active request found' } });
          }, 3000);
        }
      }
    };

    processCallback();
  }, [navigate, location, params.requestId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '40px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        maxWidth: '500px',
        width: '100%'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          backgroundColor: error ? '#ef4444' : '#10b981',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          color: 'white',
          fontSize: '24px'
        }}>
          {error ? '✗' : '✓'}
        </div>
        
        <h1 style={{ 
          fontSize: '24px', 
          marginBottom: '10px',
          color: error ? '#dc2626' : '#059669'
        }}>
          {error ? 'Consent Processing Issue' : 'Processing Consent'}
        </h1>
        
        <p style={{ 
          color: '#6b7280', 
          marginBottom: '20px',
          fontSize: '16px'
        }}>
          {message}
        </p>
        
        {error && (
          <p style={{ 
            color: '#dc2626', 
            fontSize: '14px',
            backgroundColor: '#fef2f2',
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid #fecaca'
          }}>
            {error}
          </p>
        )}

        <div style={{ 
          marginTop: '20px',
          fontSize: '12px',
          color: '#9ca3af'
        }}>
          Redirecting back to DigiLocker Integration Wizard...
        </div>
      </div>
    </div>
  );
};

export default ApiSetuCallback; 