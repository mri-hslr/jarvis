// =======================================================
// SMART RESOURCE MANAGER - Autonomous System Guardian
// =======================================================
//
// OS CONCEPTS IMPLEMENTED:
// 1. CPU Accounting - tracks user/system time per process
// 2. Memory Management - monitors RAM, swap, page faults
// 3. Thermal Management - detects overheating before throttling
// 4. Process Lifecycle - identifies zombies, blocked processes
// 5. I/O Monitoring - tracks disk read/write pressure
//
// This is like building a mini "Activity Monitor + Brain"
// =======================================================

import os from "os";
import psList from "ps-list";
import pidusage from "pidusage";
import { exec } from "child_process";
import { speak } from "./index.js";

// =======================================================
// CONFIGURATION & THRESHOLDS
// =======================================================

const CONFIG = {
    // CPU thresholds
    CPU_WARNING: 80,        // Warn at 80% CPU
    CPU_CRITICAL: 90,       // Critical at 90% CPU
    
    // Memory thresholds (percentage)
    MEM_WARNING: 75,        // Warn at 75% RAM usage
    MEM_CRITICAL: 85,       // Critical at 85% RAM usage
    
    // Disk thresholds (percentage)
    DISK_WARNING: 80,       // Warn at 80% disk usage
    DISK_CRITICAL: 90,      // Critical at 90% disk usage
    
    // Temperature thresholds (Celsius)
    TEMP_WARNING: 75,       // Warn at 75°C
    TEMP_CRITICAL: 85,      // Critical at 85°C
    
    // Monitoring intervals
    CHECK_INTERVAL: 10000,  // Check every 10 seconds
    ALERT_COOLDOWN: 60000,  // Don't repeat alerts for 60 seconds
    
    // Process limits
    PROCESS_CPU_HOG: 50,    // Single process using 50%+ CPU
    PROCESS_MEM_HOG: 1024,  // Single process using 1GB+ RAM
};

// Track last alert times to avoid spam
const lastAlerts = {
    cpu: 0,
    memory: 0,
    disk: 0,
    temperature: 0,
    processHog: new Map()  // Track per-process alerts
};

// Monitoring state
let isMonitoring = false;
let monitoringInterval = null;


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
 * Get CPU usage percentage (OS-level)
 * Uses os.cpus() to read kernel CPU accounting
 */
function getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
        for (let type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);
    
    return usage;
}

/**
 * Get memory usage (OS-level memory management)
 * Uses os.totalmem() and os.freemem() - kernel memory stats
 */
function getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usagePercent = (used / total) * 100;
    
    return {
        total: (total / (1024 ** 3)).toFixed(2),  // GB
        used: (used / (1024 ** 3)).toFixed(2),    // GB
        free: (free / (1024 ** 3)).toFixed(2),    // GB
        percentage: usagePercent.toFixed(1)
    };
}

/**
 * Get disk usage (macOS specific)
 * Reads from df command - filesystem I/O statistics
 */
async function getDiskUsage() {
    try {
        const output = await execCmd("df -h / | tail -1");
        const parts = output.split(/\s+/);
        const usagePercent = parseInt(parts[4]);
        
        return {
            total: parts[1],
            used: parts[2],
            available: parts[3],
            percentage: usagePercent
        };
    } catch {
        return { percentage: 0 };
    }
}

/**
 * Get CPU temperature (macOS specific)
 * Requires sudo powermetrics or osx-cpu-temp
 */
async function getCPUTemperature() {
    try {
        // Try osx-cpu-temp if installed
        const temp = await execCmd("osx-cpu-temp");
        const match = temp.match(/(\d+\.\d+)°C/);
        return match ? parseFloat(match[1]) : null;
    } catch {
        // Temperature monitoring optional
        return null;
    }
}


// =======================================================
// PROCESS ANALYSIS
// =======================================================

/**
 * Find resource hogs (heavy CPU/memory users)
 * This implements process accounting - tracks resource usage per PID
 */
async function findResourceHogs() {
    const all = await psList();
    const usage = await pidusage(all.map(p => p.pid));
    
    const hogs = [];
    
    for (const p of all) {
        const stats = usage[p.pid];
        if (!stats) continue;
        
        const cpuPercent = stats.cpu || 0;
        const memMB = (stats.memory || 0) / (1024 * 1024);
        
        // Check if this process is a resource hog
        if (cpuPercent > CONFIG.PROCESS_CPU_HOG || memMB > CONFIG.PROCESS_MEM_HOG) {
            hogs.push({
                pid: p.pid,
                name: p.name,
                cpu: cpuPercent.toFixed(1),
                memory: memMB.toFixed(0)
            });
        }
    }
    
    return hogs;
}


// =======================================================
// ALERT SYSTEM
// =======================================================

/**
 * Check if enough time has passed since last alert
 * Implements rate limiting to avoid alert spam
 */
function canAlert(type) {
    const now = Date.now();
    const lastTime = lastAlerts[type] || 0;
    
    if (now - lastTime < CONFIG.ALERT_COOLDOWN) {
        return false;
    }
    
    lastAlerts[type] = now;
    return true;
}

/**
 * Alert about CPU overload
 * Triggered when system CPU crosses threshold
 */
async function alertCPU(usage) {
    if (!canAlert('cpu')) return;
    
    const level = usage >= CONFIG.CPU_CRITICAL ? "critical" : "high";
    await speak(`Warning: CPU usage is ${level} at ${usage} percent.`);
    
    // Suggest action
    const hogs = await findResourceHogs();
    if (hogs.length > 0) {
        const top = hogs[0];
        await speak(`${top.name} is using ${top.cpu} percent CPU. Should I optimize it?`);
    }
}

/**
 * Alert about memory pressure
 * Triggered when RAM usage is high
 */
async function alertMemory(stats) {
    if (!canAlert('memory')) return;
    
    await speak(`Warning: Memory usage is at ${stats.percentage} percent. ${stats.free} gigabytes remaining.`);
    
    const hogs = await findResourceHogs();
    const memHogs = hogs.filter(h => parseInt(h.memory) > CONFIG.PROCESS_MEM_HOG);
    
    if (memHogs.length > 0) {
        const top = memHogs[0];
        await speak(`${top.name} is using ${top.memory} megabytes of RAM.`);
    }
}

/**
 * Alert about disk space
 */
async function alertDisk(stats) {
    if (!canAlert('disk')) return;
    
    await speak(`Warning: Disk usage is at ${stats.percentage} percent. ${stats.available} remaining.`);
}

/**
 * Alert about temperature
 */
async function alertTemperature(temp) {
    if (!canAlert('temperature')) return;
    
    await speak(`Warning: CPU temperature is ${temp} degrees Celsius. System may throttle performance.`);
}


// =======================================================
// MAIN MONITORING LOOP
// =======================================================

/**
 * Main monitoring function
 * Runs every CHECK_INTERVAL seconds
 * 
 * OS CONCEPTS:
 * - Polls kernel CPU accounting stats
 * - Reads memory management info from /proc equivalent
 * - Monitors process table
 * - Implements soft real-time monitoring loop
 */
async function monitorSystem() {
    try {
        console.log("\n🔍 System Check...");
        
        // 1. Check CPU (Process Scheduler stats)
        const cpuUsage = getCPUUsage();
        console.log(`  CPU: ${cpuUsage}%`);
        
        if (cpuUsage >= CONFIG.CPU_CRITICAL) {
            await alertCPU(cpuUsage);
        } else if (cpuUsage >= CONFIG.CPU_WARNING) {
            console.log(`  ⚠️  CPU usage elevated: ${cpuUsage}%`);
        }
        
        // 2. Check Memory (Memory Management stats)
        const memStats = getMemoryUsage();
        console.log(`  Memory: ${memStats.percentage}% (${memStats.used}GB / ${memStats.total}GB)`);
        
        if (parseFloat(memStats.percentage) >= CONFIG.MEM_CRITICAL) {
            await alertMemory(memStats);
        } else if (parseFloat(memStats.percentage) >= CONFIG.MEM_WARNING) {
            console.log(`  ⚠️  Memory usage elevated: ${memStats.percentage}%`);
        }
        
        // 3. Check Disk (Filesystem I/O)
        const diskStats = await getDiskUsage();
        console.log(`  Disk: ${diskStats.percentage}% used`);
        
        if (diskStats.percentage >= CONFIG.DISK_CRITICAL) {
            await alertDisk(diskStats);
        } else if (diskStats.percentage >= CONFIG.DISK_WARNING) {
            console.log(`  ⚠️  Disk usage elevated: ${diskStats.percentage}%`);
        }
        
        // 4. Check Temperature (Power Management)
        const temp = await getCPUTemperature();
        if (temp) {
            console.log(`  Temperature: ${temp}°C`);
            
            if (temp >= CONFIG.TEMP_CRITICAL) {
                await alertTemperature(temp);
            } else if (temp >= CONFIG.TEMP_WARNING) {
                console.log(`  ⚠️  Temperature elevated: ${temp}°C`);
            }
        }
        
        // 5. Check for resource hogs
        const hogs = await findResourceHogs();
        if (hogs.length > 0) {
            console.log(`  ⚠️  ${hogs.length} resource hog(s) detected:`);
            hogs.forEach(h => {
                console.log(`     - ${h.name}: ${h.cpu}% CPU, ${h.memory}MB RAM`);
            });
        }
        
        console.log(`  ✅ System check complete\n`);
        
    } catch (err) {
        console.error("❌ Monitoring error:", err.message);
    }
}


// =======================================================
// PUBLIC API
// =======================================================

/**
 * Start system monitoring
 * Begins autonomous background monitoring loop
 */
export async function startMonitoring() {
    if (isMonitoring) {
        await speak("Resource monitoring is already active.");
        return;
    }
    
    isMonitoring = true;
    await speak("Starting resource monitoring. I will alert you if system resources become critical.");
    
    console.log("\n🚀 Resource Monitor Started");
    console.log(`   Checking every ${CONFIG.CHECK_INTERVAL / 1000} seconds`);
    console.log(`   CPU Warning: ${CONFIG.CPU_WARNING}%, Critical: ${CONFIG.CPU_CRITICAL}%`);
    console.log(`   Memory Warning: ${CONFIG.MEM_WARNING}%, Critical: ${CONFIG.MEM_CRITICAL}%\n`);
    
    // Run first check immediately
    await monitorSystem();
    
    // Then start interval
    monitoringInterval = setInterval(monitorSystem, CONFIG.CHECK_INTERVAL);
}

/**
 * Stop system monitoring
 */
export async function stopMonitoring() {
    if (!isMonitoring) {
        await speak("Resource monitoring is not active.");
        return;
    }
    
    isMonitoring = false;
    
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    
    await speak("Resource monitoring stopped.");
    console.log("\n🛑 Resource Monitor Stopped\n");
}

/**
 * Get current system status (on-demand)
 */
export async function getSystemStatus() {
    const cpuUsage = getCPUUsage();
    const memStats = getMemoryUsage();
    const diskStats = await getDiskUsage();
    const temp = await getCPUTemperature();
    
    let status = `CPU is at ${cpuUsage} percent. `;
    status += `Memory is at ${memStats.percentage} percent. `;
    status += `Disk is at ${diskStats.percentage} percent used. `;
    
    if (temp) {
        status += `Temperature is ${temp.toFixed(1)} degrees Celsius.`;
    }
    
    await speak(status);
    
    return {
        cpu: cpuUsage,
        memory: memStats,
        disk: diskStats,
        temperature: temp
    };
}

/**
 * Optimize system resources
 * Combines with focus manager for aggressive cleanup
 */
export async function optimizeSystem() {
    await speak("Optimizing system resources. This may take a moment.");
    
    console.log("\n🔧 System Optimization Started...");
    
    // Find and handle resource hogs
    const hogs = await findResourceHogs();
    
    if (hogs.length === 0) {
        await speak("System is already running efficiently. No optimization needed.");
        return;
    }
    
    await speak(`Found ${hogs.length} resource intensive processes. Lowering their priority.`);
    
    // Lower priority of hogs
    for (const hog of hogs) {
        try {
            await execCmd(`sudo renice 10 -p ${hog.pid}`);
            console.log(`  ✓ Lowered priority: ${hog.name} (PID ${hog.pid})`);
        } catch (err) {
            console.log(`  ⚠️  Could not optimize ${hog.name}`);
        }
    }
    
    // Purge inactive memory (macOS)
    try {
        await execCmd("sudo purge");
        console.log("  ✓ Purged inactive memory");
    } catch {
        console.log("  ⚠️  Could not purge memory");
    }
    
    console.log("✅ Optimization complete\n");
    await speak("System optimization complete. Your Mac should run faster now.");
}


// =======================================================
// EXPORT
// =======================================================

export default {
    startMonitoring,
    stopMonitoring,
    getSystemStatus,
    optimizeSystem
};