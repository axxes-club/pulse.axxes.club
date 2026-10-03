import { readFile } from 'node:fs/promises'
import pg from 'pg'
const target=process.argv[2]
if(!['metadata','analytics','native-adapters'].includes(target))throw new Error('Usage: node scripts/pulse-migrate.mjs metadata|analytics|native-adapters')
const connectionString=process.env[target==='analytics'?'ANALYTICS_DATABASE_URL':'DATABASE_URL']
if(!connectionString)throw new Error('Required database configuration is missing')
if(target==='analytics'&&connectionString===process.env.DATABASE_URL)throw new Error('Analytics storage must be separate from shared identity storage')
const client=new pg.Client({connectionString});await client.connect()
try{await client.query(await readFile(new URL(`../db/pulse-${target}.sql`,import.meta.url),'utf8'));console.log(`${target} additive migration applied`)}finally{await client.end()}
