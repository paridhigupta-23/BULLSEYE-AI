import 'dotenv/config';
import { DEMO_ACCOUNTS, getDb, getDbPath } from './db.ts';

const db = getDb();
const counts = {
  users: (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c,
  watchlist: (db.prepare('SELECT COUNT(*) as c FROM investor_watchlist').get() as { c: number }).c,
  investorHoldings: (db.prepare('SELECT COUNT(*) as c FROM investor_holdings').get() as { c: number }).c,
  practiceAccounts: (db.prepare('SELECT COUNT(*) as c FROM practice_accounts').get() as { c: number }).c,
};

console.log(`SQLite initialized at ${getDbPath()}`);
console.log('Table row counts:', counts);
console.log(
  'Seeded portal accounts:',
  DEMO_ACCOUNTS.map((a) => `${a.role}: ${a.userCode} (${a.email})`).join(' | '),
);
