import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Disable WebSocket completely in production environments
if (process.env.NODE_ENV === 'production') {
  // Disable all WebSocket and pipeline features for production
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
  neonConfig.wsProxy = undefined;
  neonConfig.webSocketConstructor = undefined;
} else {
  // Configure WebSocket only in development if available
  if (typeof WebSocket === 'undefined') {
    neonConfig.webSocketConstructor = ws;
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
export const db = drizzle({ client: pool, schema });