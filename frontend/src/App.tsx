import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { createDlRequest, getDlStatus, fetchAadhaar, DlRequestResponse } from './api';
import XmlViewer from './components/XmlViewer';
import './App.css';

type WizardStep = 'request' | 'consent' | 'poll';

interface AppState {
  step: WizardStep;
  requestData: DlRequestResponse | null;
  redirectUrl: string;
  docType: string;
  isLoading: boolean;
  consentCompleted: boolean;
  xmlData: string | null;
  pollingActive: boolean;
}

function App() {
  const location = useLocation();
  
  const [state, setState] = useState<AppState>({
    step: 'request',
    requestData: null,
    redirectUrl: `${window.location.origin}/apisetu-callback`,
    docType: 'AADHAAR',
    isLoading: false,
    consentCompleted: false,
    xmlData: null,
    pollingActive: false,
  });

  // Handle callback state from navigation
  useEffect(() => {
    if (location.state) {
      const { consentCompleted, requestId, error } = location.state as any;
      
      if (consentCompleted && requestId) {
        console.log('[APP] Received consent completion callback', { requestId });
        
        // Restore the request data from localStorage or create mock data
        const storedRequestId = localStorage.getItem('currentRequestId');
        if (storedRequestId === requestId) {
          setState(prev => ({
            ...prev,
            consentCompleted: true,
            step: 'poll',
            pollingActive: true,
            requestData: {
              id: requestId,
              status: 'authenticated',
              url: '', // Not needed after consent
              validUpto: new Date(Date.now() + 15 * 60 * 1000).toISOString()
            }
          }));
          
          toast.success('Consent completed! Checking authentication status...');
        }
      } else if (error) {
        console.error('[APP] Received error from callback', { error });
        toast.error(`Consent failed: ${error}`);
      }
    }
  }, [location.state]);

  // Enhanced polling effect for status checking
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let pollCount = 0;
    const maxPolls = 30; // 1 minute of polling (2s interval)
    
    if (state.pollingActive && state.requestData && state.step === 'poll') {
      console.log(`[UI] Starting status polling for request: ${state.requestData.id}`);
      
      interval = setInterval(async () => {
        pollCount++;
        console.log(`[UI] Status poll #${pollCount} for request: ${state.requestData!.id}`);
        
        try {
          const startTime = Date.now();
          const status = await getDlStatus(state.requestData!.id);
          const duration = Date.now() - startTime;
          
          console.log(`[UI] Status check completed in ${duration}ms`, {
            pollCount,
            status: status.status,
            requestId: state.requestData!.id
          });
          
          if (status.status === 'authenticated') {
            setState(prev => ({ ...prev, pollingActive: false }));
            toast.success('Authentication successful! Fetching Aadhaar data...');
            
            try {
              const fetchStartTime = Date.now();
              const xmlData = await fetchAadhaar(state.requestData!.id);
              const fetchDuration = Date.now() - fetchStartTime;
              
              console.log(`[UI] Aadhaar data fetched successfully in ${fetchDuration}ms`, {
                dataLength: xmlData.length,
                requestId: state.requestData!.id
              });
              
              setState(prev => ({ ...prev, xmlData }));
              toast.success('Aadhaar data retrieved successfully!');
            } catch (error: any) {
              const errorMessage = error.userMessage || 'Failed to fetch Aadhaar data. Please try again.';
              console.error('[UI ERROR] Fetch Aadhaar failed', {
                error: error.message,
                status: error.response?.status,
                requestId: state.requestData!.id
              });
              toast.error(errorMessage);
            }
          } else if (status.status === 'failed' || status.status === 'expired' || status.status === 'revoked') {
            setState(prev => ({ ...prev, pollingActive: false }));
            console.warn(`[UI] Request ended with status: ${status.status}`);
            toast.error(`Request ${status.status}. Please start over.`);
          } else if (pollCount >= maxPolls) {
            setState(prev => ({ ...prev, pollingActive: false }));
            console.warn(`[UI] Polling timeout after ${pollCount} attempts`);
            toast.error('Polling timeout. Please check manually or start over.');
          }
        } catch (error: any) {
          console.error(`[UI ERROR] Polling error on attempt #${pollCount}`, {
            error: error.message,
            status: error.response?.status,
            requestId: state.requestData!.id
          });
          
          if (pollCount >= maxPolls) {
            setState(prev => ({ ...prev, pollingActive: false }));
            toast.error('Polling failed. Please try again.');
          }
        }
      }, 2000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
        if (pollCount > 0) {
          console.log(`[UI] Polling stopped after ${pollCount} attempts`);
        }
      }
    };
  }, [state.pollingActive, state.requestData, state.step]);

  const handleCreateRequest = async () => {
    console.log(`[UI] Starting DigiLocker request creation`, {
      redirectUrl: state.redirectUrl,
      selectedDocType: state.docType, // For UI tracking only
      timestamp: new Date().toISOString()
    });
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const startTime = Date.now();
      const requestData = await createDlRequest({
        redirectUrl: state.redirectUrl,
      });
      
      const duration = Date.now() - startTime;
      console.log(`[UI] DigiLocker request created successfully in ${duration}ms`, {
        requestId: requestData.id,
        status: requestData.status,
        validUpto: requestData.validUpto
      });
      
      // Store request ID for callback restoration
      localStorage.setItem('currentRequestId', requestData.id);
      localStorage.setItem('requestCreatedAt', Date.now().toString());
      
      setState(prev => ({
        ...prev,
        requestData,
        step: 'consent',
        isLoading: false,
      }));
      
      toast.success(`Request created! ID: ${requestData.id.substring(0, 8)}...`);
    } catch (error: any) {
      const errorMessage = error.userMessage || error.response?.data?.message || 'Failed to create request';
      console.error(`[UI ERROR] Failed to create DigiLocker request`, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        userMessage: error.userMessage
      });
      
      setState(prev => ({ ...prev, isLoading: false }));
      toast.error(errorMessage);
    }
  };

  const handleOpenConsent = () => {
    if (state.requestData?.url) {
      window.open(state.requestData.url, '_blank');
    }
  };

  const handleStartPolling = () => {
    if (!state.consentCompleted) {
      toast.error('Please confirm that you completed the consent process first.');
      return;
    }
    
    setState(prev => ({
      ...prev,
      step: 'poll',
      pollingActive: true,
    }));
    
    toast.loading('Checking authentication status...', { duration: 3000 });
  };

  const handleReset = () => {
    setState({
      step: 'request',
      requestData: null,
      redirectUrl: `${window.location.origin}/check_callback.html`,
      docType: 'AADHAAR',
      isLoading: false,
      consentCompleted: false,
      xmlData: null,
      pollingActive: false,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <Toaster position="top-right" />
      
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            DigiLocker Integration Wizard
          </h1>
          <p className="text-gray-600">
            Complete three-step process to retrieve Aadhaar data via Setu DigiLocker
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`progress-step ${
              state.step === 'request' ? 'active' : 
              state.step === 'consent' || state.step === 'poll' ? 'completed' : 
              'inactive'
            }`}>
              1
            </div>
            <span className="text-sm font-medium text-gray-600">Request</span>
            
            <div className="progress-line"></div>
            
            <div className={`progress-step ${
              state.step === 'consent' ? 'active' : 
              state.step === 'poll' ? 'completed' : 
              'inactive'
            }`}>
              2
            </div>
            <span className="text-sm font-medium text-gray-600">Consent</span>
            
            <div className="progress-line"></div>
            
            <div className={`progress-step ${
              state.step === 'poll' ? 'active' : 'inactive'
            }`}>
              3
            </div>
            <span className="text-sm font-medium text-gray-600">Fetch Data</span>
          </div>
        </div>

        {/* Step 1: Request */}
        {state.step === 'request' && (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Step 1: Create DigiLocker Request</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Redirect URL
                </label>
                <input
                  type="url"
                  value={state.redirectUrl}
                  onChange={(e) => setState(prev => ({ ...prev, redirectUrl: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://your-app.com/callback"
                />
                <p className="text-sm text-gray-500 mt-1">
                  URL where users will be redirected after consent
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Type
                </label>
                <select
                  value={state.docType}
                  onChange={(e) => setState(prev => ({ ...prev, docType: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="AADHAAR">Aadhaar Card</option>
                  <option value="PAN">PAN Card</option>
                  <option value="DL">Driving License</option>
                </select>
              </div>

              <button
                                 onClick={handleCreateRequest}
                 disabled={state.isLoading || !state.redirectUrl}
                 className="w-full btn-primary"
              >
                {state.isLoading ? 'Creating Request...' : 'Create Request'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Consent */}
        {state.step === 'consent' && state.requestData && (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Step 2: Complete Consent Process</h2>
            
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-green-800 font-medium">✅ Request Created Successfully!</p>
                <p className="text-sm text-green-700 mt-1">
                  Request ID: <span className="font-mono">{state.requestData.id}</span>
                </p>
              </div>

              <div>
                <p className="text-gray-700 mb-4">
                  Click the button below to open the DigiLocker consent page in a new tab. 
                  Complete the authentication and consent process, then return here.
                </p>
                
                <button
                                   onClick={handleOpenConsent}
                 className="w-full btn-success mb-4"
                >
                  Open Consent in New Tab
                </button>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="consentCompleted"
                    checked={state.consentCompleted}
                    onChange={(e) => setState(prev => ({ ...prev, consentCompleted: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="consentCompleted" className="text-sm text-gray-700">
                    I have completed the consent process and clicked "Allow"
                  </label>
                </div>

                <button
                                   onClick={handleStartPolling}
                 disabled={!state.consentCompleted}
                 className="w-full mt-4 btn-primary"
                >
                  Continue to Data Fetch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Poll & Fetch */}
        {state.step === 'poll' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-4">Step 3: Fetching Data</h2>
              
              {state.pollingActive && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Checking authentication status...</p>
                  <p className="text-sm text-gray-500 mt-2">
                    This may take a few moments. Please wait.
                  </p>
                </div>
              )}
              
              {!state.pollingActive && !state.xmlData && (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">Waiting for authentication...</p>
                  <button
                                       onClick={() => setState(prev => ({ ...prev, pollingActive: true }))}
                   className="btn-primary"
                  >
                    Retry Status Check
                  </button>
                </div>
              )}
            </div>

            {/* XML Data Display */}
            {state.xmlData && (
              <XmlViewer xmlContent={state.xmlData} requestId={state.requestData!.id} />
            )}
          </div>
        )}

        {/* Reset Button */}
        {(state.step === 'consent' || state.step === 'poll') && (
          <div className="mt-8 text-center">
            <button
                           onClick={handleReset}
             className="btn-secondary"
            >
              Start Over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
