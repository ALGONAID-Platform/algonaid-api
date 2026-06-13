import { defineConfig } from "@prisma/config";
import "dotenv/config";

export default defineConfig({
   migrations: {
      seed: 'ts-node ./prisma/seed.ts',
    },
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "",
  },
  generate: {
    output: "src/prisma/client"
  }
});
