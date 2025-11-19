// =================================================
// JARVIS MAIN FILE (index.js) - COMPLETE VERSION
// =================================================

import fetch from "node-fetch";
import say from "say";
import fs from "fs";
import open from "open";
import { exec } from "child_process";
import os from "os";

import {
    evaluateAndActOnDistractions,
    endFocusMode
} from "./focusManager.js";

import {
    startMonitoring,
    stopMonitoring,
    getSystemStatus,
    optimizeSystem
} from "./resourceMonitor.js";

import {
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
} from "./scheduler.js";


// =================================================
// 1. IMPROVED SPEAK FUNCTION (GUARANTEED NO ECHO)
// =================================================
async function speak(text, voice = "Samantha", speed = 1.0) {
    console.log(`🔊 SPEAKING: "${text}"`);
    
    // Track what we're saying to filter echoes
    const phrases = text.toLowerCase().split(/[.!?,]+/).map(s => s.trim()).filter(Boolean);
    phrases.forEach(p => recentSpeech.add(p));
    setTimeout(() => {
        phrases.forEach(p => recentSpeech.delete(p));
    }, 10000);  // Remember for 10 seconds

    // 1 — MUTE immediately and WAIT for confirmation
    try {
        await fetch("http://127.0.0.1:5000/mute", { method: "POST" });
        console.log("  ✓ Muted listener");
    } catch (err) {
        console.log("  ⚠️ Mute failed:", err.message);
    }

    // 2 — CRITICAL: Wait longer to ensure mute is active
    await new Promise(r => setTimeout(r, 300));

    // 3 — Speak with callback
    console.log(`  🎵 Starting speech synthesis...`);
    try {
        await new Promise((resolve, reject) => {
            say.speak(text, voice, speed, (error) => {
                if (error) {
                    console.error("  ❌ Speech error:", error);
                    reject(error);
                } else {
                    console.log("  ✅ Speech synthesis completed");
                    resolve();
                }
            });
        });
    } catch (err) {
        console.error("  ❌ Failed to speak:", err);
    }

    // 4 — CRITICAL: Long delay to let ALL audio finish playing
    //     macOS audio output has significant buffer delay
    await new Promise(r => setTimeout(r, 1500));

    // 5 — UNMUTE
    try {
        await fetch("http://127.0.0.1:5000/unmute", { method: "POST" });
        console.log("  ✓ Unmuted listener");
    } catch (err) {
        console.log("  ⚠️ Unmute failed:", err.message);
    }

    // 6 — Wait before next command to let mic stabilize
    await new Promise(r => setTimeout(r, 500));
    console.log("  ✓ Ready for next command\n");
}

export { speak };


// =================================================
// 2. FILE + APP OPERATIONS
// =================================================

async function createfile(file, content) {
    fs.writeFileSync(file, content);
    await speak(`${file} has been created`);
}

async function readfile(file) {
    if (!fs.existsSync(file)) return speak(`file ${file} does not exist`);
    const data = fs.readFileSync(file, "utf-8");
    await speak(`reading file ${file}. it says ${data}`);
}

async function deletefile(file) {
    if (!fs.existsSync(file)) return speak(`${file} does not exist`);
    fs.unlinkSync(file);
    await speak(`${file} has been deleted`);
}

async function openwebsite(url, name) {
    await speak(`opening ${name}`);
    await open(url.startsWith("http") ? url : `https://${url}`);
}

async function openfile(path) {
    if (!fs.existsSync(path)) return speak("file does not exist");
    await speak(`opening ${path}`);

    if (os.platform() === "darwin") exec(`open "${path}"`);
    else if (os.platform() === "win32") exec(`start "" "${path}"`);
    else exec(`xdg-open "${path}"`);
}

async function openapp(appname) {
    await speak(`opening ${appname}`);
    if (os.platform() === "darwin") exec(`open -a "${appname}"`);
    else if (os.platform() === "win32") exec(`start ${appname}`);
    else exec(`${appname}`);
}


// =================================================
// 3. COMMAND HANDLER
// =================================================

const recentCommands = new Map();
const recentSpeech = new Set();  // Track what Jarvis just said
let isProcessing = false;

async function handleCommand(cmdRaw) {
    const command = cmdRaw.toLowerCase().trim();
    
    // CRITICAL: Filter out echo of Jarvis's own speech
    // Check if this matches what Jarvis just said
    for (const phrase of recentSpeech) {
        if (command.includes(phrase) || phrase.includes(command)) {
            console.log(`🔇 ECHO FILTERED: "${command}" (matches recent speech)`);
            return;
        }
    }
    
    // Prevent duplicate/echo processing
    const now = Date.now();
    const lastTime = recentCommands.get(command) || 0;
    
    if (now - lastTime < 3000) {
        console.log(`⏭️  Skipping duplicate: "${command}"`);
        return;
    }
    
    recentCommands.set(command, now);
    
    // Cleanup old entries
    for (const [cmd, time] of recentCommands.entries()) {
        if (now - time > 5000) recentCommands.delete(cmd);
    }

    // Prevent overlapping command execution
    if (isProcessing) {
        console.log("⏳ Already processing a command, skipping...");
        return;
    }

    isProcessing = true;
    console.log(`🎤 VOICE COMMAND: "${command}"`);

    try {
        // WAKE WORD
        if (["jarvis", "hey jarvis", "hi jarvis", "okay jarvis"].includes(command)) {
            await speak("Yes, I am here. How can I help you?");
            return;
        }

        // ============================================
        // FOCUS MODE
        // ============================================
        if (command === "start focus mode" || command === "focus mode") {
            await speak("Starting focus mode. Scanning for distractions.");
            const res = await evaluateAndActOnDistractions({
                cpuPercent: 8,
                memMB: 150,
                topN: 12
            });
            if (res.acted) {
                await speak("Say pause them or keep them.");
            } else {
                await speak("No distracting processes found. You're all set.");
            }
            return;
        }

        if (command === "pause them" || command === "pause all") {
            const res = await evaluateAndActOnDistractions({
                cpuPercent: 1,
                memMB: 1,
                topN: 20
            });
            for (const p of res.candidates) {
                try { process.kill(p.pid, "SIGSTOP"); } catch {}
            }
            await speak("I have paused them.");
            return;
        }

        if (command === "keep them" || command === "keep all") {
            await speak("Okay, keeping them running.");
            return;
        }

        if (command === "end focus mode" || command === "stop focus mode") {
            await endFocusMode();
            return;
        }

        // ============================================
        // RESOURCE MONITORING
        // ============================================
        if (command === "start monitoring" || command === "monitor system") {
            await startMonitoring();
            return;
        }

        if (command === "stop monitoring") {
            await stopMonitoring();
            return;
        }

        if (command === "system status" || command === "check system") {
            await getSystemStatus();
            return;
        }

        if (command === "optimize system" || command === "clean system") {
            await optimizeSystem();
            return;
        }

        // ============================================
        // SCHEDULER & TIME MANAGEMENT
        // ============================================
        
        // Pomodoro & Focus Sessions
        if (command === "start pomodoro" || command === "pomodoro") {
            await startPomodoro();
            return;
        }

        if (command === "start focus session") {
            await startFocusSession(25);
            return;
        }

        if (command === "end session" || command === "stop session") {
            await endFocusSession();
            return;
        }

        // Quick Break Commands
        if (command === "short break" || command === "take a break") {
            await startShortBreak();
            return;
        }

        if (command === "long break") {
            await startLongBreak();
            return;
        }

        // Recurring Reminders
        if (command === "remind me to drink water") {
            await remindWater();
            return;
        }

        if (command === "remind me to stretch") {
            await remindStretch();
            return;
        }

        // Generic reminders with time parsing
        if (command.startsWith("remind me in")) {
            const match = command.match(/remind me in (\d+) (minute|minutes|hour|hours) to (.+)/);
            if (match) {
                const amount = parseInt(match[1]);
                const unit = match[2];
                const task = match[3];
                
                const seconds = unit.startsWith("hour") ? amount * 3600 : amount * 60;
                await addReminder(task, seconds);
                return;
            }
        }

        // Task Management
        if (command === "list tasks" || command === "what's on my schedule") {
            await listTasks();
            return;
        }

        if (command === "clear all tasks" || command === "clear schedule") {
            await clearAll();
            return;
        }

        if (command === "my stats" || command === "productivity stats") {
            await getStats();
            return;
        }

        // ============================================
        // WEBSITES
        // ============================================
        if (command === "open youtube" || command === "youtube") {
            return openwebsite("https://youtube.com", "YouTube");
        }
        if (command === "open google" || command === "google") {
            return openwebsite("https://google.com", "Google");
        }
        if (command === "open instagram" || command === "instagram") {
            return openwebsite("https://instagram.com", "Instagram");
        }

        // ============================================
        // APPS
        // ============================================
        if (command === "open chrome" || command === "chrome") {
            return openapp("Google Chrome");
        }
        if (command === "open whatsapp" || command === "whatsapp") {
            return openapp("WhatsApp");
        }
        if (command === "open safari" || command === "safari") {
            return openapp("Safari");
        }

        // ============================================
        // FILES
        // ============================================
        if (command === "create demo file") {
            return createfile("demo.txt", "This is a demo file");
        }
        if (command === "read demo file") {
            return readfile("demo.txt");
        }
        if (command === "delete demo file") {
            return deletefile("demo.txt");
        }
        if (command === "open demo file") {
            return openfile("demo.txt");
        }

        // ============================================
        // UTILITIES
        // ============================================
        if (command === "what time is it" || command === "time") {
            return speak(`The time is ${new Date().toLocaleTimeString()}`);
        }
        if (command === "what date is it" || command === "date") {
            return speak(`Today is ${new Date().toLocaleDateString()}`);
        }

        // ============================================
        // POLITE
        // ============================================
        if (command.includes("thank you") || command === "thanks") {
            return speak("You're welcome!");
        }
        if (command.includes("goodbye") || command === "bye") {
            return speak("Goodbye! Have a great day!");
        }

        // ============================================
        // UNKNOWN COMMAND
        // ============================================
        await speak("Sorry, I did not understand that command.");

    } catch (err) {
        console.error("❌ Command error:", err);
        try {
            await speak("Sorry, something went wrong.");
        } catch {}
    } finally {
        isProcessing = false;
    }
}


// =================================================
// 4. POLL PYTHON API
// =================================================

let consecutiveErrors = 0;
const MAX_ERRORS = 10;

async function pollVoice() {
    try {
        const res = await fetch("http://127.0.0.1:5000/listen_and_consume", {
            timeout: 2000
        });
        const data = await res.json();
        const text = data.text?.trim();

        if (text) {
            await handleCommand(text);
        }
        
        consecutiveErrors = 0;

    } catch (err) {
        consecutiveErrors++;
        
        if (consecutiveErrors >= MAX_ERRORS) {
            console.error("❌ Too many polling errors. Is Python listener running?");
            console.error("   Start it with: python3 listener.py");
            process.exit(1);
        }
    }
}


// =================================================
// 5. START JARVIS
// =================================================

console.log("🤖 Jarvis is starting...");
console.log("📡 Connecting to voice listener...");

// Check if Python listener is running
try {
    await fetch("http://127.0.0.1:5000/status");
    console.log("✅ Voice listener connected");
    console.log("🎤 Listening for commands...");
    console.log("\n📋 Available Commands:");
    console.log("\n  🗣️  Wake Word:");
    console.log("    - 'Jarvis'");
    console.log("\n  🎯 Focus Mode:");
    console.log("    - 'Start focus mode'");
    console.log("    - 'End focus mode'");
    console.log("\n  📊 Resource Monitoring:");
    console.log("    - 'Start monitoring'");
    console.log("    - 'Stop monitoring'");
    console.log("    - 'System status'");
    console.log("    - 'Optimize system'");
    console.log("\n  ⏰ Time Management:");
    console.log("    - 'Start pomodoro'");
    console.log("    - 'Start focus session'");
    console.log("    - 'End session'");
    console.log("    - 'Short break'");
    console.log("    - 'Remind me in 5 minutes to [task]'");
    console.log("    - 'Remind me to drink water'");
    console.log("    - 'List tasks'");
    console.log("    - 'My stats'");
    console.log("\n  🚀 Quick Actions:");
    console.log("    - 'Open YouTube'");
    console.log("    - 'What time is it'");
    console.log("    - 'Open Chrome'\n");
} catch {
    console.error("❌ Cannot connect to Python listener!");
    console.error("   Make sure to run: python3 listener.py");
    process.exit(1);
}

// Start polling at optimal rate
setInterval(pollVoice, 500);  // Poll every 500ms for responsiveness