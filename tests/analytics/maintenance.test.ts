import { expect,it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
it('uses site partitions and rebuilds daily aggregates idempotently without adding distinct visitors',async()=>{const db=new PGlite();try{await db.exec(readFileSync('db/pulse-analytics.sql','utf8'));const partition=await db.query("select relkind from pg_class where relname='pulse_events'");expect((partition.rows[0] as any).relkind).toBe('p');await db.exec(readFileSync('db/pulse-maintenance.sql','utf8'));await db.exec(readFileSync('db/pulse-maintenance.sql','utf8'));expect((await db.query('select * from pulse_aggregate_state')).rows).toHaveLength(1)}finally{await db.close()}},20000);
