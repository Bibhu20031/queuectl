
const { enqueue, listJobs, status, runWorkers, dlqList, dlqRetry, stopWorkers } = require('./src/jobManager');

const argv = process.argv.slice(2);

if (argv.length === 0) {
  console.log('Usage: node index.js <command> [args]');
  console.log('Commands: enqueue <json>, run [--workers N] [--base B], run stop, worker stop, list [--state s], status, dlq list, dlq retry <id>');
  process.exit(0);
}

const cmd = argv[0];

async function main() {
  try {
    if (cmd === 'enqueue') {
      const payload = argv[1];
      if (!payload) {
        console.error('enqueue requires a JSON string payload. Example:');
        console.error(`node index.js enqueue '{"id":"job1","command":"echo hi","max_retries":3}'`);
        process.exit(1);
      }
      let obj;
      try {
        obj = JSON.parse(payload);
      } catch (e) {
        console.error('Invalid JSON payload:', e.message);
        process.exit(1);
      }
      const id = await enqueue(obj);
      console.log('Enqueued job id=', id);
      process.exit(0);
    }

    if (cmd === 'list') {
      const stateFlagIndex = argv.findIndex(a => a === '--state' || a === '-s');
      const state = stateFlagIndex !== -1 ? argv[stateFlagIndex + 1] : null;
      const rows = await listJobs(state);
      if (rows.length === 0) console.log('No jobs found.');
      else rows.forEach(j => {
        console.log(`${j.id} | ${j.state} | attempts=${j.attempts}/${j.max_retries} | cmd="${j.command}" | next_run_at=${j.next_run_at || 'null'}`);
      });
      process.exit(0);
    }

    if (cmd === 'status') {
      const s = await status();
      console.log('Status:', s);
      process.exit(0);
    }

    if (cmd === 'dlq') {
      const sub = argv[1];
      if (sub === 'list') {
        const dlq = await dlqList();
        if (dlq.length === 0) console.log('DLQ empty.');
        else dlq.forEach(j => console.log(`${j.id} | ${j.state} | attempts=${j.attempts} | cmd="${j.command}" | last_error=${j.last_error || ''}`));
        process.exit(0);
      } else if (sub === 'retry') {
        const id = argv[2];
        if (!id) {
          console.error('Provide job id to retry: node index.js dlq retry <id>');
          process.exit(1);
        }
        await dlqRetry(id);
        console.log('Retried', id);
        process.exit(0);
      } else {
        console.error('Unknown dlq subcommand. Use "dlq list" or "dlq retry <id>"');
        process.exit(1);
      }
    }

    if ((cmd === 'run' || cmd === 'worker') && argv[1] === 'stop') {
      //workers in this process to stop gracefully
      stopWorkers();
      console.log('Signalled running workers to stop (if any).');
      process.exit(0);
    }

    if (cmd === 'run' || cmd === 'worker') {
      // parse flags
      const wIndex = argv.findIndex(a => a === '--workers' || a === '-w');
      const bIndex = argv.findIndex(a => a === '--base' || a === '-b');
      const workers = wIndex !== -1 ? parseInt(argv[wIndex + 1], 10) || 1 : 1;
      const base = bIndex !== -1 ? parseInt(argv[bIndex + 1], 10) || 2 : 2;

      console.log(`Starting workers: count=${workers}, backoffBase=${base}`);
      await runWorkers({ workers, base });
      // runWorkers returns on graceful shutdown
      process.exit(0);
    }

    console.error('Unknown command:', cmd);
    process.exit(1);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
