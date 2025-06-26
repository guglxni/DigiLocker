import axios from 'axios';

const api = axios.create({ 
  baseURL: process.env.REACT_APP_BACKEND_URL || 'http://localhost:3007/apisetu',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Enhanced logging utility
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[API] ${new Date().toISOString()} - ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API ERROR] ${new Date().toISOString()} - ${message}`, error || '');
  },
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[API DEBUG] ${new Date().toISOString()} - ${message}`, data || '');
    }
  }
};

export interface CreateDlRequestPayload {
  redirectUrl: string;
  sessionId?: string;
}

export interface DlRequestResponse {
  id: string;
  url: string;
  status: string;
  validUpto: string;
}

export interface DlStatusResponse {
  id: string;
  status: string;
  validUpto?: string;
  url?: string;
}

// Fixed API functions to match backend endpoints
export const createDlRequest = async (payload: CreateDlRequestPayload): Promise<DlRequestResponse> => {
  try {
    logger.info('Creating DigiLocker request', { 
      payload: { 
        redirectUrl: payload.redirectUrl.substring(0, 50) + '...',
        sessionId: payload.sessionId || 'none'
      } 
    });
    const startTime = Date.now();
    
    // Use correct backend endpoint: /digilocker instead of /dl/request
    const response = await api.post('/digilocker', payload);
    
    const duration = Date.now() - startTime;
    logger.info(`DigiLocker request created successfully in ${duration}ms`, { 
      id: response.data.id, 
      status: response.data.status 
    });
    
    return response.data;
  } catch (error: any) {
    logger.error('Failed to create DigiLocker request', {
      error: error.response?.data || error.message,
      status: error.response?.status,
      payload
    });
    throw error;
  }
};

export const getDlStatus = async (id: string): Promise<DlStatusResponse> => {
  try {
    logger.debug(`Checking status for request ID: ${id}`);
    const startTime = Date.now();
    
    // Use correct backend endpoint: /digilocker/:id/status instead of /dl/status/:id
    const response = await api.get(`/digilocker/${id}/status`);
    
    const duration = Date.now() - startTime;
    logger.info(`Status check completed in ${duration}ms`, { 
      id, 
      status: response.data.status 
    });
    
    return response.data;
  } catch (error: any) {
    logger.error(`Failed to get status for request ${id}`, {
      error: error.response?.data || error.message,
      status: error.response?.status
    });
    throw error;
  }
};

export const fetchAadhaar = async (id: string): Promise<string> => {
  try {
    logger.info(`Fetching Aadhaar data for request ID: ${id}`);
    const startTime = Date.now();
    
    // Use correct backend endpoint: /digilocker/:id/aadhaar instead of /dl/aadhaar/:id
    const response = await api.get(`/digilocker/${id}/aadhaar`, { 
      responseType: 'text',
      headers: {
        'Accept': 'application/xml, text/xml, */*'
      }
    });
    
    const duration = Date.now() - startTime;
    const dataLength = response.data?.length || 0;
    logger.info(`Aadhaar data fetched successfully in ${duration}ms`, { 
      id, 
      dataLength: `${dataLength} characters`
    });
    
    return response.data;
  } catch (error: any) {
    logger.error(`Failed to fetch Aadhaar data for request ${id}`, {
      error: error.response?.data || error.message,
      status: error.response?.status
    });
    throw error;
  }
};

// Enhanced request/response interceptors with better logging
api.interceptors.request.use(
  (config) => {
    logger.debug('Outgoing API request', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      headers: config.headers,
      timeout: config.timeout
    });
    return config;
  },
  (error) => {
    logger.error('Request interceptor error', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    logger.debug('API response received', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      method: response.config.method?.toUpperCase(),
      headers: response.headers,
      dataSize: JSON.stringify(response.data).length
    });
    return response;
  },
  (error) => {
    const errorInfo = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      data: error.response?.data,
      headers: error.response?.headers
    };
    
    logger.error('API response error', errorInfo);
    
    // Add user-friendly error messages
    if (error.response?.status === 404) {
      error.userMessage = 'The requested resource was not found. Please check the request ID.';
    } else if (error.response?.status >= 500) {
      error.userMessage = 'Server error occurred. Please try again later.';
    } else if (error.response?.status === 400) {
      error.userMessage = error.response?.data?.message || 'Invalid request. Please check your input.';
    } else if (!error.response) {
      error.userMessage = 'Network error. Please check your connection.';
    }
    
    return Promise.reject(error);
  }
); 