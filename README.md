# DBDocManager

**DSL-driven Database Documentation & Data Lineage Management Platform**

> Transform complex database schemas into beautiful, interactive documentation with automatic lineage tracking and multi-dialect SQL generation.

[![Version](https://img.shields.io/badge/version-2.2-blue.svg)](https://github.com)
[![CI](https://img.shields.io/badge/CI-passing-brightgreen.svg)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Made with ❤️](https://img.shields.io/badge/Made%20with-❤️-red.svg)](https://iiit.ac.in)

**Created by:** Vinit Jain, Rinkesh Verma, Kedar Dalvi, Jagadish Kollu & Suresh Kumar - IIITH Students | 2025

---

## 📚 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [DSL Reference](#dsl-reference)
- [API Documentation](#api-documentation)
- [Usage Guide](#usage-guide)
- [Development](#development)
- [Testing](#testing)
- [CI/CD Integration](#cicd-integration)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

---

## 🎯 Overview

**DBDocManager** solves the challenge of maintaining documentation for databases that undergo relational transformations. Teams often maintain data in both relational databases (PostgreSQL, Snowflake) and NoSQL sources (MongoDB) that are later converted into relational tables for analytics.

### The Problem

- 🔄 Hard to track source→target mappings (e.g., `dim_user.email` from `mongo.users.contact.email`)
- 📝 Documentation quickly becomes outdated
- 🔍 No single source of truth for schema definitions
- 🗺️ Lineage visualization is manual and error-prone

### The Solution

DBDocManager provides a lightweight **Domain-Specific Language (DSL)** to describe schemas and mappings, then automatically generates:

- 📖 **Human-readable documentation**
- 🎨 **Interactive ER Diagrams** (React Flow)
- 🔗 **Data Lineage Graphs** (Cytoscape)
- 📊 **Mapping Matrices** (CSV/HTML)
- 🗄️ **Multi-dialect SQL** (PostgreSQL, Snowflake, MongoDB)

**Current Status:** ~85% Complete | Production Ready

---

## ✨ Features

### Core Functionality

#### 🔐 **Authentication & User Management**
- User signup/login with JWT authentication
- Password hashing with bcrypt
- Protected routes and API endpoints
- User profile with usage analytics

#### 📁 **Project Management**
- Create and manage multiple documentation projects
- Save DSL content with auto-save
- Project metadata and versioning
- SQLite-based persistence

#### 📝 **DSL Editor**
- YAML-based DSL syntax
- Real-time validation with error highlighting
- Live preview of generated artifacts
- Support for complex mappings and transforms

#### ✅ **Validation Engine**
- **Structural Validation:** JSON Schema (AJV) validation
- **Referential Validation:** 
  - Source IDs must exist
  - Target tables/columns must exist
  - NOT NULL columns must have mappings or defaults
  - Orphan source detection
  - Transform syntax validation

#### 🔍 **Database Introspection** (New in v2.2)
- **PostgreSQL:** Connect to existing DB and auto-generate DSL
- **MongoDB:** Sample documents to infer schema and types
- **CLI Integration:** One-command DSL generation
- **Time Saver:** Reduces manual DSL writing by 90%

#### 🛠️ **Enhanced CLI**
- **init:** Scaffold new projects
- **validate:** Check syntax with colored output
- **generate:** Build static HTML docs & artifacts
- **serve:** Host local documentation server
- **introspect:** Reverse engineer databases
- **list:** Explore available transforms and metadata

#### ⚡ **Transform Library**
- **String:** `lower`, `upper`, `trim`, `concat`, `substring`
- **Date:** `parseDate`, `formatDate`
- **Math:** `round`, `abs`
- **Utility:** `coalesce`, `default`, `cast`
- **Extensible:** Easy to add custom functions

#### 🎨 **Visualizations**

**ER Diagrams (React Flow)**
- Interactive node-based diagrams
- Zoom, pan, and drag functionality
- Automatic layout with dagre
- Relationship visualization (FK, inferred)
- Per-schema and global views

**Lineage Graphs (Cytoscape)**
- Source→Target data flow visualization
- Table-level and column-level lineage
- Interactive exploration
- Different node styles for sources vs targets

**Mapping Matrix**
- CSV/HTML export
- One row per target column
- Source path, transforms, and rules
- Searchable and filterable

#### 🗄️ **Multi-Dialect SQL Generation**

**PostgreSQL**
- Standard SQL DDL with constraints
- Foreign key relationships
- Default values and sequences

**Snowflake**
- Type mapping (VARCHAR→STRING, DECIMAL→NUMBER)
- CURRENT_TIMESTAMP() for defaults
- Primary key constraints

**MongoDB**
- JSON Schema validators
- `createCollection` scripts
- Type mapping (INT→int, BIGINT→long, DECIMAL→double/decimal)
- Required field detection (PK + NOT NULL)
- Nullable field support

#### 📊 **Analytics & Tracking**
- Login count tracking
- Validation count
- Generation count
- Usage statistics per user
- Last active timestamp

---

## 🏗️ Architecture

### Project Structure

```
DBDocManager/
├── frontend/                 # React + Vite frontend
│   ├── src/
│   │   ├── pages/           # Page components
│   │   │   ├── Login.tsx
│   │   │   ├── Signup.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── CreateProject.tsx
│   │   │   ├── DataVisualization.tsx
│   │   │   ├── Profile.tsx
│   │   │   └── Visualization.tsx
│   │   ├── components/      # Reusable components
│   │   │   ├── ERDGraph.tsx
│   │   │   ├── LineageGraph.tsx
│   │   │   ├── NavigationHeader.tsx
│   │   │   ├── DbDocPanel.tsx
│   │   │   └── views/
│   │   ├── contexts/        # React contexts
│   │   │   └── ProjectContext.tsx
│   │   ├── services/        # API services
│   │   ├── hooks/           # Custom hooks
│   │   └── lib/             # Utilities
│   ├── public/
│   └── package.json
│
├── backend/                  # Node.js + Express backend
│   ├── src/
│   │   ├── server.ts        # Express app & API routes
│   │   ├── parser.ts        # DSL parser and loader
│   │   ├── validator.ts     # Referential validation
│   │   ├── generator.ts     # ERD, lineage, mapping matrix
│   │   ├── sql_generator.ts # Multi-dialect SQL generation
│   │   ├── auth.ts          # JWT authentication
│   │   ├── db.ts            # SQLite database connection
│   │   ├── migrate.ts       # Database migrations
│   │   └── cli.ts           # CLI tool
│   ├── db/
│   │   ├── schema.sql       # Database schema
│   │   └── dbdoc.db         # SQLite database (generated)
│   ├── schemas/
│   │   └── dbdoc.json       # JSON Schema for DSL
│   ├── docs/                # Generated documentation
│   │   ├── erd/             # Mermaid ERD files
│   │   ├── lineage/         # Lineage JSON
│   │   └── mapping_matrix.csv
│   ├── input.yaml           # Example DSL file
│   └── package.json
│
├── .github/                  # CI/CD workflows
├── DBDocManager.md          # Project requirements
└── README.md                # This file
```

### Technology Stack

#### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + shadcn/ui components
- **Routing:** React Router v6
- **State Management:** Context API + hooks
- **Visualizations:**
  - React Flow (ER Diagrams)
  - Cytoscape.js (Lineage Graphs)
- **Icons:** Lucide React
- **HTTP Client:** Fetch API

#### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** SQLite (better-sqlite3)
- **Authentication:** JWT (jsonwebtoken + bcrypt)
- **Validation:** AJV (JSON Schema)
- **Parsing:** js-yaml
- **Security:** Helmet, CORS
- **Logging:** Morgan

#### Database Schema

```sql
-- Users
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  dsl_content TEXT NOT NULL,
  metadata TEXT,  -- JSON: validation results, parsedData
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Usage Statistics
CREATE TABLE usage_stats (
  user_id INTEGER PRIMARY KEY,
  login_count INTEGER DEFAULT 0,
  validation_count INTEGER DEFAULT 0,
  generation_count INTEGER DEFAULT 0,
  last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm/bun
- **Git** for version control

### Installation

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd DBDocManager
```

#### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create database
npm run migrate

# Start development server
npm run dev
```

Backend will run at `http://localhost:5000`

#### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will run at `http://localhost:5173`

### Quick Start Guide (CLI)

1. **Initialize Project**
   ```bash
   dbdoc init my-project
   cd my-project
   ```

2. **Introspect Database (Optional)**
   ```bash
   # Auto-generate DSL from existing DB
   dbdoc introspect postgres "postgresql://user:pass@localhost/mydb" --out schema.yaml
   ```

3. **Validate DSL**
   ```bash
   dbdoc validate schema.yaml
   ```

4. **Generate Documentation**
   ```bash
   dbdoc generate schema.yaml --out docs
   ```

5. **Serve Documentation**
   ```bash
   dbdoc serve --dir docs
   ```

### Quick Start Guide (Web UI)

1. **Sign Up:** Create an account at `/signup`
2. **Create Project:** Click "New Project" on dashboard
3. **Write DSL:** Use YAML syntax to define your schema (see [DSL Reference](#dsl-reference))
4. **Validate:** Click "Validate DSL" to check for errors
5. **Visualize:** Switch to visualization tab to see ERD, lineage, and mappings
6. **Generate SQL:** Copy generated SQL for your target database
7. **Save:** Project auto-saves on successful validation

---

## 📖 DSL Reference

### Basic Structure

```yaml
project: retail_dw
owners: ["data-eng@company.com"]

targets:
  - db: dw
    engine: postgres
    schema: mart
    tables:
      - name: dim_user
        description: "Master user dimension"
        columns:
          - name: user_id
            type: INTEGER
            pk: true
            description: "Surrogate key"
          - name: email
            type: VARCHAR(320)
            unique: true
            not_null: true

sources:
  - id: mongo_users
    kind: mongodb
    conn: atlas-cluster-A
    db: shop
    collection: users

mappings:
  - target: dw.mart.dim_user.email
    from:
      source_id: mongo_users
      path: $.contact.email
      transform: lower()
```

### DSL Components

#### **Targets** (Relational Tables)

```yaml
targets:
  - db: <database_name>
    engine: postgres | snowflake | mysql
    schema: <schema_name>
    tables:
      - name: <table_name>
        description: "Table description"
        owner: "team@company.com"
        columns:
          - name: <column_name>
            type: <data_type>
            pk: true | false           # Primary key
            not_null: true | false     # NOT NULL constraint
            unique: true | false       # UNIQUE constraint
            default: <default_value>   # Default value
            description: "Column description"
            fk:                        # Foreign key (optional)
              table: <ref_table>
              column: <ref_column>
```

**Supported Types:**
- `INTEGER`, `BIGINT`, `SMALLINT`
- `VARCHAR(n)`, `TEXT`
- `DECIMAL(p,s)`, `NUMERIC`, `DOUBLE`, `FLOAT`
- `TIMESTAMP`, `DATE`, `TIME`
- `BOOLEAN`

#### **Sources** (Data Sources)

```yaml
sources:
  - id: <unique_source_id>
    kind: mongodb | postgres | mysql
    conn: <connection_identifier>
    db: <database_name>
    collection: <collection_name>  # For MongoDB
```

#### **Mappings** (Source→Target Lineage)

```yaml
mappings:
  - target: <db>.<schema>.<table>.<column>
    from:
      source_id: <source_id>
      path: $.json.path              # JSONPath for nested fields
      transform: lower()             # Optional transform
      rule: sequence('seq_name')     # Or generation rule
```

**JSONPath Examples:**
- `$.email` - Top-level field
- `$.contact.email` - Nested field
- `$.address.street` - Nested object
- `$.lines[*]` - Array (will explode)

**Transforms:**
- `lower()` - Lowercase
- `upper()` - Uppercase
- `trim()` - Remove whitespace
- `concat(a, b)` - Concatenate strings

#### **Array/Explode Mappings**

```yaml
mappings:
  - target: dw.mart.fct_order_line.*
    from:
      source_id: mongo_orders
      path: $.lines[*]               # Explode array
      fields:
        order_id: $.order_id
        line_nbr: $index             # Array index
        sku: $.sku
        qty: $.quantity
```

---

## 🔌 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### **POST** `/auth/signup`
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### **POST** `/auth/login`
Authenticate user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": { "id": 1, "email": "user@example.com", "name": "John Doe" }
}
```

#### **GET** `/profile`
Get user profile and statistics.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2025-11-30T00:00:00Z"
  },
  "stats": {
    "login_count": 10,
    "validation_count": 25,
    "generation_count": 15,
    "last_active": "2025-11-30T12:00:00Z"
  }
}
```

### Project Endpoints

#### **POST** `/projects`
Create a new project.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "name": "My Project",
  "dslContent": "project: test\n...",
  "metadata": {}
}
```

#### **GET** `/projects`
List all user projects.

**Headers:** `Authorization: Bearer <token>`

#### **GET** `/projects/:id`
Get project details.

**Headers:** `Authorization: Bearer <token>`

#### **PUT** `/projects/:id`
Update project.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "name": "Updated Name",
  "dslContent": "project: test\n...",
  "metadata": {}
}
```

#### **DELETE** `/projects/:id`
Delete project.

**Headers:** `Authorization: Bearer <token>`

### DSL Processing Endpoints

#### **POST** `/validate`
Validate DSL content.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "yaml": "project: test\ntargets: []\n..."
}
```

**Response:**
```json
{
  "valid": true,
  "ajvErrors": [],
  "referentialErrors": [],
  "referentialWarnings": [
    "Source 'src1' is declared but not referenced"
  ]
}
```

#### **POST** `/generate`
Generate all artifacts (ERD, lineage, mapping matrix, SQL).

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "yaml": "project: test\n..."
}
```

**Response:**
```json
{
  "sql": {
    "postgres": "CREATE TABLE ...",
    "snowflake": "CREATE OR REPLACE TABLE ...",
    "mongodb": "db.createCollection(...)"
  },
  "erd": { "nodes": [...], "edges": [...] },
  "lineage": { "nodes": [...], "edges": [...] },
  "mappingMatrix": "target,source,path,transform\n...",
  "databases": [...],
  "schemas": [...]
}
```

---

## 📘 Usage Guide

### Creating Your First Project

1. **Start Both Servers**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev
   
   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

2. **Sign Up**
   - Navigate to `http://localhost:5173`
   - Click "Sign Up"
   - Enter your details

3. **Create a Project**
   - Click "New Project" on dashboard
   - Enter project name
   - Write your DSL (see examples below)

4. **Validate & Visualize**
   - Click "Validate DSL"
   - View errors/warnings if any
   - Click "View Visualizations" to see ERD and lineage

### Example DSL - Simple Dimension Table

```yaml
project: simple_example
owners: ["you@company.com"]

targets:
  - db: warehouse
    engine: postgres
    schema: public
    tables:
      - name: dim_customer
        description: "Customer dimension table"
        columns:
          - { name: customer_id, type: INTEGER, pk: true }
          - { name: email, type: VARCHAR(255), not_null: true, unique: true }
          - { name: first_name, type: VARCHAR(100), not_null: true }
          - { name: last_name, type: VARCHAR(100), not_null: true }
          - { name: created_at, type: TIMESTAMP, default: "CURRENT_TIMESTAMP" }

sources:
  - id: app_users
    kind: mongodb
    db: app_database
    collection: users

mappings:
  - target: warehouse.public.dim_customer.email
    from:
      source_id: app_users
      path: $.contact.email
      transform: lower()
  - target: warehouse.public.dim_customer.first_name
    from:
      source_id: app_users
      path: $.profile.firstName
  - target: warehouse.public.dim_customer.last_name
    from:
      source_id: app_users
      path: $.profile.lastName
  - target: warehouse.public.dim_customer.customer_id
    from:
      rule: sequence('customer_id_seq')
```

### Example DSL - Fact Table with Array Explode

```yaml
project: order_analytics
owners: ["analytics@company.com"]

targets:
  - db: warehouse
    engine: snowflake
    schema: sales
    tables:
      - name: fct_order_lines
        description: "Order line items fact table"
        columns:
          - { name: order_id, type: STRING, not_null: true }
          - { name: line_number, type: INTEGER, not_null: true }
          - { name: product_sku, type: STRING, not_null: true }
          - { name: quantity, type: NUMBER(10,0), not_null: true }
          - { name: unit_price, type: NUMBER(15,2), not_null: true }
          - { name: line_total, type: NUMBER(15,2), not_null: true }

sources:
  - id: mongo_orders
    kind: mongodb
    db: ecommerce
    collection: orders

mappings:
  - target: warehouse.sales.fct_order_lines.*
    from:
      source_id: mongo_orders
      path: $.items[*]              # Explode array
      fields:
        order_id: $.order_id
        line_number: $index
        product_sku: $.sku
        quantity: $.qty
        unit_price: $.price
        line_total: $.total
```

---

## 🛠️ Development

### Development Workflow

1. **Feature Development**
   - Create feature branch: `git checkout -b feature/my-feature`
   - Make changes with hot reload active
   - Test locally

2. **Code Style**
   - Frontend: ESLint + Prettier (configured)
   - Backend: TypeScript strict mode
   - Use meaningful variable names
   - Add comments for complex logic

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin feature/my-feature
   ```

4. **Pull Request**
   - Create PR on GitHub
   - Wait for CI checks (when implemented)
   - Get code review
   - Merge to main

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Coverage report
npm run test:coverage
```

### Building for Production

```bash
# Frontend build
cd frontend
npm run build
# Output: frontend/dist/

# Backend build
cd backend
npm run build
# Output: backend/dist/
```

### Environment Variables

**Backend `.env`:**
```env
PORT=5000
JWT_SECRET=your_secret_key_here
DATABASE_PATH=./db/dbdoc.db
NODE_ENV=development
```

**Frontend `.env`:**
```env
VITE_API_URL=http://localhost:5000
```

---

##✅ Testing

### Test Structure

```
backend/src/__tests__/
├── parser.test.ts        # DSL parsing tests
├── validator.test.ts     # Validation logic tests
├── generator.test.ts     # Generation tests
├── sql_generator.test.ts # SQL generation tests
└── api.test.ts           # API endpoint tests

frontend/src/components/__tests__/
├── ERDGraph.test.tsx
├── LineageGraph.test.tsx
└── NavigationHeader.test.tsx
```

### Running Tests

```bash
# Run all backend tests
cd backend && npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test parser.test.ts
```

### Manual Testing Checklist

- [ ] User signup/login works
- [ ] Project creation/update/delete works
- [ ] DSL validation shows errors correctly
- [ ] ER diagram renders all tables
- [ ] Lineage graph shows source→target flow
- [ ] SQL generation produces valid SQL
- [ ] All database dialects generate correctly

---

## 🔄 CI/CD Integration

### GitHub Actions

The project includes automated DSL validation via GitHub Actions. The workflow runs on:
- Pull requests affecting `.yaml`, `.yml`, or `.dbdoc` files
- Pushes to `main` or `master` branches
- Changes to backend source code or schemas

**Workflow file:** [`.github/workflows/validate-dsl.yml`](file:///home/batman/Desktop/antigravity/GLS/.github/workflows/validate-dsl.yml)

**What it does:**
1. Checks out the repository
2. Sets up Node.js 18
3. Installs dependencies
4. Runs `npm run validate:ci`
5. Comments on PR if validation fails

### Local Validation

```bash
# Validate all DSL files in current directory
cd backend
npm run validate

# CI mode (strict - fails on warnings)
npm run validate:ci

# Validate specific directory
npx tsx src/cli.ts validate --dir path/to/dsl/files
```

### Exit Codes

- `0` - Validation successful
- `1` - Unknown command or missing arguments
- `2` - Missing required argument
- `3` - No DSL files found
- `4` - Validation failed (structure or referential errors)
- `99` - Fatal CLI error

### GitLab CI

For GitLab users, see [`.gitlab-ci.example.yml`](file:///home/batman/Desktop/antigravity/GLS/.gitlab-ci.example.yml) for an example configuration.

```yaml
validate-dsl:
  stage: validate
  image: node:18
  before_script:
    - cd backend
    - npm ci
  script:
    - npm run validate:ci
  only:
    changes:
      - "**.yaml"
      - "backend/src/**"
```

### Pre-commit Hooks

To validate DSL files before committing:

**Option 1: Using Husky**

```bash
# Install husky
npm install --save-dev husky
npx husky init

# Create pre-commit hook
echo "cd backend && npm run validate" > .husky/pre-commit
chmod +x .husky/pre-commit
```

**Option 2: Manual Git Hook**

```bash
# Create .git/hooks/pre-commit
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
cd backend && npm run validate || {
  echo "❌ DSL validation failed. Fix errors before committing."
  exit 1
}
EOF
chmod +x .git/hooks/pre-commit
```

### Continuous Deployment

Once validation passes, you can add deployment steps:

```yaml
# Add to .github/workflows/validate-dsl.yml

deploy-docs:
  needs: validate-dsl
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: |
        cd backend
        npm ci
        npm run generate
    - uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./backend/docs
```

---

## 🚢 Deployment

### Production Deployment

#### Backend (Node.js Server)

**Option 1: Docker**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["node", "dist/server.js"]
EXPOSE 5000
```

**Option 2: PM2**
```bash
npm install -g pm2
cd backend
npm run build
pm2 start dist/server.js --name dbdoc-backend
```

#### Frontend (Static Site)

**Option 1: Netlify/Vercel**
```bash
cd frontend
npm run build
# Deploy dist/ folder to Netlify/Vercel
```

**Option 2: GitHub Pages**
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd frontend && npm install && npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./frontend/dist
```

### Database Migration

```bash
# Run migrations
cd backend
npm run migrate

# Backup database
cp db/dbdoc.db db/dbdoc.backup.db
```

---

## 🗺️ Roadmap

### ✅ Completed (v2.2)
- [x] User authentication & authorization
- [x] Project CRUD operations
- [x] DSL parser & validator
- [x] Multi-dialect SQL generation
- [x] ER diagram visualization (React Flow)
- [x] Lineage graph visualization (Cytoscape)
- [x] Mapping matrix export
- [x] User analytics & tracking
- [x] Responsive UI with dark mode

### 🚧 In Progress (v2.3 - Phase 1: P0)
- [ ] CI/CD integration with GitHub Actions
- [ ] Automated testing suite (80%+ coverage)
- [ ] Static HTML documentation site generator
- [ ] CLI validation command with exit codes

### 📋 Planned (v3.0 - Phase 2: P1)
- [ ] Transform library (lower, upper, concat, etc.)
- [ ] Enhanced CLI tool (init, validate, generate, serve)
- [ ] Transform validation and execution

### 🔮 Future (v4.0+ - Phase 3: P2-P3)
- [ ] Database introspection (PostgreSQL, MongoDB, Snowflake)
- [ ] Version control & change tracking
- [ ] Data governance & PII detection
- [ ] Multi-user collaboration
- [ ] Advanced visualizations (impact analysis)
- [ ] dbt integration
- [ ] Data catalog sync (Alation, Atlan)

See [`implementation_plan.md`](./implementation_plan.md) for detailed roadmap.

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Reporting Bugs

1. Check if the bug is already reported in Issues
2. Create a new issue with:
   - Clear title
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Environment details (OS, Node version, browser)

### Suggesting Features

1. Open an issue with "Feature Request" label
2. Describe the feature and use case
3. Discuss implementation approach

### Code Contributions

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes with tests
4. Commit changes (`git commit -m 'feat: add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open Pull Request

### Development Setup

See [Development](#development) section for setup instructions.

### Code Style Guidelines

- Use TypeScript strict mode
- Follow existing code patterns
- Add comments for complex logic
- Write unit tests for new features
- Update documentation

---

## 📄 License

MIT License - see LICENSE file for details

---

## 👥 Team

**Created by IIITH Students (2025):**
- **Vinit Jain** - [@jainvinit0302](https://github.com/jainvinit0302)
- **Rinkesh Verma**
- **Kedar Dalvi**
- **Jagadish Kollu**
- **Suresh Kumar**

**Contact:** saianirudh.karre@iiit.ac.in

---

## 📚 Additional Resources

- [DSL Specification](./backend/schemas/dbdoc.json) - JSON Schema for DSL
- [Example DSL](./backend/input.yaml) - Sample YAML file
- [API Reference](#api-documentation) - Complete API docs
- [Implementation Plan](./implementation_plan.md) - Detailed roadmap
- [Progress Report](./progress_report.md) - Current status

---

## 🙏 Acknowledgments

- React Flow for ER diagram visualization
- Cytoscape.js for lineage graphs
- shadcn/ui for beautiful UI components
- AJV for JSON Schema validation
- The open-source community

---

**⭐ If this project helps you, please consider giving it a star!**

---

*Last Updated: 2025-11-30 | Version 2.2*
