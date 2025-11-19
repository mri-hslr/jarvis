// =======================================================
// FOCUS MANAGER - Productivity Enhancement System
// =======================================================
//
// PURPOSE: Helps users focus by identifying and managing
// resource-intensive applications that might be distracting
//
// WHAT IT DOES:
// 1. Scans running processes for CPU/memory hogs
// 2. Identifies potential distractions (browsers, media apps, etc.)
// 3. Lowers their priority so they don't slow down your work
// 4. Can pause them completely if you choose
//
// HOW "LOWERING PRIORITY" HELPS:
// - Makes distracting apps run slower (less CPU time)
// - Gives more resources to your important work (IDE, terminal)
// - Apps stay open but become less responsive/tempting
// - Like putting your phone on silent instead of turning it off
//
// =======================================================

import psList from "ps-list";
import pidusage from "pidusage";
import { exec } from "child_process";
import os from "os";
import { speak } from "./index.js";

// System processes that should NEVER be touched
const SYSTEM_IGNORE = new Set([
    "kernel_task",
    "launchd",
    "windowserver",
    "syslogd",
    "usereventagent",
    "distnoted",
    "mds",
    "mds_stores",
    "coreaudiod"
]);

// Apps you're using for work - PROTECTED from focus mode
const PROTECTED = [
    "code",
    "visual studio code",
    "vscode",
    "terminal",
    "iterm",
    "brave",
    "brave-browser",
    "brave browser",
    "node",
    "python"
];

// Track which processes we've modified
const originalNice = {};  // Store original priority values
const modified = new Set();  // PIDs we've lowered priority for
const paused = new Set();    // PIDs we've paused


// =======================================================
// UTILITY FUNCTIONS
// =======================================================

function execCmd(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout) => {
            if (err) reject(err);
            else resolve(stdout.trim());
        });
    });
}

/**
 * Get the "niceness" value of a process
 * Niceness ranges from -20 (highest priority) to +19 (lowest priority)
 * Default is 0
 */
async function getNice(pid) {
    try {
        const ni = await execCmd(`ps -o ni= -p ${pid}`);
        return parseInt(ni, 10);
    } catch {
        return 0;
    }
}

/**
 * Change process priority (renice)
 * 
 * @param {number} pid - Process ID
 * @param {number} delta - How much to change priority (+10 = lower priority)
 * 
 * WHAT THIS DOES:
 * - Positive delta (+10) = Lower priority = Process gets less CPU time
 * - Negative delta (-10) = Higher priority = Process gets more CPU time
 * - This is like telling the OS: "This app is less important right now"
 * 
 * USER BENEFIT:
 * - YouTube running in background? Lower its priority.
 * - Now it won't compete with your code editor for CPU
 * - Your work apps stay fast and responsive
 * - Distraction apps become sluggish and less tempting
 */
async function renice(pid, delta) {
    if (!["darwin", "linux"].includes(os.platform())) return;

    const curr = await getNice(pid);
    const next = curr + delta;

    // Save original priority so we can restore it later
    if (!(pid in originalNice))
        originalNice[pid] = curr;

    try {
        await execCmd(`sudo renice ${next} -p ${pid}`);
        modified.add(pid);
        console.log(`  ↓ Lowered priority: PID ${pid} (${curr} → ${next})`);
    } catch (err) {
        console.log(`  ⚠️  Could not renice PID ${pid}`);
    }
}

/**
 * Restore all processes to their original priority
 */
async function restoreNiceness() {
    console.log("\n🔄 Restoring all process priorities...");
    for (const pid of modified) {
        const original = originalNice[pid];
        if (original !== undefined) {
            try {
                await execCmd(`sudo renice ${original} -p ${pid}`);
                console.log(`  ↑ Restored: PID ${pid} to priority ${original}`);
            } catch {}
        }
    }
    modified.clear();
}

/**
 * PAUSE a process (SIGSTOP)
 * 
 * WHAT THIS DOES:
 * - Completely freezes the application
 * - It stops using CPU entirely
 * - Like pressing "pause" on a video
 * - Window stays visible but completely unresponsive
 * 
 * USER BENEFIT:
 * - Spotify playing music? Pause it instantly.
 * - Browser with 50 tabs? Freeze it completely.
 * - Zero CPU usage from distractions
 * - Can resume later when you're done working
 */
function pause(pid) {
    try {
        process.kill(pid, "SIGSTOP");
        paused.add(pid);
        console.log(`  ⏸️  Paused: PID ${pid}`);
    } catch (err) {
        console.log(`  ⚠️  Could not pause PID ${pid}`);
    }
}

/**
 * RESUME a paused process (SIGCONT)
 */
function resume(pid) {
    try {
        process.kill(pid, "SIGCONT");
        paused.delete(pid);
        console.log(`  ▶️  Resumed: PID ${pid}`);
    } catch {}
}

/**
 * Check if process is protected (your work apps)
 */
function isProtected(name, cmd) {
    name = name.toLowerCase();
    cmd = cmd.toLowerCase();
    return PROTECTED.some(p => name.includes(p) || cmd.includes(p));
}

/**
 * Check if process is a system process
 */
function isSystem(name) {
    name = name.toLowerCase();
    return Array.from(SYSTEM_IGNORE).some(s => name.includes(s));
}


// =======================================================
// MAIN FOCUS MODE LOGIC
// =======================================================

/**
 * Evaluate and act on distracting processes
 * 
 * WORKFLOW:
 * 1. Get all running processes
 * 2. Measure their CPU and memory usage
 * 3. Filter out system processes and your work apps
 * 4. Find processes using too much CPU/memory
 * 5. Lower their priority (make them slower)
 * 6. Report findings to user
 * 
 * @param {Object} options
 * @param {number} options.cpuPercent - Min CPU % to be considered distracting (default: 10%)
 * @param {number} options.memMB - Min memory MB to be considered distracting (default: 200MB)
 * @param {number} options.topN - How many top processes to check (default: 10)
 * 
 * EXAMPLE SCENARIO:
 * You say "start focus mode"
 * Jarvis finds:
 * - Chrome using 45% CPU (watching YouTube)
 * - Spotify using 8% CPU (playing music)
 * - Slack using 12% CPU (notifications)
 * 
 * Jarvis lowers their priority by +10
 * Now these apps get much less CPU time
 * Your VS Code editor stays fast
 * Distractions become sluggish and less tempting
 */
export async function evaluateAndActOnDistractions({
    cpuPercent = 10,
    memMB = 200,
    topN = 10
} = {}) {

    console.log("\n🔍 Scanning for distracting processes...");

    // Get all running processes
    const all = await psList();
    
    // Get CPU and memory usage for each
    const usage = await pidusage(all.map(p => p.pid));

    // Combine process info with usage stats
    const merged = all.map(p => ({
        pid: p.pid,
        name: p.name || "",
        cmd: p.cmd || "",
        cpu: usage[p.pid]?.cpu || 0,
        mem: (usage[p.pid]?.memory || 0) / (1024 * 1024)  // Convert to MB
    }));

    // Sort by CPU usage (highest first)
    merged.sort((a, b) => b.cpu - a.cpu);

    // Take top N most CPU-intensive
    const top = merged.slice(0, topN);

    // Filter for actual distractions
    const candidates = top.filter(p => {
        // Skip system processes
        if (isSystem(p.name)) return false;
        
        // Skip your work apps
        if (isProtected(p.name, p.cmd)) return false;
        
        // Skip processes below threshold
        if (p.cpu < cpuPercent && p.mem < memMB) return false;
        
        return true;
    });

    console.log(`📊 Found ${candidates.length} potential distractions:`);
    for (const p of candidates) {
        console.log(`  - ${p.name}: ${p.cpu.toFixed(1)}% CPU, ${p.mem.toFixed(0)}MB RAM`);
    }

    if (candidates.length === 0) {
        console.log("✅ No distracting processes found!");
        return { acted: false, candidates: [] };
    }

    // Create spoken summary
    const summary = candidates.map(p =>
        `${p.name} using ${p.cpu.toFixed(0)} percent CPU`
    ).join(", ");

    await speak(`I found ${candidates.length} distracting processes: ${summary}.`);

    // Lower priority of all candidates
    console.log("\n⬇️  Lowering priority of distractions...");
    for (const p of candidates) {
        await renice(p.pid, 10);  // +10 = significantly lower priority
    }

    return { acted: true, candidates };
}


/**
 * End focus mode - restore everything to normal
 * 
 * WHAT THIS DOES:
 * 1. Restore all process priorities to original values
 * 2. Resume any paused processes
 * 3. Clean up tracking
 * 
 * This is like "undo" for focus mode
 */
export async function endFocusMode() {
    console.log("\n🛑 Ending focus mode...");
    
    // Restore priorities
    await restoreNiceness();
    
    // Resume any paused processes
    for (const pid of Array.from(paused)) {
        resume(pid);
    }
    
    await speak("Focus mode ended. Everything restored to normal.");
    console.log("✅ Focus mode ended\n");
}


// =======================================================
// EXAMPLE USAGE FLOW
// =======================================================
//
// USER: "Jarvis"
// JARVIS: "Yes, I am here. How can I help you?"
//
// USER: "Start focus mode"
// JARVIS: "Starting focus mode. Scanning for distractions."
// [Scans processes]
// JARVIS: "I found 3 distracting processes: Chrome using 45 percent,
//         Spotify using 8 percent, Slack using 12 percent."
// [Lowers their priority by +10]
// JARVIS: "Say pause them or keep them."
//
// USER: "Pause them"
// [Completely freezes Chrome, Spotify, Slack]
// JARVIS: "I have paused them."
//
// [You work for 2 hours distraction-free]
//
// USER: "End focus mode"
// [Restores priority, resumes paused apps]
// JARVIS: "Focus mode ended. Everything restored."
//
// =======================================================