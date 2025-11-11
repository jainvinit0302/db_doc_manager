# DBDocManager

DSL-driven Database Documentation & Data Lineage Management Platform

## Project Structure

This project is organized into separate frontend and backend applications:

```
DBDoc/
├── frontend/           # React + Vite frontend application
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
├── backend/            # Node.js + Express backend API
│   ├── src/
│   ├── config/
│   ├── package.json
│   └── ...
└── README.md          # This file
```

## Getting Started

### Frontend Development

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
# or
bun install
```

3. Start the development server:
```bash
npm run dev
# or
bun dev
```

The frontend will be available at `http://localhost:5173`

### Backend Development

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

The backend API will be available at `http://localhost:5000`

## Features

- **Frontend**: Modern React application with TypeScript, Tailwind CSS, and shadcn/ui components
- **Backend**: RESTful API built with Node.js and Express
- **DSL Processing**: Convert database schemas from DSL to SQL
- **Multi-Database Support**: PostgreSQL, MySQL, Snowflake, MongoDB
- **Project Management**: Create, manage, and organize database documentation projects
- **Data Lineage**: Visualize data flow and relationships

## Tech Stack

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- Lucide React Icons

### Backend
- Node.js
- Express.js
- CORS
- Helmet (Security)
- Morgan (Logging)
- dotenv (Environment variables)

## Development Workflow

1. **Start Backend**: Run the backend API server first
2. **Start Frontend**: Run the frontend development server
3. **Development**: Both servers support hot reloading for efficient development

## Contributing

Made by Vinit Jain, Rinkesh Verma , Suresh Kumar  & Kedar Dalvi - IIITH Students | 2025
