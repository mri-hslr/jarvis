//voice assistant
//promise version for speak function
import say from 'say';
import fetch from 'node-fetch';

function speak(text, voice = null, speed = 1.0) {
    return new Promise((resolve, reject) => {
        say.speak(text, voice, speed, err => {
            if (err) {
                return reject(err);
            }
            resolve();
        })
    })
}

//for crud operations on file
import fs from 'fs'

async function createfile(file, content) {
    fs.writeFileSync(file, content);
    console.log("file has been created");
    await speak(`"${file}" has been created `);
}

async function readfile(file) {
    if (!fs.existsSync(file)) {
        console.log(`File "${file}" does not exist.`);
        await speak(`file "${file}" does not exist`)
        return;
    }
    const data = fs.readFileSync(file, 'utf-8');
    console.log("content is ", data);
    await speak(`reading file "${file}".it says "${data}"`);
}

async function deletefile(file) {
    if (!fs.existsSync(file)) {
        console.log(`File "${file}" does not exist.`);
        await speak(`"${file}" does not exist`);
        return;
    }
    fs.unlinkSync(file)
    console.log("file is deleted");
    await speak(`"${file}" has been deleted`);
}

// for opening websites
import open from 'open'

async function openwebsite(url) {
    await speak(`opening "${url}"`);
    await open(url);
    console.log("website opened");
}

//for opening files with default app
import { exec } from 'child_process'
import os from 'os'

async function openfile(path) {
    if (!fs.existsSync(path)) {
        console.log("file does not exist");
        await speak("file does not exist");
    }
    else {
        await speak(`opening file"${path}"`);
        if (os.platform() === 'darwin') {
            exec(`open "${path}"`)// for macos
        }
        else if (os.platform() === 'win32') {
            exec(`start "" "${path}"`)// for windows
        }
        else {
            exec(`xdg-open "${path}" `)// for linux
        }
    }
}

// to open any app
async function openapp(appname) {
    await speak(`opening "${appname}"`);
    if (os.platform() === 'darwin') {
        exec(`open -a "${appname}"`, (error) => {
            if (error) {
                console.log("failed opening an app");
            }
            else {
                console.log("opened  app successfully");
            }
        })
    }
}

// Demo function (keep your original)
async function jarvisDemo() {
    await openfile('notes.txt');
    await createfile('notes.txt', 'jarvis wake up, daddy bought some gifts for you')
    await readfile('notes.txt')
    await openapp('Chess')
    await openwebsite('https://www.youtube.com/');
}

// ============================================================================
// NEW: VOICE INPUT FUNCTIONALITY
// ============================================================================

// Track executed commands to prevent duplicates
const executedCommands = new Set();
let isExecuting = false;

// Command handler - processes voice commands
async function handleVoiceCommand(command) {
    const normalized = command.toLowerCase().trim();
    
    // Prevent duplicate execution
    if (executedCommands.has(normalized)) {
        console.log(`⊘ Duplicate command ignored: "${normalized}"`);
        return;
    }
    
    // Mark as executed
    executedCommands.add(normalized);
    setTimeout(() => executedCommands.delete(normalized), 5000); // Remove after 5s
    
    console.log("\n" + "=".repeat(60));
    console.log(`🎯 EXECUTING: "${command}"`);
    console.log("=".repeat(60));
    
    try {
        // Match commands based on keywords in the voice input
        
        // YouTube
        if (normalized.includes("youtube") || 
            normalized.includes("you tube") ||
            (normalized.includes("open") && normalized.includes("you"))) {
            console.log("→ Opening YouTube");
            await openwebsite("https://www.youtube.com/");
        }
        
        // Google
        else if (normalized.includes("google")) {
            console.log("→ Opening Google");
            await openwebsite("https://www.google.com/");
        }
        
        // Create file
        else if (normalized.includes("create") && normalized.includes("file")) {
            console.log("→ Creating file");
            await createfile("notes.txt", "Jarvis activated by voice!");
        }
        
        // Read file
        else if (normalized.includes("read") && normalized.includes("file")) {
            console.log("→ Reading file");
            await readfile("notes.txt");
        }
        
        // Delete file
        else if (normalized.includes("delete") && normalized.includes("file")) {
            console.log("→ Deleting file");
            await deletefile("notes.txt");
        }
        
        // Open app
        else if (normalized.includes("open") && normalized.includes("app")) {
            console.log("→ Opening Chess app");
            await openapp("Chess");
        }
        
        // Open file
        else if (normalized.includes("open") && normalized.includes("notes")) {
            console.log("→ Opening notes.txt");
            await openfile("notes.txt");
        }
        
        // Wake word
        else if (normalized.includes("jarvis") || 
                 normalized.includes("hey jarvis") ||
                 normalized.includes("hi jarvis")) {
            console.log("→ Wake word detected");
            await speak("Yes, I am here! How can I help you?");
        }
        
        // Unknown command
        else {
            console.log(`❓ Unknown command: "${command}"`);
            console.log("Available: jarvis, open youtube, create/read/delete file, open app");
        }
        
    } catch (err) {
        console.error("❌ Error executing command:", err);
    }
    
    console.log("=".repeat(60) + "\n");
}

// Poll Flask API for voice commands
async function listenForVoiceInput() {
    if (isExecuting) return;
    
    try {
        const res = await fetch("http://127.0.0.1:5000/listen");
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        
        const data = await res.json();
        const command = data.text?.trim();
        
        if (command && command.length > 0) {
            console.log(`\n📥 Voice input received: "${command}"`);
            
            isExecuting = true;
            await handleVoiceCommand(command);
            isExecuting = false;
        }
        
    } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
            console.error("❌ Error fetching voice input:", err.message);
        }
    }
}

// Check if Flask server is running
async function checkVoiceAPI() {
    console.log("🔍 Checking voice API...");
    
    try {
        const res = await fetch("http://127.0.0.1:5000/status");
        const data = await res.json();
        console.log("✅ Voice API connected:", data);
        return true;
    } catch (err) {
        console.log("❌ Voice API not running!");
        return false;
    }
}

// Start voice-controlled Jarvis
async function startVoiceJarvis() {
    console.log("\n" + "=".repeat(60));
    console.log("🤖 JARVIS VOICE ASSISTANT");
    console.log("=".repeat(60));
    
    const isAPIRunning = await checkVoiceAPI();
    
    if (!isAPIRunning) {
        console.log("\n⚠️  Voice API not detected. Starting in demo mode...\n");
        console.log("To enable VOICE CONTROL:");
        console.log("1. Install: pip install SpeechRecognition pyaudio");
        console.log("2. Run: python voice_listener.py");
        console.log("3. Restart this script\n");
        console.log("Running demo instead...\n");
        await jarvisDemo();
        return;
    }
    
    console.log("\n✅ Voice control ENABLED");
    console.log("\n📋 Available Voice Commands:");
    console.log("   🎤 'Hey Jarvis' or 'Jarvis'     - Wake word");
    console.log("   🎥 'Open YouTube'               - Opens YouTube");
    console.log("   🌐 'Open Google'                - Opens Google");
    console.log("   📄 'Create file'                - Creates notes.txt");
    console.log("   📖 'Read file'                  - Reads notes.txt");
    console.log("   🗑️  'Delete file'               - Deletes notes.txt");
    console.log("   📱 'Open app'                   - Opens Chess");
    console.log("   📝 'Open notes'                 - Opens notes.txt");
    console.log("=".repeat(60));
    console.log("\n🎙️  Listening for your voice commands...\n");
    
    // Poll every 1 second for voice commands
    setInterval(listenForVoiceInput, 1000);
}

// ============================================================================
// CHOOSE YOUR MODE
// ============================================================================

// Option 1: Run demo (your original function)
// jarvisDemo();

// Option 2: Start voice-controlled Jarvis (NEW!)
startVoiceJarvis();