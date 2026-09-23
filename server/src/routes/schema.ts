import type { SchemaResponse, Suggestion, TableInfo } from '@halcyon/shared';
import { Router, type Request, type Response } from 'express';
import { ADVERSARIAL_PROBES } from '../catalogue/adversarial.js';
import { TEMPLATES } from '../catalogue/templates.js';
import { readOnly } from '../db/pools.js';
import { DATA_TABLES, TABLE_DESCRIPTIONS } from '../db/schema.js';

export const schemaRouter: Router = Router();

/**
 * `GET /api/schema` — what the service can see and what it can be asked.
 *
 * Row counts are queried live rather than quoted from the seed, so the evidence
 * rail cannot drift from the database it describes.
 */
schemaRouter.get('/schema', async (_request: Request, response: Response): Promise<void> => {
  const tables: TableInfo[] = [];

  for (const name of DATA_TABLES) {
    const result = await readOnly().query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${name}`,
    );
    tables.push({
      name,
      description: TABLE_DESCRIPTIONS[name],
      rowCount: Number(result.rows[0]?.count ?? 0),
    });
  }

  const starters: Suggestion[] = TEMPLATES.slice(0, 4).map((template) => ({
    templateId: template.id,
    question: template.canonical,
    tables: template.tables,
    form: template.form,
  }));

  const guardProbes: Suggestion[] = ADVERSARIAL_PROBES.map((probe) => ({
    templateId: probe.id,
    question: probe.question,
    tables: [],
    form: 'table',
  }));

  const payload: SchemaResponse = { tables, starters, guardProbes };
  response.json(payload);
});
