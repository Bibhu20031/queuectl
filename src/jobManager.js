// src/jobManager.js
const { exec } = require('child_process');
const { loadJobs, saveJobs, loadDLQ, saveDLQ } = require('./storage');
const { sleep, nowISO, randomId } = require('./utils');

const DEFAULT_MAX_RETRIES = 3;
const POLL_MS = 800;

// Enqueueing a job with payload {id?, command, max_retries?}
async function enqueue(payload) {
  if (!payload || !payload.command) throw new Error('payload.command required');
  const jobs = loadJobs();

  // ✅ Check for duplicate job ID
  if (payload.id) {
    const exists = jobs.find(j => j.id === payload.id);
    if (exists) throw new Error(`Job with id "${payload.id}" already exists`);
  }

  const id = payload.id || randomId('job');
  const job = {
    id,
    command: payload.command,
    state: 'pending',
    attempts: 0,
    max_retries: Number.isInteger(payload.max_retries)
      ? payload.max_retries
      : DEFAULT_MAX_RETRIES,
    created_at: nowISO(),
    updated_at: nowISO(),
    next_run_at: null,
    last_error: null,
    output: null
  };
  jobs.push(job);
  saveJobs(jobs);
  return id;
}


async function listJobs(state) {
  const jobs = loadJobs();
  return state ? jobs.filter(j => j.state === state) : jobs;
}

async function status() {
  const jobs = loadJobs();
  const counts = {};
  for (const j of jobs) counts[j.state] = (counts[j.state] || 0) + 1;
  return counts;
}

async function dlqList() {
  return loadDLQ();
}

async function dlqRetry(jobId) {
  const dlq = loadDLQ();
  const idx = dlq.findIndex(j => j.id === jobId);
  if (idx === -1) throw new Error('DLQ job not found');
  const job = dlq.splice(idx, 1)[0];
  job.state = 'pending';
  job.attempts = 0;
  job.last_error = null;
  job.next_run_at = null;
  job.updated_at = nowISO();
  const jobs = loadJobs();
  jobs.push(job);
  saveJobs(jobs);
  saveDLQ(dlq);
  return true;
}

//pending job
function claimJob() {
  const jobs = loadJobs();
  const now = Date.now();
  const idx = jobs.findIndex(j => {
    if (j.state !== 'pending') return false;
    if (!j.next_run_at) return true;
    return Number(j.next_run_at) <= now;
  });
  if (idx === -1) return null;
  const job = jobs[idx];
  job.state = 'processing';
  job.updated_at = nowISO();
  saveJobs(jobs);
  return job;
}

// Execute a command via shell
function execCommand(command, timeoutMs = 1000 * 60 * 5) {
  return new Promise((resolve) => {
    const preferredShell = process.env.SHELL || (process.platform === 'win32' ? 'bash' : '/bin/sh');

    console.log(`[execCommand] command="${command}" shell="${preferredShell}"`);

    const child = exec(command, { shell: preferredShell, timeout: timeoutMs }, (error, stdout, stderr) => {
      const out = (stdout || '') + (stderr || '');
      if (stdout && stdout.toString().trim()) console.log(`[exec stdout] ${stdout.toString().trim()}`);
      if (stderr && stderr.toString().trim()) console.log(`[exec stderr] ${stderr.toString().trim()}`);
      if (error) {
        console.log(`[exec error] ${error.message}`);
        resolve({ success: false, error: error.message || out.trim(), output: out });
      } else {
        resolve({ success: true, output: out });
      }
    });

    if (child.stdout) child.stdout.on('data', d => process.stdout.write(d));
    if (child.stderr) child.stderr.on('data', d => process.stderr.write(d));
  });
}


async function processJob(job, backoffBase) {
  // run command
  const result = await execCommand(job.command);
  const jobs = loadJobs();
  const idx = jobs.findIndex(j => j.id === job.id);

  if (result.success) {
    if (idx !== -1) {
      jobs[idx].state = 'completed';
      jobs[idx].updated_at = nowISO();
      jobs[idx].output = result.output;
      saveJobs(jobs);
    } else {
      // if job not found in jobs.json
      jobs.push({
        ...job,
        state: 'completed',
        updated_at: nowISO(),
        output: result.output
      });
      saveJobs(jobs);
    }
    console.log(`[job ${job.id}] completed`);
    return;
  }

  // failure
  job.attempts = (job.attempts || 0) + 1;
  job.last_error = result.error || 'unknown';
  job.updated_at = nowISO();

  if (job.attempts >= (job.max_retries || DEFAULT_MAX_RETRIES)) {
    job.state = 'dead';
    job.output = result.output;
    // remove from jobs list if present
    if (idx !== -1) {
      jobs.splice(idx, 1);
    }
    const dlq = loadDLQ();
    dlq.push(job);
    saveDLQ(dlq);
    saveJobs(jobs);
    console.log(`[job ${job.id}] moved to DLQ after ${job.attempts} attempts`);
  } else {
    // scheduling retry with exponential backoff: delay = base ^ attempts seconds
    const delaySec = Math.pow(backoffBase, job.attempts);
    job.next_run_at = Date.now() + Math.round(delaySec * 1000);
    job.state = 'pending';
    if (idx !== -1) {
      jobs[idx] = job;
    } else {
      jobs.push(job);
    }
    saveJobs(jobs);
    console.log(`[job ${job.id}] scheduled retry in ${delaySec}s (attempt ${job.attempts})`);
  }
}

let running = false;


async function workerLoop(id, { base = 2 } = {}) {
  console.log(`worker ${id} started`);
  while (running) {
    try {
      const job = claimJob();
      if (!job) {
        await sleep(POLL_MS);
        continue;
      }
      console.log(`[worker ${id}] claimed job ${job.id}`);
      await processJob(job, base);
    } catch (err) {
      console.error('worker error:', err && err.message);
      await sleep(500);
    }
  }
  console.log(`worker ${id} exiting`);
}




async function runWorkers({ workers = 1, base = 2 } = {}) {
  if (running) {
    console.log('Workers already running');
    return;
  }
  running = true;
  const promises = [];
  for (let i = 0; i < workers; i++) {
    promises.push(workerLoop(i + 1, { base }));
  }
  
  await Promise.all(promises);
  console.log('[runWorkers] all workers stopped');
}


function stopWorkers() {
  if (!running) {
    console.log('Workers are not running');
    return;
  }
  running = false;
  console.log('stopWorkers: signalled workers to stop');
}

module.exports = {
  enqueue,
  listJobs,
  status,
  runWorkers,
  dlqList,
  dlqRetry,
  stopWorkers
};
