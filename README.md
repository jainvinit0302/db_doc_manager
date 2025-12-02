# DBDocManager

**DSL-driven Database Documentation & Data Lineage Management Platform**

> Transform complex database schemas into beautiful, interactive documentation with automatic lineage tracking and multi-dialect SQL generation.

[![Version](https://img.shields.io/badge/version-2.2-blue.svg)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Created by:** Vinit Jain, Rinkesh Verma, Kedar Dalvi, Jagadish Kollu & Suresh Kumar - IIITH Students | 2025

---

## 🎯 Overview

**DBDocManager** provides a lightweight **Domain-Specific Language (DSL)** to describe database schemas and mappings, then automatically generates:

- 📖 **Human-readable documentation**
- 🎨 **Interactive ER Diagrams** (React Flow)
- 🔗 **Data Lineage Graphs** (Cytoscape)
- 📊 **Mapping Matrices** (CSV/HTML)
- 🗄️ **Multi-dialect SQL** (PostgreSQL, Snowflake, MongoDB)

---

## ✨ Features

- 🔐 User authentication & project management
- 📝 YAML-based DSL with real-time validation
- ✅ Structural & referential validation
- 🔍 Database introspection (PostgreSQL, MongoDB)
- 🛠️ Enhanced CLI (init, validate, generate, serve, introspect)
- ⚡ Transform library (string, date, math functions)
- 🎨 Interactive visualizations
- 🗄️ Multi-dialect SQL generation

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm/bun
- **Git**

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

Backend runs at `http://localhost:4000`

#### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at `http://localhost:8080`

### Quick Start (CLI)

```bash
# Initialize project
dbdoc init my-project
cd my-project

# Introspect existing database (optional)
dbdoc introspect postgres "postgresql://user:pass@localhost/mydb" --out schema.yaml

# Validate DSL
dbdoc validate schema.yaml

# Generate documentation
dbdoc generate schema.yaml --out docs

# Serve documentation
dbdoc serve --dir docs
```

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

### Key Components

**Targets (Relational Tables):**

```yaml
targets:
  - db: <database_name>
    engine: postgres | snowflake | mysql
    schema: <schema_name>
    tables:
      - name: <table_name>
        columns:
          - name: <column_name>
            type: <data_type>
            pk: true | false
            not_null: true | false
            unique: true | false
```

**Sources (Data Sources):**

```yaml
sources:
  - id: <unique_source_id>
    kind: mongodb | postgres | mysql
    db: <database_name>
    collection: <collection_name>
```

**Mappings (Source→Target):**

```yaml
mappings:
  - target: <db>.<schema>.<table>.<column>
    from:
      source_id: <source_id>
      path: $.json.path
      transform: lower()
```

---

## 🔌 API Documentation

### Base URL

```
http://localhost:4000/api
```

### Key Endpoints

**Authentication:**

- `POST /auth/signup` - Register new user
- `POST /auth/login` - Login
- `GET /profile` - Get user profile

**Projects:**

- `POST /projects` - Create project
- `GET /projects` - List projects
- `GET /projects/:id` - Get project
- `PUT /projects/:id` - Update project
- `DELETE /projects/:id` - Delete project

**DSL Processing:**

- `POST /validate` - Validate DSL
- `POST /generate` - Generate artifacts

---

## 🛠️ Development

### Build for Production

```bash
# Frontend build
cd frontend && npm run build

# Backend build
cd backend && npm run build
```

### Environment Variables

**Backend `.env`:**

```env
PORT=4000
JWT_SECRET=your_secret_key_here
DATABASE_PATH=./db/dbdoc.db
```

**Frontend `.env`:**

```env
VITE_DBDOC_API_BASE=http://localhost:4000
```

---

## 📄 License

MIT License - see LICENSE file for details

---

## 👥 Team

**Created by IIITH Students (2025):**

- Vinit Jain - [@jainvinit0302](https://github.com/jainvinit0302)
- Rinkesh Verma
- Kedar Dalvi
- Jagadish Kollu
- Suresh Kumar

---

**⭐ If this project helps you, please consider giving it a star!**

---

*Last Updated: 2025-12-02 | Version 2.2*
