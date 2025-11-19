// =======================================================
// INTELLIGENT SCHEDULER - Voice-Driven Time Manager
// =======================================================
//
// OS CONCEPTS IMPLEMENTED:
// 1. Software Timers - implements user-space timing mechanism
// 2. Event Loop Integration - works with Node's async I/O
// 3. Task Scheduling - mimics OS scheduler at user level
// 4. Periodic Tasks - like cron/launchd but voice-controlled
// 5. Time Multiplexing - manages multiple concurrent timers
//
// This is like building "cron + Calendar + Brain" in user-space
// =======================================================

import fs from "fs";
import path from "path";
import { speak } from "./index.js";

// =======================================================
// CONFIGURATION
// =======================================================

const STORAGE_FILE = path.join(process.cwd(), "scheduler_data.json");

const PRESETS = {
    pomodoro: 25 * 60,      // 25 minutes
    shortBreak: 5 * 60,     // 5 minutes
    longBreak: 15 * 60,     // 15 minutes
    hour: 60 * 60,          // 1 hour
    halfHour: 30 * 60,      // 30 minutes
};

// =======================================================
// DATA STRUCTURES
// =======================================================

let tasks = [];              // All scheduled tasks
let reminders = [];          // One-time reminders
let intervals = [];          // Recurring reminders
let focusSession = null;     // Active focus/pomodoro session
let workStats = {            // Track productivity patterns
    sessionsToday: 0,
    totalFocusTime: 0,
    lastSessionEnd: null
};

// =======================================================
// PERSISTENCE
// =======================================================

/**
 * Load tasks from disk
 * Implements persistent storage - like OS keeping state across reboots
 */
function loadData() {
    try {
        if (fs.existsSync(STORAGE_FILE)) {
            const data = JSON.parse(fs.readFileSync(STORAGE_FILE, "utf-8"));
            tasks = data.tasks || [];
            reminders = data.reminders || [];
            intervals = data.intervals || [];
            workStats = data.workStats || workStats;
            console.log(`📂 Loaded ${tasks.length} tasks, ${reminders.length} reminders, ${intervals.length} intervals`);
        }
    } catch (err) {
        console.error("❌ Failed to load scheduler data:", err.message);
    }
}

/**
 * Save tasks to disk
 */
function saveData() {
    try {
        const data = {
            tasks,
            reminders,
            intervals,
            workStats,
            lastSaved: new Date().toISOString()
        };
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("❌ Failed to save scheduler data:", err.message);
    }
}

// =======================================================
// TASK MANAGEMENT
// =======================================================

/**
 * Add a one-time reminder
 * 
 * @param {string} text - What to remind
 * @param {number} delaySeconds - How long to wait
 * 
 * OS CONCEPT: Software timer - schedules callback after delay
 */
export async function addReminder(text, delaySeconds) {
    const triggerTime = Date.now() + (delaySeconds * 1000);
    
    const reminder = {
        id: Date.now(),
        text,
        triggerTime,
        type: "reminder"
    };
    
    reminders.push(reminder);
    saveData();
    
    const minutes = Math.floor(delaySeconds / 60);
    const seconds = delaySeconds % 60;
    
    let timeStr = "";
    if (minutes > 0) timeStr += `${minutes} minute${minutes > 1 ? 's' : ''}`;
    if (seconds > 0) {
        if (minutes > 0) timeStr += " and ";
        timeStr += `${seconds} second${seconds > 1 ? 's' : ''}`;
    }
    
    await speak(`Reminder set for ${timeStr}. I will remind you to ${text}.`);
    console.log(`⏰ Reminder: "${text}" in ${timeStr}`);
}

/**
 * Add a recurring interval reminder
 * 
 * @param {string} text - What to remind
 * @param {number} intervalSeconds - How often to repeat
 * 
 * OS CONCEPT: Periodic timer - like kernel tick interrupts
 */
export async function addInterval(text, intervalSeconds) {
    const nextTrigger = Date.now() + (intervalSeconds * 1000);
    
    const interval = {
        id: Date.now(),
        text,
        intervalSeconds,
        nextTrigger,
        type: "interval"
    };
    
    intervals.push(interval);
    saveData();
    
    const minutes = Math.floor(intervalSeconds / 60);
    await speak(`Recurring reminder set. I will remind you to ${text} every ${minutes} minutes.`);
    console.log(`🔄 Interval: "${text}" every ${minutes} minutes`);
}

/**
 * Start a focus/pomodoro session
 * 
 * @param {number} durationMinutes - Session length
 * 
 * OS CONCEPT: Time-bounded execution - enforces time limits
 */
export async function startFocusSession(durationMinutes) {
    if (focusSession) {
        await speak("A focus session is already running.");
        return;
    }
    
    const durationSeconds = durationMinutes * 60;
    const endTime = Date.now() + (durationSeconds * 1000);
    
    focusSession = {
        startTime: Date.now(),
        endTime,
        durationMinutes,
        warningGiven: false
    };
    
    workStats.sessionsToday++;
    saveData();
    
    await speak(`Focus session started for ${durationMinutes} minutes. I will notify you when time is up.`);
    console.log(`🎯 Focus session: ${durationMinutes} minutes`);
}

/**
 * End current focus session
 */
export async function endFocusSession() {
    if (!focusSession) {
        await speak("No focus session is active.");
        return;
    }
    
    const elapsed = Math.floor((Date.now() - focusSession.startTime) / 1000 / 60);
    workStats.totalFocusTime += elapsed;
    workStats.lastSessionEnd = Date.now();
    
    focusSession = null;
    saveData();
    
    await speak(`Focus session ended. You worked for ${elapsed} minutes. Great job!`);
    console.log(`✅ Focus session completed: ${elapsed} minutes`);
}

/**
 * List all active tasks
 */
export async function listTasks() {
    const now = Date.now();
    const upcoming = [];
    
    // One-time reminders
    for (const r of reminders) {
        const remaining = Math.floor((r.triggerTime - now) / 1000 / 60);
        if (remaining > 0) {
            upcoming.push(`${r.text} in ${remaining} minutes`);
        }
    }
    
    // Intervals
    for (const i of intervals) {
        const remaining = Math.floor((i.nextTrigger - now) / 1000 / 60);
        upcoming.push(`${i.text} every ${Math.floor(i.intervalSeconds / 60)} minutes`);
    }
    
    // Focus session
    if (focusSession) {
        const remaining = Math.floor((focusSession.endTime - now) / 1000 / 60);
        upcoming.push(`Focus session: ${remaining} minutes remaining`);
    }
    
    if (upcoming.length === 0) {
        await speak("You have no active tasks or reminders.");
        return;
    }
    
    let response = `You have ${upcoming.length} active task${upcoming.length > 1 ? 's' : ''}. `;
    response += upcoming.slice(0, 3).join(". ");
    
    await speak(response);
    
    console.log("\n📋 Active Tasks:");
    upcoming.forEach(t => console.log(`  - ${t}`));
    console.log();
}

/**
 * Clear all reminders and timers
 */
export async function clearAll() {
    reminders = [];
    intervals = [];
    focusSession = null;
    saveData();
    
    await speak("All reminders and timers cleared.");
    console.log("🗑️  Cleared all tasks");
}

/**
 * Get productivity stats
 */
export async function getStats() {
    const stats = `You have completed ${workStats.sessionsToday} focus sessions today, totaling ${workStats.totalFocusTime} minutes of focused work.`;
    await speak(stats);
    
    console.log("\n📊 Productivity Stats:");
    console.log(`  Sessions today: ${workStats.sessionsToday}`);
    console.log(`  Total focus time: ${workStats.totalFocusTime} minutes`);
    console.log();
}


// =======================================================
// PRESET COMMANDS
// =======================================================

/**
 * Start a Pomodoro session (25 minutes)
 */
export async function startPomodoro() {
    await startFocusSession(25);
}

/**
 * Start a short break (5 minutes)
 */
export async function startShortBreak() {
    await addReminder("take a break", PRESETS.shortBreak);
}

/**
 * Start a long break (15 minutes)
 */
export async function startLongBreak() {
    await addReminder("end your break", PRESETS.longBreak);
}

/**
 * Remind to drink water every hour
 */
export async function remindWater() {
    await addInterval("drink water", PRESETS.hour);
}

/**
 * Remind to stretch every 30 minutes
 */
export async function remindStretch() {
    await addInterval("stretch", PRESETS.halfHour);
}


// =======================================================
// SCHEDULER LOOP (The Heart)
// =======================================================

/**
 * Main scheduler loop
 * Runs every second to check for triggered tasks
 * 
 * OS CONCEPT: This is like the kernel scheduler but for user tasks
 * - Implements cooperative multitasking
 * - Checks timer queue every tick
 * - Executes callbacks when time arrives
 */
async function schedulerLoop() {
    const now = Date.now();
    
    // Check one-time reminders
    const triggeredReminders = reminders.filter(r => r.triggerTime <= now);
    if (triggeredReminders.length > 0) {
        for (const r of triggeredReminders) {
            console.log(`⏰ REMINDER: ${r.text}`);
            await speak(`Reminder: ${r.text}`);
        }
        reminders = reminders.filter(r => r.triggerTime > now);
        saveData();
    }
    
    // Check recurring intervals
    for (const interval of intervals) {
        if (interval.nextTrigger <= now) {
            console.log(`🔄 INTERVAL: ${interval.text}`);
            await speak(`Reminder: ${interval.text}`);
            
            // Schedule next occurrence
            interval.nextTrigger = now + (interval.intervalSeconds * 1000);
            saveData();
        }
    }
    
    // Check focus session
    if (focusSession) {
        const remaining = Math.floor((focusSession.endTime - now) / 1000 / 60);
        
        // 5-minute warning
        if (!focusSession.warningGiven && remaining <= 5 && remaining > 4) {
            focusSession.warningGiven = true;
            await speak("Five minutes remaining in your focus session.");
        }
        
        // Session complete
        if (now >= focusSession.endTime) {
            await speak("Focus session complete. Time for a break!");
            const elapsed = Math.floor((now - focusSession.startTime) / 1000 / 60);
            workStats.totalFocusTime += elapsed;
            workStats.lastSessionEnd = now;
            focusSession = null;
            saveData();
        }
    }
}

// Start the scheduler loop (runs every second)
// This is the "tick" of our user-space scheduler
setInterval(schedulerLoop, 1000);


// =======================================================
// INITIALIZATION
// =======================================================

// Load persisted data on startup
loadData();

console.log("⏰ Scheduler initialized");
console.log(`   Active reminders: ${reminders.length}`);
console.log(`   Active intervals: ${intervals.length}`);
console.log(`   Sessions today: ${workStats.sessionsToday}\n`);


// =======================================================
// EXPORT API
// =======================================================

export default {
    addReminder,
    addInterval,
    startFocusSession,
    endFocusSession,
    listTasks,
    clearAll,
    getStats,
    startPomodoro,
    startShortBreak,
    startLongBreak,
    remindWater,
    remindStretch
};