const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

function splitSqlStatements(sql) {
  const stmts = [];
  let cur = '';
  let i = 0;
  const len = sql.length;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  let inDollar = null;

  while (i < len) {
    const ch = sql[i];
    const next2 = sql.slice(i, i + 2);

    if (!inSingle && !inDouble && !inBlockComment && !inDollar && next2 === '--') {
      inLineComment = true;
      cur += next2;
      i += 2;
      continue;
    }
    if (inLineComment) {
      cur += ch;
      if (ch === '\n') inLineComment = false;
      i++;
      continue;
    }
    if (!inSingle && !inDouble && !inBlockComment && !inDollar && next2 === '/*') {
      inBlockComment = true;
      cur += next2;
      i += 2;
      continue;
    }
    if (inBlockComment) {
      cur += ch;
      if (sql.slice(i, i + 2) === '*/') {
        cur += '*';
        i += 2;
        inBlockComment = false;
        continue;
      }
      i++;
      continue;
    }
    if (!inSingle && !inDouble && !inDollar && ch === '$') {
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        inDollar = m[0];
        cur += m[0];
        i += m[0].length;
        continue;
      }
    }
    if (inDollar) {
      if (sql.slice(i, i + inDollar.length) === inDollar) {
        cur += inDollar;
        i += inDollar.length;
        inDollar = null;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (!inDouble && ch === "'") {
      if (inSingle) {
        if (sql[i + 1] === "'") {
          cur += "''";
          i += 2;
          continue;
        }
        inSingle = false;
        cur += ch;
        i++;
        continue;
      }
      inSingle = true;
      cur += ch;
      i++;
      continue;
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      cur += ch;
      i++;
      continue;
    }
    if (!inSingle && !inDouble && !inDollar && !inLineComment && !inBlockComment && ch === ';') {
      cur += ';';
      const s = cur.trim();
      if (s) stmts.push(s);
      cur = '';
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  const last = cur.trim();
  if (last) stmts.push(last);
  return stmts;
}

function stripLeadingComments(sql) {
  return sql.replace(/^(\s*--[^\n]*\n)+/, '').trim();
}

async function runEmailMigration() {
  const sqlPath = path.resolve(__dirname, '..', 'db', 'email.sql');
  console.log('Running email schema migration from', sqlPath);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = splitSqlStatements(sql);
  const client = await pool.connect();

  try {
    for (let i = 0; i < statements.length; i++) {
      const stmt = stripLeadingComments(statements[i]);
      if (!stmt) continue;
      const head = stmt.split('\n')[0].slice(0, 120);
      await client.query(stmt);
      console.log(`OK [${i + 1}/${statements.length}] ${head}`);
    }
    console.log('Email schema migration completed.');
    process.exit(0);
  } catch (err) {
    console.error('Email migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

runEmailMigration();
