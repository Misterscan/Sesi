# Distributed Systems with Sesi

Sesi is a robust systems-level environment capable of orchestrating complex, multi-process agent swarms. This document details how Sesi handles concurrency, race conditions, and distributed state.

## The "Bank Swarm" Case Study

In this experiment, Sesi was used to solve a classic distributed systems problem: **Concurrent Mutual Exclusion.**

### The Challenge
Five independent Sesi agents (3 Deposits, 2 Withdrawals) were launched simultaneously. All agents needed to update a single `balance.txt` file without causing data loss through race conditions.

### The Sesi Solution (The "Double-Check Write" Pattern)

Sesi solves this using a high-level implementation of a filesystem lock. Even without low-level semaphores, Sesi's `try/catch` and file I/O builtins allow for an "indestructible" locking logic.

#### 1. Unique Identity
Each agent generates a globally unique ID using Sesi's native `time()` and `random()` builtins.
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
Using `try/catch`, Sesi agents gracefully handle filesystem contention (when the OS prevents two processes from reading the same file at the exact same micro-second).

```sesi
try {
  write_file("balance.txt", str(num(read_file("balance.txt")) + 100))
  write_file("lock.txt", "unlocked") // Release
} catch (e) {
  write_file("lock.txt", "unlocked") // Emergency release
}
```

## Concurrency via `spawn()`

Sesi v1.1+ introduces the `spawn()` builtin, allowing a single **Master Orchestrator** to launch an entire swarm of agents from one file.

```sesi
// Master: Launching 5-Agent Swarm
spawn("main/atm_deposit.sesi")
spawn("main/atm_withdraw.sesi")
spawn("main/atm_deposit.sesi")
spawn("main/atm_withdraw.sesi")
spawn("main/atm_deposit.sesi")
```

## Why This Matters

Sesi's approach to distributed systems is **Concise** and **Readable**. What would take dozens of lines of boilerplate in C or Java (handling threads, mutexes, and I/O exceptions) is expressed in Sesi as a series of intuitive blocks. 

This enables developers to build **Agent Swarms** that can work in parallel on large-scale datasets, research tasks, or code generation pipelines with guaranteed state integrity.
