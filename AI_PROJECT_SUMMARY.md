# Stage 2026 — Full-Stack AI Productivity Platform

## 1. Project Overview

This project realizes a complete AI-driven productivity ecosystem that connects a desktop app, a web application, a mobile interface, and a PostgreSQL-backed backend into a single operational system.

The goal was to build more than a simple task manager. The platform combines daily productivity, AI-assisted planning, semantic document search, automated reminders, project collaboration, and desktop file intelligence inside one environment. Users can manage tasks, events, reminders, projects, places, and files either through standard CRUD workflows or through natural-language interactions with multiple AI agents.

The system is designed to work across three interfaces:

- Web frontend for workspace management and AI chat
- Electron desktop shell for local file ingestion and native OS integration
- React Native mobile app for quick access on the go

All three interfaces share the same backend services, business logic, and database model.

---

## 2. What the Project Realizes

The project is a practical implementation of an intelligent personal and team productivity assistant.

It includes:

- Task management with priorities, urgency, recurrence, and hierarchical relationships
- Calendar management with events and schedule-aware logic
- Reminder engines with warning windows and snoozing
- Location-based place management with map-ready metadata
- Project collaboration features with memberships and comments
- AI chat orchestration for natural-language task and event operations
- File indexing and semantic document retrieval across uploaded and monitored folders
- Observability for agent performance, retrieval quality, and system analytics
- Multi-platform synchronization through a shared backend API

In short, the project turns a normal productivity app into an AI-enhanced operating layer for personal planning, knowledge access, and document-aware workflows.

---

## 3. Main Functional Domains

### 3.1 Productivity Management

The core productivity layer includes:

- Users and devices
- Tasks with hierarchy, status, priority, urgency, recurrence, AI scoring, and due dates
- Events with time ranges, color coding, and repeat rules
- Reminders with snooze, warnings, and wake-up triggers
- Places with geographic metadata and context
- Projects, memberships, task assignment, comments, and activity logging

This part of the system acts as the operational backbone of the platform. It handles everyday work planning in a structured and queryable database model.

### 3.2 AI Chat and Multi-Agent Orchestration

The backend includes an orchestrator-driven multi-agent system. User intent is interpreted by an AI orchestrator, which then routes requests to specialized agents:

- Task agent
- Event agent
- Place agent
- File agent
- Memory agent
- Desktop agent
- General agent
- Voice agent

This allows the user to speak naturally, for example:

- “Create a meeting tomorrow at 4 PM”
- “Add a task for project launch and remind me 30 minutes before”
- “Find the files about onboarding”
- “What tasks are due this week?”

The AI does not directly execute unsafe operations. Instead, it routes validated commands into a tools layer that performs controlled database updates and queries.

### 3.3 Semantic File Intelligence

The file pipeline is one of the most important parts of the system. The platform can:

- index local folders from the desktop app
- scan documents in monitored folders
- extract text from PDF, DOCX, TXT, and CSV files
- split content into chunks
- generate embeddings for semantic retrieval
- store per-file metadata and extracted entities
- query documents using hybrid semantic + keyword search

This makes the app more than a note app or task app: it becomes a personal knowledge layer connected to user files.

### 3.4 Knowledge Retrieval and Memory

The retrieval system searches across multiple knowledge sources:

- documents
- memories
- conversations
- tasks
- projects
- events

This allows the assistant to provide grounded answers based not only on static files but also on user activity and historical context.

### 3.5 Scheduler and Automation

The project includes a scheduler that runs recurring background checks for:

- reminder warnings
- reminder delivery
- due task notifications
- recurring task generation
- recurring event generation
- overdue task alerts

This creates a practical automation loop without needing constant manual actions from the user.

---

## 4. System Architecture

The application is structured in four major layers:

### 4.1 Frontend Layer

The frontend is a React application built for the web. It includes dashboards, forms, data tables, agent chat, file management, calendar views, search, notifications, and user flows for all major features.

It uses:

- React for UI composition
- Vite for fast local development
- TailwindCSS for styling
- React Query for API state management
- Zustand for local app state such as auth
- Axios for backend communication

### 4.2 Desktop Layer

The Electron shell adds desktop-native capabilities such as:

- folder selection dialogs
- real filesystem scanning
- document indexing from local folders
- live file watching with chokidar
- in-app access to file processing and search

This allows the app to behave like a real desktop assistant instead of a browser-only tool.

### 4.3 Backend Layer

The backend is built with Express and PostgreSQL. It exposes APIs for:

- authentication
- CRUD access to the data model
- AI agents and orchestration
- document ingestion and indexing
- retrieval and evaluation
- monitoring and metrics
- scheduler events and notifications

The backend acts as the centralized system of record for the whole application.

### 4.4 Mobile Layer

The mobile app is built with Expo / React Native and mirrors the core platform experience on smaller screens.

It supports access to tasks, notifications, reminders, files, and core system features while staying connected to the same backend APIs.

---

## 5. Project Modules and Responsibilities

### 5.1 Frontend

The frontend implements the main user experience:

- dashboard overview
- task views
- reminder management
- event screens
- projects pages
- chat with AI agents
- voice interface
- global search
- file dashboard with filters and folder monitoring
- notification center
- observability pages for AI system metrics

### 5.2 Backend Services

The backend contains several functional groups:

- authentication routes
- CRUD APIs for database tables
- agent orchestration routes
- monitoring routes
- evaluation routes
- scheduler setup
- file/document pipeline
- retrieval logic
- PostgreSQL access layer

### 5.3 Desktop File Pipeline

This includes:

- file scanning
- reading supported formats
- chunking large text into manageable pieces
- embedding generation
- metadata persistence
- live watcher integration
- document-based search and semantic lookup

### 5.4 Data Layer

The database stores all the information needed for planning and AI retrieval:

- user and device identity
- tasks, events, places, reminders
- project metadata and collaboration
- file metadata and indexed documents
- agent metrics and logs
- evaluation data
- memory embeddings and retrieval logs

---

## 6. Database Model and Design

The project uses PostgreSQL with a schema designed around productivity, AI workflows, and document intelligence.

Main tables include:

- users
- devices
- tasks
- calendar_events
- reminders
- places
- geofences
- files
- indexed_folders
- document_embeddings
- conversations
- ai_memories
- agent_metrics
- projects
- project_memberships
- task_assignments
- comments
- activity_log
- tags and entity_tags
- saved_views
- scheduled_jobs
- evaluation_logs
- retrieval_logs
- entity_relationships

This schema supports both relational structure and AI-driven retrieval patterns.

---

## 7. Document and File Intelligence Flow

A major strategic feature of the project is the use of documents as knowledge sources.

The flow works like this:

1. A folder is selected in the desktop or web app.
2. Files are scanned and metadata is stored.
3. Supported files are read and text is extracted.
4. The extracted text is chunked.
5. Embeddings are generated and stored.
6. The system stores file metadata and extracted entities.
7. User queries can retrieve relevant chunks using semantic search.
8. Answers can be grounded in files, memory, reminders, tasks, and historical activity.

This gives the assistant a real knowledge base connected to the user’s documents.

---

## 8. AI Retrieval and Reasoning

The project combines retrieval and orchestration rather than relying on a single monolithic prompt.

The system can:

- classify user intent
- detect time references using temporal parsing
- route to the correct agent
- fetch relevant context from multiple sources
- merge results and reject low-confidence responses
- record metrics for each call

This creates a more structured and safer AI architecture than a direct “chat-to-database” approach.

---

## 9. Business Value of the Project

This project is valuable because it combines several modern software patterns in a single product:

- productivity management
- AI-assisted work execution
- document intelligence
- multi-platform access
- structured operational data model
- event-driven automation
- observability and evaluation

It is not only a demo app. It is a real software architecture for building an AI operating assistant that supports work organization, memory, document grounding, and proactive reminders.

---

## 10. Current State and Development Reality

The codebase already includes the core components for:

- web frontend
- backend API and agent system
- desktop integration
- mobile app shell
- database schema and logic
- scheduler logic
- file ingestion and retrieval
- multi-agent orchestration

The project is best understood as a full-stack prototype / advanced application foundation with many production-oriented features implemented. Some parts still need operational hardening, especially around database reset/re-run behavior, extension handling, and deployment configuration, but the overall architecture is already substantially realized.

---

## 11. Final Summary

This project realizes a cross-platform AI productivity platform that integrates personal organization, natural-language AI actions, file intelligence, semantic retrieval, and system automation into one cohesive product.

It is a complete example of how a modern AI application can combine:

- structured backend data services
- multi-agent reasoning
- desktop and mobile user experiences
- semantic knowledge retrieval
- file-based document intelligence
- scheduling and reminder automation
- observability and evaluation mechanisms

The result is a practical AI work assistant designed to support real-world planning, document understanding, and decision support across multiple devices.
