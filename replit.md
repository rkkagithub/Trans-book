# TransBook - Transport Management System

## Overview

TransBook is a comprehensive transport management application designed for commission agents and logistics companies. The system provides complete business management capabilities including customer management, vehicle tracking, driver management, trip scheduling, invoice generation, and business analytics. Built as a full-stack web application with a modern tech stack, it offers both desktop and mobile-responsive interfaces for managing transport operations efficiently.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development practices
- **Routing**: Wouter for lightweight client-side routing without the overhead of React Router
- **State Management**: TanStack Query (React Query) for server state management, caching, and synchronization
- **UI Framework**: Tailwind CSS with Radix UI components for accessible, customizable design system
- **Form Management**: React Hook Form with Zod validation for robust form handling and client-side validation
- **Build Tool**: Vite for fast development builds and hot module replacement
- **Component Library**: Shadcn/ui components built on Radix primitives for consistent, accessible UI

### Backend Architecture
- **Runtime**: Node.js with Express.js framework for RESTful API development
- **Language**: TypeScript for type safety across the entire stack
- **Database ORM**: Drizzle ORM for type-safe database operations with PostgreSQL
- **Session Management**: Express sessions with PostgreSQL storage for persistent user sessions
- **API Design**: RESTful architecture with organized route handlers and middleware

### Authentication System
- **Provider**: Replit Auth integration using OpenID Connect (OIDC) protocol
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **Security**: HTTP-only cookies with secure session management
- **Authorization**: Role-based access control with user context throughout the application

### Database Architecture
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **Schema Management**: Drizzle Kit for migrations and schema evolution
- **Data Models**: Comprehensive schema covering users, customers, vehicles, drivers, trips, invoices, and expenses
- **Relationships**: Proper foreign key relationships with user-scoped data isolation
- **Performance**: Indexed queries and efficient data fetching patterns

### Project Structure
- **Monorepo Layout**: Organized with shared types and schemas across client/server boundaries
- **Client Directory**: Contains React frontend application with organized component structure
- **Server Directory**: Houses Express backend with modular route handlers and services
- **Shared Directory**: Common TypeScript types and Zod schemas for consistent data validation

### Development Workflow
- **Hot Reload**: Vite development server with instant feedback for frontend changes
- **Type Safety**: End-to-end TypeScript coverage from database to UI components
- **Code Organization**: Feature-based organization with reusable components and hooks
- **Build Process**: Optimized production builds with code splitting and asset optimization

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL hosting with connection pooling and automatic scaling
- **Connection Management**: @neondatabase/serverless driver with WebSocket support for serverless environments

### Authentication & Session Management
- **Replit Auth**: OpenID Connect integration for user authentication
- **Session Store**: connect-pg-simple for PostgreSQL-backed session persistence
- **Identity Provider**: Replit's OIDC service for user identity and profile management

### UI & Design System
- **Radix UI**: Comprehensive set of accessible React components including dialogs, dropdowns, forms, and navigation
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens and responsive design
- **Lucide Icons**: Modern icon library with React components
- **Framer Motion**: Animation library for smooth UI transitions and micro-interactions

### Development & Build Tools
- **Vite**: Build tool with fast HMR, code splitting, and optimized production builds
- **Replit Integration**: Custom Vite plugins for Replit-specific development features and error handling
- **TypeScript**: Static type checking across the entire application stack
- **PostCSS**: CSS processing with Tailwind CSS and autoprefixer

### Data Management & Validation
- **Drizzle ORM**: Type-safe database toolkit with schema management and query building
- **Zod**: Runtime type validation and schema definition library
- **TanStack Query**: Server state management with caching, background updates, and optimistic updates
- **React Hook Form**: Performant form library with minimal re-renders and validation integration

### Utility Libraries
- **date-fns**: Date manipulation and formatting utilities
- **clsx & tailwind-merge**: Class name utilities for conditional styling
- **class-variance-authority**: Component variant management for consistent styling patterns