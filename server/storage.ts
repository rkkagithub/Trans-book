import {
  users,
  customers,
  vehicles,
  drivers,
  trips,
  invoices,
  expenses,
  type User,
  type UpsertUser,
  type Customer,
  type InsertCustomer,
  type Vehicle,
  type InsertVehicle,
  type Driver,
  type InsertDriver,
  type Trip,
  type InsertTrip,
  type Invoice,
  type InsertInvoice,
  type Expense,
  type InsertExpense,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import { demoData } from "./demoData";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: { email: string; firstName: string; lastName: string; password: string }): Promise<User>;
  
  // Customer operations
  getCustomers(userId: string): Promise<Customer[]>;
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
  getTrips(userId: string): Promise<Trip[]>;
  getTrip(id: string, userId: string): Promise<Trip | undefined>;
  createTrip(trip: InsertTrip, userId: string): Promise<Trip>;
  updateTrip(id: string, trip: Partial<InsertTrip>, userId: string): Promise<Trip>;
  deleteTrip(id: string, userId: string): Promise<void>;
  
  // Invoice operations
  getInvoices(userId: string): Promise<Invoice[]>;
  getInvoice(id: string, userId: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice, userId: string): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>, userId: string): Promise<Invoice>;
  deleteInvoice(id: string, userId: string): Promise<void>;
  
  // Expense operations
  getExpenses(userId: string): Promise<Expense[]>;
  getExpense(id: string, userId: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense, userId: string): Promise<Expense>;
  updateExpense(id: string, expense: Partial<InsertExpense>, userId: string): Promise<Expense>;
  deleteExpense(id: string, userId: string): Promise<void>;
  
  // Dashboard operations
  getDashboardStats(userId: string): Promise<{
    totalRevenue: string;
    activeTrips: number;
    pendingPayments: string;
    availableVehicles: number;
    totalVehicles: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error("Database error, using demo data:", error);
      return id === 'demo-user' ? demoData.user : undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    } catch (error) {
      console.error("Database error, using demo data:", error);
      return email === 'demo@transbook.com' ? demoData.user : undefined;
    }
  }

  async createUser(userData: { email: string; firstName: string; lastName: string; password: string }): Promise<User> {
    try {
      const [user] = await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return user;
    } catch (error) {
      console.error("Database error, creating demo user:", error);
      return {
        id: 'demo-user',
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: null,
        password: userData.password,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  // Customer operations
  async getCustomers(userId: string): Promise<Customer[]> {
    try {
      return await db.select().from(customers).where(eq(customers.userId, userId)).orderBy(desc(customers.createdAt));
    } catch (error) {
      console.error("Database error, using demo data:", error);
      return demoData.customers;
    }
  }

  async getCustomer(id: string, userId: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.userId, userId)));
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
    await db.delete(customers).where(and(eq(customers.id, id), eq(customers.userId, userId)));
  }

  // Vehicle operations
  async getVehicles(userId: string): Promise<Vehicle[]> {
    try {
      return await db.select().from(vehicles).where(eq(vehicles.userId, userId)).orderBy(desc(vehicles.createdAt));
    } catch (error) {
      console.error("Database error, using demo data:", error);
      return demoData.vehicles;
    }
  }

  async getVehicle(id: string, userId: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.userId, userId)));
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
    await db.delete(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.userId, userId)));
  }

  // Driver operations
  async getDrivers(userId: string): Promise<Driver[]> {
    try {
      return await db.select().from(drivers).where(eq(drivers.userId, userId)).orderBy(desc(drivers.createdAt));
    } catch (error) {
      console.error("Database error, using demo data:", error);
      return demoData.drivers;
    }
  }

  async getDriver(id: string, userId: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(and(eq(drivers.id, id), eq(drivers.userId, userId)));
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
    await db.delete(drivers).where(and(eq(drivers.id, id), eq(drivers.userId, userId)));
  }

  // Trip operations
  async getTrips(userId: string): Promise<Trip[]> {
    try {
      return await db.select().from(trips).where(eq(trips.userId, userId)).orderBy(desc(trips.createdAt));
    } catch (error) {
      console.error("Database error, using demo data:", error);
      return demoData.trips;
    }
  }

  async getTrip(id: string, userId: string): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips).where(and(eq(trips.id, id), eq(trips.userId, userId)));
    return trip;
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
    await db.delete(trips).where(and(eq(trips.id, id), eq(trips.userId, userId)));
  }

  // Invoice operations
  async getInvoices(userId: string): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string, userId: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
    return invoice;
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
    await db.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
  }

  // Expense operations
  async getExpenses(userId: string): Promise<Expense[]> {
    return await db.select().from(expenses).where(eq(expenses.userId, userId)).orderBy(desc(expenses.createdAt));
  }

  async getExpense(id: string, userId: string): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
    return expense;
  }

  async createExpense(expense: InsertExpense, userId: string): Promise<Expense> {
    const [newExpense] = await db
      .insert(expenses)
      .values({ ...expense, userId })
      .returning();
    return newExpense;
  }

  async updateExpense(id: string, expense: Partial<InsertExpense>, userId: string): Promise<Expense> {
    const [updatedExpense] = await db
      .update(expenses)
      .set({ ...expense, updatedAt: new Date() })
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .returning();
    return updatedExpense;
  }

  async deleteExpense(id: string, userId: string): Promise<void> {
    await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
  }

  // Dashboard operations
  async getDashboardStats(userId: string): Promise<{
    totalRevenue: string;
    activeTrips: number;
    pendingPayments: string;
    availableVehicles: number;
    totalVehicles: number;
  }> {
    try {
      // Get total revenue from completed trips
      const revenueResult = await db
        .select({ 
          total: sql<string>`COALESCE(SUM(${trips.freight}), 0)` 
        })
        .from(trips)
        .where(and(eq(trips.userId, userId), eq(trips.status, 'completed')));

      // Get active trips count
      const activeTripsResult = await db
        .select({ 
          count: sql<number>`COUNT(*)` 
        })
        .from(trips)
        .where(and(eq(trips.userId, userId), eq(trips.status, 'in_progress')));

      // Get pending payments from invoices
      const pendingPaymentsResult = await db
        .select({ 
          total: sql<string>`COALESCE(SUM(${invoices.totalAmount} - ${invoices.paidAmount}), 0)` 
        })
        .from(invoices)
        .where(and(eq(invoices.userId, userId), eq(invoices.status, 'sent')));

      // Get vehicle counts
      const vehicleStatsResult = await db
        .select({ 
          total: sql<number>`COUNT(*)`,
          available: sql<number>`COUNT(CASE WHEN ${vehicles.status} = 'available' THEN 1 END)`
        })
        .from(vehicles)
        .where(eq(vehicles.userId, userId));

      return {
        totalRevenue: revenueResult[0]?.total || "0",
        activeTrips: activeTripsResult[0]?.count || 0,
        pendingPayments: pendingPaymentsResult[0]?.total || "0",
        availableVehicles: vehicleStatsResult[0]?.available || 0,
        totalVehicles: vehicleStatsResult[0]?.total || 0,
      };
    } catch (error) {
      console.error("Database error, using demo data:", error);
      return demoData.dashboardStats;
    }
  }
}

export const storage = new DatabaseStorage();
