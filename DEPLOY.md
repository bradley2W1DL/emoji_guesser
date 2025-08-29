## Claude recommendation for deployments using Railway

1. server.js - Added Express and static file serving
  - Added Express.js dependency and static file serving
  - Environment variables for PORT, NODE_ENV, and FRONTEND_URL
  - In production mode, serves React build files from emoji-guesser-fe/dist/
  - CORS configuration automatically adjusts for production vs development

2. App.tsx - Dynamic socket URL
  - Socket connection now uses window.location.origin in production
  - Falls back to localhost:3001 for development
  - Uses VITE_SOCKET_URL environment variable if set

3. package.json - Added build automation
  - Added express dependency
  - Added build script to build the React frontend
  - Added postinstall script to automatically build after Railway deployment

4. .env.production - Environment configuration
  - Created production environment file with documentation
  - Ready for Railway deployment

## Railway Deployment Steps

1. Install dependencies locally first:
  - npm install
2. Deploy to Railway:
  - Connect your GitHub repo to Railway
  - Railway will automatically:
      - Run npm install (which triggers postinstall → builds frontend)
    - Run npm start to start the server
    - Set NODE_ENV=production
3. Environment Variables in Railway:
  - Railway will automatically set PORT
  - No other environment variables needed for basic setup

The server will now serve both the API/WebSocket connections AND the React frontend from the same port. In production, users will
access your game at your Railway app URL (e.g., https://your-app.railway.app), and everything will work seamlessly!
