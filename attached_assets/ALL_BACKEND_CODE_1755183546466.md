# TransBook - Complete Backend Code

This file contains all the backend Node.js/Express components for the TransBook transport management application.

## Table of Contents
1. [Server Entry Point](#server-entry-point)
2. [Database Configuration](#database-configuration)
3. [Authentication System](#authentication-system)
4. [API Routes](#api-routes)
5. [Storage Layer](#storage-layer)
6. [Database Schema](#database-schema)
7. [Development Server](#development-server)
8. [Configuration Files](#configuration-files)

---

## Server Entry Point

### `server/index.ts`
```typescript
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Setup Vite in development, serve static files in production
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Start server on specified port (default 5000)
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
```

---

## Database Configuration

### `server/db.ts`
```typescript
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon for serverless WebSocket support
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create connection pool and initialize Drizzle ORM
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
```

---

## Authentication System

### `server/replitAuth.ts`
```typescript
import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

// Memoized OIDC configuration for performance
const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

// PostgreSQL session store configuration
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

// Update user session with token information
function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

// Create or update user in database
async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

// Setup authentication middleware and routes
export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  // Passport verify function
  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Setup strategies for each domain
  for (const domain of process.env.REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // Authentication routes
  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

// Authentication middleware
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  // Token refresh logic
  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
```

---

## API Routes

### `server/routes.ts`
```typescript
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertCustomerSchema,
  insertVehicleSchema,
  insertDriverSchema,
  insertTripSchema,
  insertInvoiceSchema,
  insertTransactionSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication middleware
  await setupAuth(app);

  // =================== AUTHENTICATION ROUTES ===================
  
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // =================== DASHBOARD ROUTES ===================

  app.get("/api/dashboard/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getDashboardStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // =================== CUSTOMER ROUTES ===================

  // Get all customers
  app.get("/api/customers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const customers = await storage.getCustomers(userId);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  // Get single customer
  app.get("/api/customers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const customer = await storage.getCustomer(req.params.id, userId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  // Create customer
  app.post("/api/customers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(customerData, userId);
      res.status(201).json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  // Update customer
  app.put("/api/customers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const customerData = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(req.params.id, customerData, userId);
      res.json(customer);
    } catch (error) {
      console.error("Error updating customer:", error);
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  // Delete customer
  app.delete("/api/customers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteCustomer(req.params.id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // =================== VEHICLE ROUTES ===================

  // Get all vehicles
  app.get("/api/vehicles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const vehicles = await storage.getVehicles(userId);
      res.json(vehicles);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      res.status(500).json({ message: "Failed to fetch vehicles" });
    }
  });

  // Create vehicle
  app.post("/api/vehicles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const vehicleData = insertVehicleSchema.parse(req.body);
      const vehicle = await storage.createVehicle(vehicleData, userId);
      res.status(201).json(vehicle);
    } catch (error) {
      console.error("Error creating vehicle:", error);
      res.status(500).json({ message: "Failed to create vehicle" });
    }
  });

  // Update vehicle
  app.put("/api/vehicles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const vehicleData = insertVehicleSchema.partial().parse(req.body);
      const vehicle = await storage.updateVehicle(req.params.id, vehicleData, userId);
      res.json(vehicle);
    } catch (error) {
      console.error("Error updating vehicle:", error);
      res.status(500).json({ message: "Failed to update vehicle" });
    }
  });

  // Delete vehicle
  app.delete("/api/vehicles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteVehicle(req.params.id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      res.status(500).json({ message: "Failed to delete vehicle" });
    }
  });

  // =================== DRIVER ROUTES ===================

  // Get all drivers
  app.get("/api/drivers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const drivers = await storage.getDrivers(userId);
      res.json(drivers);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      res.status(500).json({ message: "Failed to fetch drivers" });
    }
  });

  // Create driver
  app.post("/api/drivers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const driverData = insertDriverSchema.parse(req.body);
      const driver = await storage.createDriver(driverData, userId);
      res.status(201).json(driver);
    } catch (error) {
      console.error("Error creating driver:", error);
      res.status(500).json({ message: "Failed to create driver" });
    }
  });

  // Update driver
  app.put("/api/drivers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const driverData = insertDriverSchema.partial().parse(req.body);
      const driver = await storage.updateDriver(req.params.id, driverData, userId);
      res.json(driver);
    } catch (error) {
      console.error("Error updating driver:", error);
      res.status(500).json({ message: "Failed to update driver" });
    }
  });

  // Delete driver
  app.delete("/api/drivers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteDriver(req.params.id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting driver:", error);
      res.status(500).json({ message: "Failed to delete driver" });
    }
  });

  // =================== TRIP ROUTES ===================

  // Get all trips
  app.get("/api/trips", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const trips = await storage.getTrips(userId);
      res.json(trips);
    } catch (error) {
      console.error("Error fetching trips:", error);
      res.status(500).json({ message: "Failed to fetch trips" });
    }
  });

  // Get active trips
  app.get("/api/trips/active", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const trips = await storage.getActiveTrips(userId);
      res.json(trips);
    } catch (error) {
      console.error("Error fetching active trips:", error);
      res.status(500).json({ message: "Failed to fetch active trips" });
    }
  });

  // Create trip
  app.post("/api/trips", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tripData = insertTripSchema.parse(req.body);
      const trip = await storage.createTrip(tripData, userId);
      res.status(201).json(trip);
    } catch (error) {
      console.error("Error creating trip:", error);
      res.status(500).json({ message: "Failed to create trip" });
    }
  });

  // Update trip
  app.put("/api/trips/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tripData = insertTripSchema.partial().parse(req.body);
      const trip = await storage.updateTrip(req.params.id, tripData, userId);
      res.json(trip);
    } catch (error) {
      console.error("Error updating trip:", error);
      res.status(500).json({ message: "Failed to update trip" });
    }
  });

  // Delete trip
  app.delete("/api/trips/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteTrip(req.params.id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting trip:", error);
      res.status(500).json({ message: "Failed to delete trip" });
    }
  });

  // =================== INVOICE ROUTES ===================

  // Get all invoices
  app.get("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const invoices = await storage.getInvoices(userId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // Create invoice
  app.post("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const invoiceData = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(invoiceData, userId);
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Update invoice
  app.put("/api/invoices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const invoiceData = insertInvoiceSchema.partial().parse(req.body);
      const invoice = await storage.updateInvoice(req.params.id, invoiceData, userId);
      res.json(invoice);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  // Delete invoice
  app.delete("/api/invoices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteInvoice(req.params.id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // =================== TRANSACTION ROUTES ===================

  // Get all transactions
  app.get("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transactions = await storage.getTransactions(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Create transaction
  app.post("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transactionData = insertTransactionSchema.parse(req.body);
      const transaction = await storage.createTransaction(transactionData, userId);
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
```

---

## Storage Layer

### `server/storage.ts`
```typescript
import {
  users,
  customers,
  vehicles,
  drivers,
  trips,
  invoices,
  transactions,
  type User,
  type UpsertUser,
  type Customer,
  type InsertCustomer,
  type CustomerWithTransactions,
  type Vehicle,
  type InsertVehicle,
  type Driver,
  type InsertDriver,
  type Trip,
  type InsertTrip,
  type TripWithDetails,
  type Invoice,
  type InsertInvoice,
  type InvoiceWithDetails,
  type Transaction,
  type InsertTransaction,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, sum } from "drizzle-orm";

// Storage interface defining all operations
export interface IStorage {
  // User operations (IMPORTANT - mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Customer operations
  getCustomers(userId: string): Promise<CustomerWithTransactions[]>;
  getCustomer(id: string, userId: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer, userId: string): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>, userId: string): Promise<Customer>;
  deleteCustomer(id: string, userId: string): Promise<void>;
  
  // Vehicle operations
  getVehicles(userId: string): Promise<Vehicle[]>;
  getVehicle(id: string, userId: string): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle, userId: string): Promise<Vehicle>;
  updateVehicle(id: string, vehicle: Partial<InsertVehicle>, userId: string): Promise<Vehicle>;
  deleteVehicle(id: string, userId: string): Promise<void>;
  
  // Driver operations
  getDrivers(userId: string): Promise<Driver[]>;
  getDriver(id: string, userId: string): Promise<Driver | undefined>;
  createDriver(driver: InsertDriver, userId: string): Promise<Driver>;
  updateDriver(id: string, driver: Partial<InsertDriver>, userId: string): Promise<Driver>;
  deleteDriver(id: string, userId: string): Promise<void>;
  
  // Trip operations
  getTrips(userId: string): Promise<TripWithDetails[]>;
  getTrip(id: string, userId: string): Promise<TripWithDetails | undefined>;
  createTrip(trip: InsertTrip, userId: string): Promise<Trip>;
  updateTrip(id: string, trip: Partial<InsertTrip>, userId: string): Promise<Trip>;
  deleteTrip(id: string, userId: string): Promise<void>;
  getActiveTrips(userId: string): Promise<TripWithDetails[]>;
  
  // Invoice operations
  getInvoices(userId: string): Promise<InvoiceWithDetails[]>;
  getInvoice(id: string, userId: string): Promise<InvoiceWithDetails | undefined>;
  createInvoice(invoice: InsertInvoice, userId: string): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>, userId: string): Promise<Invoice>;
  deleteInvoice(id: string, userId: string): Promise<void>;
  
  // Transaction operations
  getTransactions(userId: string): Promise<Transaction[]>;
  getTransaction(id: string, userId: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction, userId: string): Promise<Transaction>;
  updateTransaction(id: string, transaction: Partial<InsertTransaction>, userId: string): Promise<Transaction>;
  deleteTransaction(id: string, userId: string): Promise<void>;
  
  // Dashboard operations
  getDashboardStats(userId: string): Promise<{
    totalRevenue: number;
    activeTrips: number;
    pendingPayments: number;
    availableVehicles: number;
    totalVehicles: number;
  }>;
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  // =================== USER OPERATIONS ===================
  // (IMPORTANT - mandatory for Replit Auth)
  
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // =================== CUSTOMER OPERATIONS ===================

  async getCustomers(userId: string): Promise<CustomerWithTransactions[]> {
    const result = await db
      .select({
        customer: customers,
        transactions: transactions,
      })
      .from(customers)
      .leftJoin(transactions, eq(customers.id, transactions.customerId))
      .where(eq(customers.userId, userId))
      .orderBy(desc(customers.createdAt));

    // Group transactions by customer
    const customerMap = new Map<string, CustomerWithTransactions>();
    
    for (const row of result) {
      if (!customerMap.has(row.customer.id)) {
        customerMap.set(row.customer.id, {
          ...row.customer,
          transactions: [],
        });
      }
      
      if (row.transactions) {
        customerMap.get(row.customer.id)!.transactions.push(row.transactions);
      }
    }

    return Array.from(customerMap.values());
  }

  async getCustomer(id: string, userId: string): Promise<Customer | undefined> {
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.userId, userId)));
    return customer;
  }

  async createCustomer(customer: InsertCustomer, userId: string): Promise<Customer> {
    const [newCustomer] = await db
      .insert(customers)
      .values({ ...customer, userId })
      .returning();
    return newCustomer;
  }

  async updateCustomer(id: string, customer: Partial<InsertCustomer>, userId: string): Promise<Customer> {
    const [updatedCustomer] = await db
      .update(customers)
      .set({ ...customer, updatedAt: new Date() })
      .where(and(eq(customers.id, id), eq(customers.userId, userId)))
      .returning();
    return updatedCustomer;
  }

  async deleteCustomer(id: string, userId: string): Promise<void> {
    await db
      .delete(customers)
      .where(and(eq(customers.id, id), eq(customers.userId, userId)));
  }

  // =================== VEHICLE OPERATIONS ===================

  async getVehicles(userId: string): Promise<Vehicle[]> {
    return await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.userId, userId))
      .orderBy(desc(vehicles.createdAt));
  }

  async getVehicle(id: string, userId: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db
      .select()
      .from(vehicles)
      .where(and(eq(vehicles.id, id), eq(vehicles.userId, userId)));
    return vehicle;
  }

  async createVehicle(vehicle: InsertVehicle, userId: string): Promise<Vehicle> {
    const [newVehicle] = await db
      .insert(vehicles)
      .values({ ...vehicle, userId })
      .returning();
    return newVehicle;
  }

  async updateVehicle(id: string, vehicle: Partial<InsertVehicle>, userId: string): Promise<Vehicle> {
    const [updatedVehicle] = await db
      .update(vehicles)
      .set({ ...vehicle, updatedAt: new Date() })
      .where(and(eq(vehicles.id, id), eq(vehicles.userId, userId)))
      .returning();
    return updatedVehicle;
  }

  async deleteVehicle(id: string, userId: string): Promise<void> {
    await db
      .delete(vehicles)
      .where(and(eq(vehicles.id, id), eq(vehicles.userId, userId)));
  }

  // =================== DRIVER OPERATIONS ===================

  async getDrivers(userId: string): Promise<Driver[]> {
    return await db
      .select()
      .from(drivers)
      .where(eq(drivers.userId, userId))
      .orderBy(desc(drivers.createdAt));
  }

  async getDriver(id: string, userId: string): Promise<Driver | undefined> {
    const [driver] = await db
      .select()
      .from(drivers)
      .where(and(eq(drivers.id, id), eq(drivers.userId, userId)));
    return driver;
  }

  async createDriver(driver: InsertDriver, userId: string): Promise<Driver> {
    const [newDriver] = await db
      .insert(drivers)
      .values({ ...driver, userId })
      .returning();
    return newDriver;
  }

  async updateDriver(id: string, driver: Partial<InsertDriver>, userId: string): Promise<Driver> {
    const [updatedDriver] = await db
      .update(drivers)
      .set({ ...driver, updatedAt: new Date() })
      .where(and(eq(drivers.id, id), eq(drivers.userId, userId)))
      .returning();
    return updatedDriver;
  }

  async deleteDriver(id: string, userId: string): Promise<void> {
    await db
      .delete(drivers)
      .where(and(eq(drivers.id, id), eq(drivers.userId, userId)));
  }

  // =================== TRIP OPERATIONS ===================

  async getTrips(userId: string): Promise<TripWithDetails[]> {
    const result = await db
      .select({
        trip: trips,
        customer: customers,
        vehicle: vehicles,
        driver: drivers,
      })
      .from(trips)
      .innerJoin(customers, eq(trips.customerId, customers.id))
      .innerJoin(vehicles, eq(trips.vehicleId, vehicles.id))
      .leftJoin(drivers, eq(trips.driverId, drivers.id))
      .where(eq(trips.userId, userId))
      .orderBy(desc(trips.createdAt));

    return result.map(row => ({
      ...row.trip,
      customer: row.customer,
      vehicle: row.vehicle,
      driver: row.driver,
    }));
  }

  async getTrip(id: string, userId: string): Promise<TripWithDetails | undefined> {
    const [result] = await db
      .select({
        trip: trips,
        customer: customers,
        vehicle: vehicles,
        driver: drivers,
      })
      .from(trips)
      .innerJoin(customers, eq(trips.customerId, customers.id))
      .innerJoin(vehicles, eq(trips.vehicleId, vehicles.id))
      .leftJoin(drivers, eq(trips.driverId, drivers.id))
      .where(and(eq(trips.id, id), eq(trips.userId, userId)));

    if (!result) return undefined;

    return {
      ...result.trip,
      customer: result.customer,
      vehicle: result.vehicle,
      driver: result.driver,
    };
  }

  async createTrip(trip: InsertTrip, userId: string): Promise<Trip> {
    const [newTrip] = await db
      .insert(trips)
      .values({ ...trip, userId })
      .returning();
    return newTrip;
  }

  async updateTrip(id: string, trip: Partial<InsertTrip>, userId: string): Promise<Trip> {
    const [updatedTrip] = await db
      .update(trips)
      .set({ ...trip, updatedAt: new Date() })
      .where(and(eq(trips.id, id), eq(trips.userId, userId)))
      .returning();
    return updatedTrip;
  }

  async deleteTrip(id: string, userId: string): Promise<void> {
    await db
      .delete(trips)
      .where(and(eq(trips.id, id), eq(trips.userId, userId)));
  }

  async getActiveTrips(userId: string): Promise<TripWithDetails[]> {
    const result = await db
      .select({
        trip: trips,
        customer: customers,
        vehicle: vehicles,
        driver: drivers,
      })
      .from(trips)
      .innerJoin(customers, eq(trips.customerId, customers.id))
      .innerJoin(vehicles, eq(trips.vehicleId, vehicles.id))
      .leftJoin(drivers, eq(trips.driverId, drivers.id))
      .where(and(
        eq(trips.userId, userId),
        eq(trips.status, 'in_progress')
      ))
      .orderBy(desc(trips.startDate));

    return result.map(row => ({
      ...row.trip,
      customer: row.customer,
      vehicle: row.vehicle,
      driver: row.driver,
    }));
  }

  // =================== INVOICE OPERATIONS ===================

  async getInvoices(userId: string): Promise<InvoiceWithDetails[]> {
    const result = await db
      .select({
        invoice: invoices,
        customer: customers,
        trip: trips,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .leftJoin(trips, eq(invoices.tripId, trips.id))
      .where(eq(invoices.userId, userId))
      .orderBy(desc(invoices.createdAt));

    return result.map(row => ({
      ...row.invoice,
      customer: row.customer,
      trip: row.trip,
    }));
  }

  async getInvoice(id: string, userId: string): Promise<InvoiceWithDetails | undefined> {
    const [result] = await db
      .select({
        invoice: invoices,
        customer: customers,
        trip: trips,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .leftJoin(trips, eq(invoices.tripId, trips.id))
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));

    if (!result) return undefined;

    return {
      ...result.invoice,
      customer: result.customer,
      trip: result.trip,
    };
  }

  async createInvoice(invoice: InsertInvoice, userId: string): Promise<Invoice> {
    const [newInvoice] = await db
      .insert(invoices)
      .values({ ...invoice, userId })
      .returning();
    return newInvoice;
  }

  async updateInvoice(id: string, invoice: Partial<InsertInvoice>, userId: string): Promise<Invoice> {
    const [updatedInvoice] = await db
      .update(invoices)
      .set({ ...invoice, updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .returning();
    return updatedInvoice;
  }

  async deleteInvoice(id: string, userId: string): Promise<void> {
    await db
      .delete(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
  }

  // =================== TRANSACTION OPERATIONS ===================

  async getTransactions(userId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.transactionDate));
  }

  async getTransaction(id: string, userId: string): Promise<Transaction | undefined> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    return transaction;
  }

  async createTransaction(transaction: InsertTransaction, userId: string): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values({ ...transaction, userId })
      .returning();
    return newTransaction;
  }

  async updateTransaction(id: string, transaction: Partial<InsertTransaction>, userId: string): Promise<Transaction> {
    const [updatedTransaction] = await db
      .update(transactions)
      .set({ ...transaction, updatedAt: new Date() })
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning();
    return updatedTransaction;
  }

  async deleteTransaction(id: string, userId: string): Promise<void> {
    await db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  }

  // =================== DASHBOARD OPERATIONS ===================

  async getDashboardStats(userId: string): Promise<{
    totalRevenue: number;
    activeTrips: number;
    pendingPayments: number;
    availableVehicles: number;
    totalVehicles: number;
  }> {
    // Total revenue from completed trips
    const revenueResult = await db
      .select({
        total: sum(trips.freightAmount),
      })
      .from(trips)
      .where(and(eq(trips.userId, userId), eq(trips.status, 'completed')));

    // Active trips count
    const activeTripsResult = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(trips)
      .where(and(eq(trips.userId, userId), eq(trips.status, 'in_progress')));

    // Pending payments
    const pendingPaymentsResult = await db
      .select({
        total: sum(invoices.balanceAmount),
      })
      .from(invoices)
      .where(and(eq(invoices.userId, userId), eq(invoices.status, 'pending')));

    // Vehicle counts
    const vehicleStatsResult = await db
      .select({
        total: sql<number>`count(*)`,
        available: sql<number>`count(*) filter (where current_status = 'available')`,
      })
      .from(vehicles)
      .where(and(eq(vehicles.userId, userId), eq(vehicles.isActive, true)));

    return {
      totalRevenue: Number(revenueResult[0]?.total || 0),
      activeTrips: Number(activeTripsResult[0]?.count || 0),
      pendingPayments: Number(pendingPaymentsResult[0]?.total || 0),
      availableVehicles: Number(vehicleStatsResult[0]?.available || 0),
      totalVehicles: Number(vehicleStatsResult[0]?.total || 0),
    };
  }
}

// Export storage instance
export const storage = new DatabaseStorage();
```

---

## Database Schema

### `shared/schema.ts`
```typescript
import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from 'drizzle-orm';
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =================== CORE TABLES ===================

// Session storage table (IMPORTANT - mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (IMPORTANT - mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  businessName: varchar("business_name"),
  businessType: varchar("business_type").default('transport'),
  gstNumber: varchar("gst_number"),
  phoneNumber: varchar("phone_number"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =================== BUSINESS TABLES ===================

// Customers table - Client management
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  email: varchar("email"),
  phoneNumber: varchar("phone_number"),
  address: text("address"),
  gstNumber: varchar("gst_number"),
  outstandingAmount: decimal("outstanding_amount", { precision: 10, scale: 2 }).default('0'),
  creditLimit: decimal("credit_limit", { precision: 10, scale: 2 }),
  paymentTerms: integer("payment_terms").default(30), // days
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Vehicles table - Fleet management
export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  vehicleNumber: varchar("vehicle_number").notNull(),
  vehicleType: varchar("vehicle_type").notNull(), // truck, trailer, etc
  capacity: decimal("capacity", { precision: 8, scale: 2 }), // in tons
  fuelType: varchar("fuel_type").default('diesel'),
  insuranceNumber: varchar("insurance_number"),
  insuranceExpiry: timestamp("insurance_expiry"),
  permitNumber: varchar("permit_number"),
  permitExpiry: timestamp("permit_expiry"),
  isActive: boolean("is_active").default(true),
  currentStatus: varchar("current_status").default('available'), // available, in_transit, maintenance
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Drivers table - Human resource management
export const drivers = pgTable("drivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  phoneNumber: varchar("phone_number").notNull(),
  licenseNumber: varchar("license_number").notNull(),
  licenseExpiry: timestamp("license_expiry"),
  address: text("address"),
  salary: decimal("salary", { precision: 10, scale: 2 }),
  salaryType: varchar("salary_type").default('monthly'), // monthly, per_trip, commission
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Trips table - Transport operations
export const trips = pgTable("trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  vehicleId: varchar("vehicle_id").notNull().references(() => vehicles.id),
  driverId: varchar("driver_id").references(() => drivers.id),
  tripNumber: varchar("trip_number").notNull(),
  fromLocation: varchar("from_location").notNull(),
  toLocation: varchar("to_location").notNull(),
  distance: decimal("distance", { precision: 8, scale: 2 }), // in km
  cargoDetails: text("cargo_details"),
  cargoWeight: decimal("cargo_weight", { precision: 8, scale: 2 }), // in tons
  freightAmount: decimal("freight_amount", { precision: 10, scale: 2 }).notNull(),
  advanceAmount: decimal("advance_amount", { precision: 10, scale: 2 }).default('0'),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).default('0'),
  fuelCost: decimal("fuel_cost", { precision: 10, scale: 2 }).default('0'),
  tollCost: decimal("toll_cost", { precision: 10, scale: 2 }).default('0'),
  otherExpenses: decimal("other_expenses", { precision: 10, scale: 2 }).default('0'),
  status: varchar("status").default('planned'), // planned, in_progress, completed, cancelled
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  estimatedDelivery: timestamp("estimated_delivery"),
  actualDelivery: timestamp("actual_delivery"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoices table - Billing management
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  tripId: varchar("trip_id").references(() => trips.id),
  invoiceNumber: varchar("invoice_number").notNull(),
  invoiceDate: timestamp("invoice_date").defaultNow(),
  dueDate: timestamp("due_date"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).default('0'),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default('0'),
  balanceAmount: decimal("balance_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").default('pending'), // pending, paid, overdue, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transactions table - Financial record keeping
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  customerId: varchar("customer_id").references(() => customers.id),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  tripId: varchar("trip_id").references(() => trips.id),
  type: varchar("type").notNull(), // income, expense, payment_received, payment_made
  category: varchar("category").notNull(), // freight, fuel, maintenance, salary, etc
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  transactionDate: timestamp("transaction_date").defaultNow(),
  paymentMethod: varchar("payment_method"), // cash, bank_transfer, upi, cheque
  referenceNumber: varchar("reference_number"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =================== DATABASE RELATIONS ===================

export const userRelations = relations(users, ({ many }) => ({
  customers: many(customers),
  vehicles: many(vehicles),
  drivers: many(drivers),
  trips: many(trips),
  invoices: many(invoices),
  transactions: many(transactions),
}));

export const customerRelations = relations(customers, ({ one, many }) => ({
  user: one(users, {
    fields: [customers.userId],
    references: [users.id],
  }),
  trips: many(trips),
  invoices: many(invoices),
  transactions: many(transactions),
}));

export const vehicleRelations = relations(vehicles, ({ one, many }) => ({
  user: one(users, {
    fields: [vehicles.userId],
    references: [users.id],
  }),
  trips: many(trips),
}));

export const driverRelations = relations(drivers, ({ one, many }) => ({
  user: one(users, {
    fields: [drivers.userId],
    references: [users.id],
  }),
  trips: many(trips),
}));

export const tripRelations = relations(trips, ({ one, many }) => ({
  user: one(users, {
    fields: [trips.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [trips.customerId],
    references: [customers.id],
  }),
  vehicle: one(vehicles, {
    fields: [trips.vehicleId],
    references: [vehicles.id],
  }),
  driver: one(drivers, {
    fields: [trips.driverId],
    references: [drivers.id],
  }),
  invoices: many(invoices),
  transactions: many(transactions),
}));

export const invoiceRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  trip: one(trips, {
    fields: [invoices.tripId],
    references: [trips.id],
  }),
  transactions: many(transactions),
}));

export const transactionRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [transactions.customerId],
    references: [customers.id],
  }),
  invoice: one(invoices, {
    fields: [transactions.invoiceId],
    references: [invoices.id],
  }),
  trip: one(trips, {
    fields: [transactions.tripId],
    references: [trips.id],
  }),
}));

// =================== VALIDATION SCHEMAS ===================

// Insert schemas for form validation (exclude auto-generated fields)
export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDriverSchema = createInsertSchema(drivers).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTripSchema = createInsertSchema(trips).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// =================== TYPESCRIPT TYPES ===================

// Base types from database tables
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// Combined types for API responses with relations
export type CustomerWithTransactions = Customer & {
  transactions: Transaction[];
};

export type TripWithDetails = Trip & {
  customer: Customer;
  vehicle: Vehicle;
  driver: Driver | null;
};

export type InvoiceWithDetails = Invoice & {
  customer: Customer;
  trip: Trip | null;
};
```

---

## Development Server

### `server/vite.ts`
```typescript
import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

// Custom logging function with timestamps
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Setup Vite development server with hot module replacement
export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  
  // Catch-all handler for frontend routes
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // Always reload index.html from disk in case it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

// Serve static files in production
export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Fall through to index.html if file doesn't exist (SPA routing)
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
```

---

## Configuration Files

### `drizzle.config.ts`
```typescript
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
```

### `package.json` (Backend Scripts)
```json
{
  "scripts": {
    "dev": "tsx server/index.ts",
    "build": "vite build",
    "start": "node server/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

## Environment Variables

### Required Environment Variables
```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@hostname:port/database

# Authentication Configuration
SESSION_SECRET=your-session-secret-key
REPLIT_DOMAINS=your-domain.replit.app
ISSUER_URL=https://replit.com/oidc
REPL_ID=your-repl-id

# Server Configuration
PORT=5000
NODE_ENV=development
```

---

## API Endpoints Summary

### Authentication Endpoints
- `GET /api/auth/user` - Get current user profile
- `GET /api/login` - Initiate OAuth login
- `GET /api/logout` - Logout and redirect
- `GET /api/callback` - OAuth callback handler

### Business Logic Endpoints

**Dashboard**
- `GET /api/dashboard/stats` - Business metrics and KPIs

**Customers** (5 endpoints)
- `GET /api/customers` - List all customers with transactions
- `GET /api/customers/:id` - Get specific customer
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

**Vehicles** (5 endpoints)
- `GET /api/vehicles` - List all vehicles
- `POST /api/vehicles` - Create new vehicle
- `PUT /api/vehicles/:id` - Update vehicle
- `DELETE /api/vehicles/:id` - Delete vehicle

**Drivers** (5 endpoints)
- `GET /api/drivers` - List all drivers
- `POST /api/drivers` - Create new driver
- `PUT /api/drivers/:id` - Update driver
- `DELETE /api/drivers/:id` - Delete driver

**Trips** (6 endpoints)
- `GET /api/trips` - List all trips with details
- `GET /api/trips/active` - Get active/in-progress trips
- `POST /api/trips` - Create new trip
- `PUT /api/trips/:id` - Update trip
- `DELETE /api/trips/:id` - Delete trip

**Invoices** (5 endpoints)
- `GET /api/invoices` - List all invoices with details
- `POST /api/invoices` - Create new invoice
- `PUT /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Delete invoice

**Transactions** (3 endpoints)
- `GET /api/transactions` - List all transactions
- `POST /api/transactions` - Record new transaction

**Total: 25+ API Endpoints**

---

## Key Features

### Security & Authentication
- **Multi-tenant Architecture**: User-scoped data access with userId filtering
- **OAuth 2.0 Integration**: Secure authentication via Replit Auth
- **Session Management**: PostgreSQL-backed sessions with automatic expiry
- **Token Refresh**: Automatic token renewal for long-lived sessions
- **Request Validation**: Zod schema validation for all API inputs

### Database Architecture
- **Type-Safe Operations**: Drizzle ORM with full TypeScript integration
- **Relationship Management**: Proper foreign key constraints and cascading deletes
- **Performance Optimization**: Efficient queries with joins and aggregations
- **Migration Support**: Schema versioning with Drizzle Kit

### Business Logic
- **Complete CRUD Operations**: Full create, read, update, delete for all entities
- **Transaction Management**: Financial record keeping with payment tracking
- **Dashboard Analytics**: Real-time business metrics and KPIs
- **Data Relationships**: Proper linking between customers, vehicles, trips, and invoices

### Development Experience
- **Hot Module Replacement**: Live reloading in development
- **Error Handling**: Comprehensive error logging and user feedback
- **API Documentation**: RESTful endpoints with consistent patterns
- **Type Safety**: End-to-end type checking from database to API responses

This backend provides a complete, production-ready foundation for the TransBook transport management application with proper security, scalability, and maintainability.