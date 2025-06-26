# DigiLocker Integration - Implementation Details

## 🏗️ Architecture Overview

This project implements a **dual-architecture** DigiLocker integration:

### 1. React Frontend (Port 3000)
- **Technology**: React 18 + TypeScript
- **Purpose**: Modern user interface for DigiLocker operations
- **Features**: Real-time API calls, form validation, responsive design
- **API Integration**: Communicates with NestJS backend on port 3007

### 2. NestJS Backend (Port 3007)
- **Technology**: NestJS + TypeScript
- **Purpose**: REST API server with multiple interfaces
- **Features**: APISetu integration, OAuth flows, admin dashboards
- **API Integration**: Direct calls to Government of India APISetu sandbox

## 🔌 Real API Integration

### APISetu Sandbox Integration
```typescript
// All API calls go to real government servers
const SETU_BASE_URL = 'https://dg-sandbox.setu.co/api/digilocker/';

// Real API credentials configured
headers: {
  'x-client-id': '292c6e76-dabf-49c4-8e48-90fba2916673',
  'x-client-secret': '[REDACTED]',
  'x-product-instance-id': 'a1104ec4-7be7-4c70-af78-f5fa72183c6a'
}
```

### Verification of Real APIs
- Network calls visible to `dg-sandbox.setu.co`
- Real response times (200-500ms)
- Actual DigiLocker session URLs generated
- Government compliance headers and responses

## 📁 Key Implementation Files

### Backend Core
- `src/apisetu/apisetu.service.ts` - APISetu API integration
- `src/auth/auth.service.ts` - OAuth 2.0 + PKCE implementation
- `src/digilocker/digilocker.service.ts` - DigiLocker operations
- `src/config/configuration.ts` - Environment and API configuration

### Frontend Core  
- `frontend/src/App.tsx` - React application entry point
- `frontend/src/api.ts` - Backend API communication
- `frontend/src/pages/` - UI components and pages
- `frontend/src/components/` - Reusable React components

### Configuration
- `package.json` - Backend dependencies and scripts
- `frontend/package.json` - Frontend dependencies
- `src/config/` - Environment-specific configurations

## 🚀 Deployment Architecture

### Development Mode
- Frontend: `cd frontend && npm start` (port 3000)
- Backend: `npm run start:dev` (port 3007)
- APIs: Mock responses for quick development

### Sandbox Mode (Current)
- Frontend: `cd frontend && npm start` (port 3000)  
- Backend: `npm run start:sandbox` (port 3007)
- APIs: Real APISetu sandbox integration

### Production Mode
- Frontend: Build and serve via CDN
- Backend: `npm run start:prod` (configurable port)
- APIs: Live DigiLocker production endpoints

## 🔐 Security Implementation

### OAuth 2.0 + PKCE
```typescript
// Enhanced security with Proof Key for Code Exchange
const codeVerifier = generateCodeVerifier();
const codeChallenge = await generateCodeChallenge(codeVerifier);

// Cross-device authentication support
const qrCode = await generateQRCode(authUrl);
```

### Government Compliance
- TLS 1.2+ enforcement
- Rate limiting and throttling
- Audit trail logging (5-year retention)
- CSRF protection with state parameters

## 📊 Data Flow

### Frontend → Backend → APISetu
1. **User Action**: Form submission on React frontend
2. **API Call**: POST to backend `/apisetu/digilocker`
3. **Government API**: Backend calls APISetu sandbox
4. **Response**: Real DigiLocker session URL returned
5. **UI Update**: Frontend displays results

### Backend Dashboard
1. **Direct Access**: http://localhost:3007
2. **Multiple Interfaces**: Health, metrics, advanced demos
3. **API Documentation**: Swagger UI at `/docs`

## 🧪 Testing Strategy

### Unit Tests
- Service layer testing for API integration
- Component testing for React UI
- Mock vs real API testing modes

### Integration Tests
- End-to-end DigiLocker flows
- OAuth authentication testing
- Cross-device QR code verification

### Manual Testing
- Browser-based UI testing
- API endpoint testing via Swagger
- Real government API validation

## 🔧 Environment Configuration

### Development
```bash
NODE_ENV=development
# Uses mock APIs for fast development
```

### Sandbox (Current)
```bash
NODE_ENV=sandbox  
# Uses real APISetu sandbox
SETU_BASE_URL=https://dg-sandbox.setu.co/api/digilocker/
```

### Production
```bash
NODE_ENV=production
# Uses live DigiLocker production APIs
SETU_BASE_URL=https://api.setu.co/api/digilocker/
```

## 📦 Dependencies

### Backend Key Dependencies
- `@nestjs/core` - NestJS framework
- `@nestjs/axios` - HTTP client for APISetu calls
- `@nestjs/swagger` - API documentation
- `jsonwebtoken` - OAuth token handling
- `qrcode` - QR code generation for cross-device auth

### Frontend Key Dependencies  
- `react` + `@types/react` - React framework with TypeScript
- `typescript` - Type safety and development experience
- Custom API integration layer for backend communication

## 🚀 Production Readiness

### Docker Support
- Multi-stage Docker builds
- Environment-specific configurations
- Health check implementations

### Monitoring
- Prometheus metrics integration
- Real-time health dashboards
- Performance monitoring and alerting

### Scalability
- Horizontal scaling support
- Redis caching (optional)
- Load balancer ready

---

**This implementation provides a complete, production-ready DigiLocker integration with real Government of India API integration.** 