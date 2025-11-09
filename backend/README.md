# DBDocManager Backend

Backend API for DBDocManager - DSL-driven Database Documentation & Lineage platform.

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Start the development server:
```bash
npm run dev
```

The backend will be running at `http://localhost:5000`

### API Endpoints

- `GET /` - API information
- `GET /health` - Health check

### Project Structure

```
backend/
├── src/
│   ├── app.js          # Main application file
│   ├── routes/         # API routes
│   ├── controllers/    # Route controllers
│   ├── models/         # Data models
│   ├── middleware/     # Custom middleware
│   └── utils/          # Utility functions
├── config/             # Configuration files
├── package.json
└── README.md
```

## Development

- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm test` - Run tests

## Contributing

Made by IIITH Students | 2025
