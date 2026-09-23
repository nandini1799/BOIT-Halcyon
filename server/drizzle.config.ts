import { defineConfig } from 'drizzle-kit';
// Extensionless: drizzle-kit bundles this file itself and does not apply the
// NodeNext resolution the rest of the server compiles under.
import { connectionUrls } from './src/lib/config';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: connectionUrls.owner },
  strict: true,
  verbose: true,
});
