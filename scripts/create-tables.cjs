const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_oJBAenwC75qv@ep-square-sun-a62wnur5-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require');

async function run() {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
  console.log('Existing tables:', tables.map(r => r.table_name).join(', '));

  const existing = new Set(tables.map(r => r.table_name));

  if (!existing.has('templates')) {
    await sql`CREATE TABLE templates (id UUID PRIMARY KEY, name TEXT NOT NULL, trade_type TEXT NOT NULL, description TEXT DEFAULT '')`;
    console.log('Created templates');
  }

  if (!existing.has('template_line_items')) {
    await sql`CREATE TABLE template_line_items (id UUID PRIMARY KEY, template_id UUID NOT NULL REFERENCES templates(id), description TEXT NOT NULL, quantity REAL DEFAULT 1, unit TEXT DEFAULT 'ea', unit_cost REAL DEFAULT 0, markup_percent REAL DEFAULT 0, sort_order INTEGER DEFAULT 0)`;
    console.log('Created template_line_items');
  }

  if (!existing.has('line_items')) {
    await sql`CREATE TABLE line_items (id UUID PRIMARY KEY, estimate_id UUID NOT NULL, description TEXT NOT NULL, quantity REAL DEFAULT 1, unit TEXT DEFAULT 'ea', unit_cost REAL DEFAULT 0, markup_percent REAL DEFAULT 0, sort_order INTEGER DEFAULT 0)`;
    console.log('Created line_items');
  }

  console.log('Done');
}
run().catch(e => console.error(e));
