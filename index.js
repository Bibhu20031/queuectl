const argv = process.argv.slice(2);

if (argv.length === 0) {
  console.log('Usage: node index.js <command> [args]');
  console.log('Commands: enqueue <json>, run [--workers N] [--base B], list [--state s], status, dlq list, dlq retry <id>');
  process.exit(0);
}

const cmd = argv[0];

async function main() {
  
  switch (cmd) {
    case 'enqueue':
      console.log('enqueue called');
      console.log('Example: node index.js enqueue \'{"id":"job1","command":"echo hi"}\'');
      break;
    case 'list':
      console.log('list called');
      break;
    case 'status':
      console.log('status called');
      break;
    case 'run':
    case 'worker':
      console.log('Worker/run called');
      break;
    case 'dlq':
      console.log('Dlq called');
      break;
    default:
      console.error('Unknown command:', cmd);
      console.log('Use no args to see usage.');
      process.exit(1);
  }
  process.exit(0);
}

main();
