# Concurrency with Sesi

This document details how Sesi handles process concurrency and file locks.

## The "Bank" Case Study

In this experiment, Sesi was used to solve file contention.

### The Challenge

Five independent Sesi instances (3 Deposits, 2 Withdrawals) were launched simultaneously. All instances needed to update a single `balance.txt` file without causing data loss through race conditions.

### The Solution (Mutex / File Locking)

Sesi solves this using file locking via `try/catch` and file I/O builtins.

#### 1. Unique Identity

Each instance generates a unique ID using Sesi's native `time()` and `random()` builtins.

```sesi
let id = "Agent_" + str(time()) + "_" + str(random())
```

#### 2. Mutual Exclusion Loop

The agent "polls" the lock file. If it finds it "unlocked," it attempts to claim it. Crucially, it then **verifies** its own claim after a micro-delay to ensure it wasn't overwritten by a simultaneous process.

```sesi
while locked {
  if read_file("lock.txt") == "unlocked" {
    write_file("lock.txt", id)
    // Settle delay
    let i = 0 while i < 500 { i = i + 1 }
    // Verification
    if read_file("lock.txt") == id { locked = false }
  }
}
```

#### 3. Critical Section Resilience

Using `try/catch`, Sesi scripts gracefully handle filesystem contention.

```sesi
try {
  write_file("balance.txt", str(num(read_file("balance.txt")) + 100))
  write_file("lock.txt", "unlocked") // Release
} catch (e) {
  write_file("lock.txt", "unlocked") // Emergency release
}
```

## Concurrency via `spawn()`

Sesi v1.1 introduced the `spawn()` builtin, allowing a single **Master Orchestrator** to launch concurrent proccesses of sesi scripts from one main file.

```sesi
// Master: Launching 5 Concurrent Processes...
spawn("main/atm_deposit.sesi")
spawn("main/atm_withdraw.sesi")
spawn("main/atm_deposit.sesi")
spawn("main/atm_withdraw.sesi")
spawn("main/atm_deposit.sesi")
```

## Why This Matters

Sesi's approach to distributed systems is **Concise** and **Readable**. What would take dozens of lines of boilerplate in C or Java (handling threads, mutexes, and I/O exceptions) is expressed in Sesi as a series of intuitive blocks.

This enables developers to build **Agent Swarms** that can work in parallel on large-scale datasets, research tasks, or code generation pipelines with guaranteed state integrity.
