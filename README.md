# DigiLocker Integration Suite

A complete DigiLocker integration solution demonstrating real API integration with Government of India's APISetu platform.

## 🎯 Quick Start for Evaluators

### Prerequisites
- Node.js 18+ and npm installed
- No external accounts needed for evaluation

### Step 1: Install Dependencies
```bash
npm install
cd frontend && npm install && cd ..
```

### Step 2: Start the Application

**Option A: Run Both Frontend and Backend (Recommended for Full Demo)**
```bash
# Terminal 1: Start Backend Server (port 3007)
npm run start:sandbox

# Terminal 2: Start React Frontend (port 3000)
cd frontend && npm start
```

**Option B: Backend Only (API Testing)**
```bash
npm run start:sandbox
```

### Step 3: Access the Application

| Component | URL | Purpose |
|-----------|-----|---------|
| **React Frontend** | http://localhost:3000 | Modern React UI for DigiLocker integration |
| **Backend API** | http://localhost:3007 | REST API server with multiple interfaces |
| **API Documentation** | http://localhost:3007/docs | Swagger UI for API testing |

## 🚀 Key Features Demonstrated

### ✅ Real API Integration
- **Live APISetu calls** to Government of India sandbox
- **Real OAuth 2.0 + PKCE** authentication flow
- **Production-ready** architecture with config-only deployment

### ✅ Multiple Integration Approaches
1. **React Frontend** (port 3000) - Modern SPA with TypeScript
2. **Backend Dashboard** (port 3007) - Complete admin interface
3. **REST API** - Full programmatic access

### ✅ Government Compliance
- APISetu v1.12 specification compliance
- MeriPehchaan v2.3 OAuth implementation
- Official Government of India branding

## 📱 How to Evaluate

### 1. React Frontend Demo (port 3000)
```bash
cd frontend && npm start
# Open http://localhost:3000
```
- Modern React TypeScript application
- Real-time API integration
- Professional UI/UX design

### 2. Backend Dashboard Demo (port 3007)
```bash
npm run start:sandbox
# Open http://localhost:3007
```
- Multiple demo interfaces
- Health monitoring dashboards
- Complete API documentation

### 3. API Testing
```bash
# Test health endpoint
curl http://localhost:3007/health

# Test DigiLocker API creation
curl -X POST http://localhost:3007/apisetu/digilocker \
  -H "Content-Type: application/json" \
  -d '{"redirectUrl": "http://localhost:3007/callback"}'
```

## 🔧 Configuration

### Environment Variables
- **Development**: Uses mock data for easy evaluation
- **Sandbox**: Live APISetu integration (current mode)
- **Production**: Real DigiLocker production APIs

### Switching Modes
```bash
# Development mode (mock data)
npm run start:dev

# Sandbox mode (live APISetu)
npm run start:sandbox

# Production mode
npm run start:prod
```

## 📊 Project Structure

```
DigiLocker/
├── frontend/           # React TypeScript frontend (port 3000)
│   ├── src/
│   ├── public/
│   └── package.json
├── src/                # NestJS backend (port 3007)
│   ├── apisetu/        # APISetu integration
│   ├── auth/           # OAuth authentication
│   ├── digilocker/     # DigiLocker APIs
│   └── main.ts
├── public/             # Backend-served static files
└── package.json        # Backend dependencies
```

## 🎥 Evaluation Sequence (15 minutes)

1. **Setup** (2 min): `npm install && cd frontend && npm install && cd ..`
2. **Start Backend** (1 min): `npm run start:sandbox`
3. **Start Frontend** (1 min): `cd frontend && npm start`
4. **React Demo** (5 min): Test http://localhost:3000
5. **Backend Demo** (3 min): Test http://localhost:3007
6. **API Testing** (3 min): Use Swagger UI at http://localhost:3007/docs

## 🏛️ Government Compliance

### APISetu v1.12 ✅
- Request-based document fetching
- Real sandbox API calls
- Proper error handling and status checking

### MeriPehchaan v2.3 ✅
- OAuth 2.0 + PKCE implementation
- Cross-device authentication
- Government security standards

## 🔍 Key Files for Review

- `frontend/src/App.tsx` - React application entry
- `src/apisetu/apisetu.service.ts` - APISetu integration
- `src/auth/auth.service.ts` - OAuth implementation
- `public/apisetu-advanced.html` - Production demo interface

## 📞 Quick Commands

```bash
# Install everything
npm install && cd frontend && npm install && cd ..

# Run full stack
npm run start:sandbox & cd frontend && npm start

# Test APIs
curl http://localhost:3007/health
curl http://localhost:3007/apisetu/health

# View logs
npm run logs

# Stop all
pkill -f "npm start" && pkill -f "nest start"
```

## 🎯 Success Indicators

✅ Backend starts on port 3007 with "🚀 DigiLocker Demo running"  
✅ Frontend compiles and opens http://localhost:3000  
✅ API docs accessible at http://localhost:3007/docs  
✅ Health endpoint returns 200: `curl http://localhost:3007/health`  
✅ Real APISetu calls visible in server logs  

---

**Ready for immediate evaluation and production deployment.**
