function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function nowISO() {
  return new Date().toISOString();
}

function randomId(prefix = 'job') {
  return prefix + '-' + Math.random().toString(36).slice(2, 9);
}

module.exports = { sleep, nowISO, randomId };
