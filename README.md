# queuectl - CLI Based Job Queue System

This is a simple command line app made using Node.js.  
It is a small background job queue where you can add jobs, run workers to process them, retry failed jobs automatically, and check job status or the Dead Letter Queue (DLQ).

This project was made as part of an internship assignment.  
It is not a full production system but it shows how a job queue basically works.

---

## What it does

- Lets you add jobs that run shell commands like `echo hello` or `sleep 2`
- Runs one or more worker processes that pick and execute jobs
- Retries failed jobs automatically with exponential backoff
- Moves permanently failed jobs to the Dead Letter Queue (DLQ)
- Allows viewing or retrying DLQ jobs later
- Stores data in JSON files so it stays after restart
- Has simple CLI commands to interact with the queue

---

## Tech Used

- Node.js
- child_process module to run shell commands
- File based JSON storage
- No external libraries

---

## Setup Instructions

1. Clone or download this repository.

2. Open the project folder in VS Code or any terminal.

3. Run these commands once:
   ```
   npm init -y
   ```


To run commands, use:

```
node index.js <command> [options]
```

Or if you are using the VS Code terminal, you can directly use:

```
queuectl <command> [options]
```

Example Commands
Enqueue a job
```
node index.js enqueue '{"id":"job1","command":"echo hello && sleep 2","max_retries":3}'
```

Run workers
```
node index.js run --workers 2 --base 2
```

View all jobs
```
node index.js list
```

Check job status summary
```
node index.js status
```

View jobs in DLQ
```
node index.js dlq list
```

Retry a DLQ job
```
node index.js dlq retry job1
```

Stop workers gracefully
```
node index.js run stop
```

Here is the link for the app demo:
https://drive.google.com/file/d/1VmcZvBbhUfINJ3jaVRw68B4h9Z-ntB0a/view?usp=sharing


Notes

1.The system saves jobs in data/jobs.json and failed jobs in data/dlq.json.
2.It works fully offline and needs only Node.js installed.
3.If you enqueue a job with the same id twice, it will skip duplicates.
4.Some shell commands may behave slightly differently on Windows and Linux.
5.Each job can have its own max_retries value while enqueueing.
