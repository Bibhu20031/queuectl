const fs= require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname,'..','data')
const JOBS_FILE = path.join(DATA_DIR,'jobs.json')
const DLQ_FILE = path.join(DATA_DIR,'dlq.json')

function checkData(){
    if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    if(!fs.existsSync(JOBS_FILE)) fs.writeFileSync(JOBS_FILE);
    if(!fs.existsSync(DLQ_FILE)) fs.writeFileSync(DLQ_FILE);

} 

function readJson(filePath) {
  try {
    checkData();
    const txt = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(txt || '[]');
  } catch (e) {
    return [];
  }
}

function writeJson(filePath, obj) {
  checkData();
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function loadJobs() {
  return readJson(JOBS_FILE);
}

function saveJobs(jobs) {
  writeJson(JOBS_FILE, jobs);
}

function loadDLQ() {
  return readJson(DLQ_FILE);
}

function saveDLQ(dlq) {
  writeJson(DLQ_FILE, dlq);
}

module.exports = {
  loadJobs,
  saveJobs,
  loadDLQ,
  saveDLQ,
  JOBS_FILE,
  DLQ_FILE
};