// =================================================
// JARVIS MAIN FILE (index.js) - FIXED POLLING & TIMING
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


// =================================================
// 1. IMPROVED SPEAK FUNCTION (GUARANTEED NO ECHO)
// =================================================
async function speak(text, voice = null, speed = 1.0) {
    console.log(`SPEAKING: ${text}`);

    // 1 — MUTE immediately
    try {
        await fetch("http://127.0.0.1:5000/mute", { method: "POST" });
    } catch (err) {
        console.log("⚠️ Mute failed:", err.message);
    }

    // 2 — Small delay to ensure mute takes effect
    await new Promise(r => setTimeout(r, 100));

    // 3 — Speak with callback
    await new Promise((resolve) => {
        say.speak(text, voice, speed, () => {
            // macOS audio buffer delay
            setTimeout(resolve, 700);
        });
    });

    // 4 — Extra buffer to clear ANY remaining audio
    await new Promise(r => setTimeout(r, 2000));

    // 5 — UNMUTE
    try {
        await fetch("http://127.0.0.1:5000/unmute", { method: "POST" });
    } catch (err) {
        console.log("⚠️ Unmute failed:", err.message);
    }

    // 6 — Small delay after unmute before listening
    await new Promise(r => setTimeout(r, 200));
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
let isProcessing = false;

async function handleCommand(cmdRaw) {
    const command = cmdRaw.toLowerCase().trim();
    
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

        // FOCUS MODE
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

        // WEBSITES
        if (command === "open youtube" || command === "youtube") {
            return openwebsite("https://youtube.com", "YouTube");
        }
        if (command === "open google" || command === "google") {
            return openwebsite("https://google.com", "Google");
        }
        if (command === "open instagram" || command === "instagram") {
            return openwebsite("https://instagram.com", "Instagram");
        }

        // APPS
        if (command === "open chrome" || command === "chrome") {
            return openapp("Google Chrome");
        }
        if (command === "open whatsapp" || command === "whatsapp") {
            return openapp("WhatsApp");
        }
        if (command === "open safari" || command === "safari") {
            return openapp("Safari");
        }

        // FILES
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

        // UTILITIES
        if (command === "what time is it" || command === "time") {
            return speak(`The time is ${new Date().toLocaleTimeString()}`);
        }
        if (command === "what date is it" || command === "date") {
            return speak(`Today is ${new Date().toLocaleDateString()}`);
        }

        // POLITE
        if (command.includes("thank you") || command === "thanks") {
            return speak("You're welcome!");
        }
        if (command.includes("goodbye") || command === "bye") {
            return speak("Goodbye! Have a great day!");
        }

        // UNKNOWN COMMAND
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
    console.log("\nTry saying:");
    console.log("  - 'Jarvis'");
    console.log("  - 'Start focus mode'");
    console.log("  - 'Open YouTube'");
    console.log("  - 'What time is it'\n");
} catch {
    console.error("❌ Cannot connect to Python listener!");
    console.error("   Make sure to run: python3 listener.py");
    process.exit(1);
}

// Start polling at optimal rate
setInterval(pollVoice, 500);  // Poll every 500ms for responsiveness