const fs = require('fs');
const path = require('path');
const pool = require('./db');

function splitSqlStatements(sql) {
  const stmts = [];
  let cur = '';
  let i = 0;
  const len = sql.length;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  let inDollar = null; // tag string or null

  while (i < len) {
    const ch = sql[i];
    const next2 = sql.slice(i, i + 2);

    // handle line comment --
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

    // handle block comment /* */
    if (!inSingle && !inDouble && !inBlockComment && !inDollar && next2 === '/*') {
      inBlockComment = true;
      cur += next2;
      i += 2;
      continue;
    }
    if (inBlockComment) {
      cur += ch;
      if (sql.slice(i, i + 2) === '*/') {
        cur += '*'; // will add '/' on next iteration
        // advance and append '/'
        i += 2;
        inBlockComment = false;
        continue;
      }
      i++;
      continue;
    }

    // handle dollar quote start
    if (!inSingle && !inDouble && !inDollar && ch === '$') {
      // try to read tag
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        inDollar = m[0];
        cur += m[0];
        i += m[0].length;
        continue;
      }
    }
    // handle dollar quote end
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

    // quotes
    if (!inDouble && ch === "'") {
      // toggle single
      if (inSingle) {
        // check for escaped ''
        if (sql[i + 1] === "'") {
          cur += "''";
          i += 2;
          continue;
        }
        inSingle = false;
        cur += ch;
        i++;
        continue;
      } else {
        inSingle = true;
        cur += ch;
        i++;
        continue;
      }
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      cur += ch;
      i++;
      continue;
    }

    // semicolon ends statement when not in any quote/comment
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

async function runMigration() {
  const sqlPath = path.resolve(__dirname, '..', 'db.sql');
  console.log('Reading SQL from', sqlPath);
  let sql = fs.readFileSync(sqlPath, 'utf8');

  const client = await pool.connect();
  try {
    console.log('Checking available extensions...');

    // Find CREATE EXTENSION statements and remove the ones not available in this PG cluster
    const extRegex = /CREATE\s+EXTENSION\s+(IF\s+NOT\s+EXISTS\s+)?("?)([a-zA-Z0-9_\-]+)\2\s*;/ig;
    let match;
    const skipped = [];
    let adjustedSql = sql;

    while ((match = extRegex.exec(sql)) !== null) {
      const extName = match[3];
      try {
        const res = await client.query('SELECT 1 FROM pg_available_extensions WHERE name = $1', [extName]);
        if (res.rowCount === 0) {
          adjustedSql = adjustedSql.replace(match[0], `-- skipped CREATE EXTENSION ${extName} (not available)\n`);
          skipped.push(extName);
        }
      } catch (err) {
        // ignore
      }
    }

    if (skipped.length) console.warn('Skipping unavailable extensions:', skipped.join(', '));

    // Ensure UUID helper is available or adapt SQL
    const hasUuidGenerate = (await client.query("SELECT 1 FROM pg_proc WHERE proname = 'uuid_generate_v4' LIMIT 1")).rowCount > 0;
    const hasGenRandom = (await client.query("SELECT 1 FROM pg_proc WHERE proname = 'gen_random_uuid' LIMIT 1")).rowCount > 0;

    if (!hasUuidGenerate) {
      if (hasGenRandom) {
        console.log('Replacing uuid_generate_v4() with gen_random_uuid() in SQL.');
        adjustedSql = adjustedSql.replace(/uuid_generate_v4\(\)/g, 'gen_random_uuid()');
      } else {
        // Try to create the uuid-ossp extension (may fail if not installed or insufficient permissions)
        try {
          console.log('Attempting to create extension "uuid-ossp"');
          await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
          // re-check
          const nowHas = (await client.query("SELECT 1 FROM pg_proc WHERE proname = 'uuid_generate_v4' LIMIT 1")).rowCount > 0;
          if (!nowHas) {
            console.warn('uuid_generate_v4 still not available after creating extension; removing DEFAULT uuid_generate_v4() clauses.');
            adjustedSql = adjustedSql.replace(/DEFAULT\s+uuid_generate_v4\(\)\s*/g, '');
          }
        } catch (err) {
          console.warn('Could not create uuid-ossp extension:', err.message);
          // Last resort: remove DEFAULT uuid_generate_v4() occurrences so table creation can proceed
          adjustedSql = adjustedSql.replace(/DEFAULT\s+uuid_generate_v4\(\)\s*/g, '');
        }
      }
    }

    const statements = splitSqlStatements(adjustedSql);
    console.log(`Parsed ${statements.length} SQL statements.`);

    // Execute statements sequentially, retrying failed ones to allow forward references
    let toRun = statements.slice();
    const maxPasses = 10;
    for (let pass = 1; pass <= maxPasses && toRun.length > 0; pass++) {
      console.log(`Migration pass ${pass}, statements remaining: ${toRun.length}`);
      const failed = [];
      const newToRun = [];
      for (let idx = 0; idx < toRun.length; idx++) {
        const stmt = toRun[idx];
        const executable = stmt.replace(/^(\s*--[^\n]*\n)+/, '').trim();
        if (!executable) continue;
        const head = executable.split('\n')[0].slice(0, 140);
        try {
          await client.query(executable);
          console.log(`OK [pass ${pass}] stmt ${idx + 1}/${toRun.length}: ${head}`);
        } catch (err) {
          console.warn(`FAIL [pass ${pass}] stmt ${idx + 1}/${toRun.length}: ${head} -> ${err.message}`);
          failed.push({ stmt, err, head });
          newToRun.push(stmt);
        }
      }
      if (failed.length === 0) {
        console.log('All statements executed.');
        toRun = [];
        break;
      }

      // If no progress (all failed in this pass), show detailed failures and exit
      if (failed.length === toRun.length) {
        console.error('Migration aborted; no statements succeeded in this pass. Showing failures:');
        for (let i = 0; i < failed.length; i++) {
          const f = failed[i];
          console.error(`--- Failure ${i + 1} ---`);
          console.error('Error:', f.err.message);
          console.error('Stmt head:', f.head);
          console.error('Stmt (truncated):', f.stmt.slice(0, 800));
        }
        process.exit(1);
      }

      // prepare for next pass: only retry the failed statements
      toRun = newToRun;
    }

    if (toRun.length > 0) {
      console.error('Migration incomplete after retries. Statements remaining:', toRun.length);
      process.exit(1);
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

runMigration();
