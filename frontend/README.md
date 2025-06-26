# DigiLocker Frontend - React Integration

This is the React frontend for the DigiLocker integration project, featuring a three-step wizard to interact with the Setu DigiLocker sandbox API.

## Frontend UI

The application provides an intuitive three-step wizard interface:

1. **Request Creation** - Configure redirect URL and document type
2. **Consent Process** - Complete DigiLocker authentication and consent
3. **Data Retrieval** - Automatic polling and XML data display with syntax highlighting

### Quick Start

```bash
cd frontend
npm i      # first time
npm run dev
```

The frontend will start on `http://localhost:3000` and connect to the backend at `http://localhost:3007`.

## Features

- ✅ **Three-step wizard interface** with progress indicators
- ✅ **Real-time status polling** with automatic authentication detection
- ✅ **XML syntax highlighting** using highlight.js
- ✅ **Toast notifications** for user feedback
- ✅ **Tailwind CSS styling** for modern, responsive design
- ✅ **Download functionality** for retrieved XML data
- ✅ **Error handling** with user-friendly messages

## Environment Configuration

The frontend uses environment variables for configuration:

- `REACT_APP_BACKEND_URL` - Backend API base URL (default: `http://localhost:3007/apisetu`)

Create a `.env.local` file for local development:

```env
REACT_APP_BACKEND_URL=http://localhost:3007/apisetu
```

## Development Workflow

1. Start the backend in sandbox mode:
   ```bash
   cd .. && npm run start:sandbox
   ```

2. Start the frontend:
   ```bash
   npm start
   ```

3. Open `http://localhost:3000` to see the DigiLocker wizard

## Available Scripts

### `npm start`

Runs the app in development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `npm test`

Launches the test runner in interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.\
The build is optimized for the best performance and ready for deployment.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

This command will remove the single build dependency from your project and give you full control over the build configuration.

## Architecture

- **React 18** with hooks for state management
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Axios** for API communication
- **highlight.js** for XML syntax highlighting
- **react-hot-toast** for notifications

## Learn More

- [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started)
- [React documentation](https://reactjs.org/)
- [Tailwind CSS documentation](https://tailwindcss.com/docs)
