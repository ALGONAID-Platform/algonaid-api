import { defineConfig } from "@prisma/config";
import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn("WARNING: DATABASE_URL is not set in environment variables.");
}

export default defineConfig({
   migrations: {
      seed: 'ts-node ./prisma/seed.ts',
    },
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl || "postgresql://invalid-url-check-render-env-vars",
  },
  generate: {
    output: "src/prisma/client"
  }
});
