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

// Dynamic file creation with content
async function createfile(file, content) {
    fs.writeFileSync(file, content);
    console.log(`✅ File "${file}" has been created`);
    await speak(`${file} has been created`);
}

// Dynamic file reading
async function readfile(file) {
    if (!fs.existsSync(file)) {
        console.log(`❌ File "${file}" does not exist.`);
        await speak(`file ${file} does not exist`)
        return;
    }
    const data = fs.readFileSync(file, 'utf-8');
    console.log(`📄 Content of ${file}:`, data);
    await speak(`reading file ${file}. it says ${data}`);
}

// Dynamic file deletion
async function deletefile(file) {
    if (!fs.existsSync(file)) {
        console.log(`❌ File "${file}" does not exist.`);
        await speak(`${file} does not exist`);
        return;
    }
    fs.unlinkSync(file)
    console.log(`🗑️  File "${file}" is deleted`);
    await speak(`${file} has been deleted`);
}

// for opening websites
import open from 'open'

// Smart website opening with clean speech
async function openwebsite(url, siteName) {
    await speak(`opening ${siteName}`);
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    await open(fullUrl);
    console.log(`🌐 Website opened: ${fullUrl}`);
}

//for opening files with default app
import { exec } from 'child_process'
import os from 'os'

async function openfile(path) {
    if (!fs.existsSync(path)) {
        console.log("❌ File does not exist");
        await speak("file does not exist");
    }
    else {
        await speak(`opening file ${path}`);
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

// Dynamic app opening
async function openapp(appname) {
    await speak(`opening ${appname}`);
    if (os.platform() === 'darwin') {
        exec(`open -a "${appname}"`, (error) => {
            if (error) {
                console.log(`❌ Failed opening ${appname}`);
                speak(`Could not open ${appname}`);
            }
            else {
                console.log(`✅ Opened ${appname} successfully`);
            }
        })
    }
    else if (os.platform() === 'win32') {
        exec(`start ${appname}`, (error) => {
            if (error) {
                console.log(`❌ Failed opening ${appname}`);
                speak(`Could not open ${appname}`);
            }
            else {
                console.log(`✅ Opened ${appname} successfully`);
            }
        })
    }
    else {
        // Linux
        exec(`${appname}`, (error) => {
            if (error) {
                console.log(`❌ Failed opening ${appname}`);
                speak(`Could not open ${appname}`);
            }
            else {
                console.log(`✅ Opened ${appname} successfully`);
            }
        })
    }
}

// Track executed commands to prevent duplicates
const executedCommands = new Set();
let isExecuting = false;

// HARDCODED COMMAND HANDLER - Fast and Reliable
async function handleVoiceCommand(command) {
    const normalized = command.toLowerCase().trim();
    
    // Create unique ID for this specific command instance
    const commandId = `${normalized}-${Date.now()}`;
    
    // Prevent duplicate execution
    if (executedCommands.has(commandId)) {
        console.log(`⊘ Duplicate command ignored: "${normalized}"`);
        return;
    }
    
    // Mark as executed
    executedCommands.add(commandId);
    setTimeout(() => executedCommands.delete(commandId), 3000);
    
    console.log("\n" + "=".repeat(60));
    console.log(`🎯 EXECUTING: "${command}"`);
    console.log("=".repeat(60));
    
    try {
        // ============ HARDCODED COMMANDS - EXACT MATCH ============
        
        // WAKE WORD
        if (normalized === "jarvis" || normalized === "hey jarvis" || normalized === "hi jarvis") {
            console.log("→ Wake word detected");
            await speak("Yes, I am here! How can I help you?");
        }
        
        // ========== WEBSITES ==========
        else if (normalized === "open youtube") {
            console.log("→ Opening YouTube");
            await openwebsite("https://www.youtube.com/", "YouTube");
        }
        
        else if (normalized === "open google") {
            console.log("→ Opening Google");
            await openwebsite("https://www.google.com/", "Google");
        }
        
        else if (normalized === "open facebook") {
            console.log("→ Opening Facebook");
            await openwebsite("https://www.facebook.com/", "Facebook");
        }
        
        else if (normalized === "open twitter") {
            console.log("→ Opening Twitter");
            await openwebsite("https://www.twitter.com/", "Twitter");
        }
        
        else if (normalized === "open instagram") {
            console.log("→ Opening Instagram");
            await openwebsite("https://www.instagram.com/", "Instagram");
        }
        
        else if (normalized === "open github") {
            console.log("→ Opening GitHub");
            await openwebsite("https://www.github.com/", "GitHub");
        }
        
        else if (normalized === "open reddit") {
            console.log("→ Opening Reddit");
            await openwebsite("https://www.reddit.com/", "Reddit");
        }
        
        else if (normalized === "open linkedin") {
            console.log("→ Opening LinkedIn");
            await openwebsite("https://www.linkedin.com/", "LinkedIn");
        }
        
        // ========== APPS ==========
        else if (normalized === "open chess") {
            console.log("→ Opening Chess");
            await openapp("Chess");
        }
        
        else if (normalized === "open whatsapp") {
            console.log("→ Opening WhatsApp");
            await openapp("WhatsApp");
        }
        
        else if (normalized === "open photo booth") {
            console.log("→ Opening Photo Booth");
            await openapp("Photo Booth");
        }
        
        else if (normalized === "open safari") {
            console.log("→ Opening Safari");
            await openapp("Safari");
        }
        
        else if (normalized === "open chrome") {
            console.log("→ Opening Chrome");
            await openapp("Google Chrome");
        }
        
        else if (normalized === "open calculator") {
            console.log("→ Opening Calculator");
            await openapp("Calculator");
        }
        
        else if (normalized === "open calendar") {
            console.log("→ Opening Calendar");
            await openapp("Calendar");
        }
        
        else if (normalized === "open mail") {
            console.log("→ Opening Mail");
            await openapp("Mail");
        }
        
        else if (normalized === "open music") {
            console.log("→ Opening Music");
            await openapp("Music");
        }
        
        else if (normalized === "open notes") {
            console.log("→ Opening Notes app");
            await openapp("Notes");
        }
        
        // ========== FILE OPERATIONS ==========
        
        // CREATE FILES
        else if (normalized === "create demo file") {
            console.log("→ Creating demo.txt");
            await createfile("demo.txt", "This is a demo file created by Jarvis");
        }
        
        else if (normalized === "create test file") {
            console.log("→ Creating test.txt");
            await createfile("test.txt", "Hello, this is a test file");
        }
        
        else if (normalized === "create yash file") {
            console.log("→ Creating yash.txt");
            await createfile("yash.txt", "Hello, I am Yash and this is my file");
        }
        
        else if (normalized === "create notes file") {
            console.log("→ Creating notes.txt");
            await createfile("notes.txt", "Jarvis notes: All systems operational");
        }
        
        else if (normalized === "create todo file") {
            console.log("→ Creating todo.txt");
            await createfile("todo.txt", "Todo: Complete Jarvis voice assistant project");
        }
        
        // READ FILES
        else if (normalized === "read demo file") {
            console.log("→ Reading demo.txt");
            await readfile("demo.txt");
        }
        
        else if (normalized === "read test file") {
            console.log("→ Reading test.txt");
            await readfile("test.txt");
        }
        
        else if (normalized === "read yash file") {
            console.log("→ Reading yash.txt");
            await readfile("yash.txt");
        }
        
        else if (normalized === "read notes file") {
            console.log("→ Reading notes.txt");
            await readfile("notes.txt");
        }
        
        else if (normalized === "read todo file") {
            console.log("→ Reading todo.txt");
            await readfile("todo.txt");
        }
        
        // DELETE FILES
        else if (normalized === "delete demo file") {
            console.log("→ Deleting demo.txt");
            await deletefile("demo.txt");
        }
        
        else if (normalized === "delete test file") {
            console.log("→ Deleting test.txt");
            await deletefile("test.txt");
        }
        
        else if (normalized === "delete yash file") {
            console.log("→ Deleting yash.txt");
            await deletefile("yash.txt");
        }
        
        else if (normalized === "delete notes file") {
            console.log("→ Deleting notes.txt");
            await deletefile("notes.txt");
        }
        
        else if (normalized === "delete todo file") {
            console.log("→ Deleting todo.txt");
            await deletefile("todo.txt");
        }
        
        // OPEN FILES
        else if (normalized === "open demo file") {
            console.log("→ Opening demo.txt");
            await openfile("demo.txt");
        }
        
        else if (normalized === "open test file") {
            console.log("→ Opening test.txt");
            await openfile("test.txt");
        }
        
        // ========== UTILITY COMMANDS ==========
        else if (normalized === "what time is it" || normalized === "tell me the time") {
            const time = new Date().toLocaleTimeString();
            console.log(`→ Current time: ${time}`);
            await speak(`The time is ${time}`);
        }
        
        else if (normalized === "what date is it" || normalized === "tell me the date") {
            const date = new Date().toLocaleDateString();
            console.log(`→ Current date: ${date}`);
            await speak(`Today is ${date}`);
        }
        
        else if (normalized === "thank you jarvis" || normalized === "thanks jarvis") {
            console.log("→ You're welcome");
            await speak("You're welcome! Happy to help.");
        }
        
        else if (normalized === "goodbye jarvis" || normalized === "bye jarvis") {
            console.log("→ Goodbye");
            await speak("Goodbye! Have a great day.");
        }
        
        // UNKNOWN COMMAND
        else {
            console.log(`❓ Unknown command: "${command}"`);
            console.log("💡 Please use exact commands from the list");
            await speak("Sorry, I don't recognize that command. Please use exact phrases.");
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
        const res = await fetch("http://127.0.0.1:5000/listen_and_consume");
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        
        const data = await res.json();
        const command = data.text?.trim();
        
        if (command && command.length > 0) {
            console.log(`\n🎤 Voice input received: "${command}"`);
            
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
    console.log("\n" + "=".repeat(70));
    console.log("🤖 JARVIS VOICE ASSISTANT - HARDCODED COMMANDS");
    console.log("=".repeat(70));
    
    const isAPIRunning = await checkVoiceAPI();
    
    if (!isAPIRunning) {
        console.log("\n⚠️  Voice API not detected.");
        console.log("To enable VOICE CONTROL:");
        console.log("1. Install: pip install SpeechRecognition pyaudio flask");
        console.log("2. Run: python voice_listener.py");
        console.log("3. Restart this script\n");
        return;
    }
    
    console.log("\n✅ Voice control ENABLED");
    console.log("\n" + "=".repeat(70));
    console.log("📢 EXACT VOICE COMMANDS (say these exactly):");
    console.log("=".repeat(70));
    
    console.log("\n🎤 WAKE:");
    console.log("   • 'Jarvis' or 'Hey Jarvis'");
    
    console.log("\n🌐 WEBSITES:");
    console.log("   • 'open youtube'");
    console.log("   • 'open google'");
    console.log("   • 'open facebook'");
    console.log("   • 'open twitter'");
    console.log("   • 'open instagram'");
    console.log("   • 'open github'");
    console.log("   • 'open reddit'");
    console.log("   • 'open linkedin'");
    
    console.log("\n📱 APPS:");
    console.log("   • 'open chess'");
    console.log("   • 'open whatsapp'");
    console.log("   • 'open photo booth'");
    console.log("   • 'open safari'");
    console.log("   • 'open chrome'");
    console.log("   • 'open calculator'");
    console.log("   • 'open calendar'");
    console.log("   • 'open mail'");
    console.log("   • 'open music'");
    console.log("   • 'open notes'");
    
    console.log("\n📄 CREATE FILES:");
    console.log("   • 'create demo file'");
    console.log("   • 'create test file'");
    console.log("   • 'create yash file'");
    console.log("   • 'create notes file'");
    console.log("   • 'create todo file'");
    
    console.log("\n📖 READ FILES:");
    console.log("   • 'read demo file'");
    console.log("   • 'read test file'");
    console.log("   • 'read yash file'");
    console.log("   • 'read notes file'");
    console.log("   • 'read todo file'");
    
    console.log("\n🗑️  DELETE FILES:");
    console.log("   • 'delete demo file'");
    console.log("   • 'delete test file'");
    console.log("   • 'delete yash file'");
    console.log("   • 'delete notes file'");
    console.log("   • 'delete todo file'");
    
    console.log("\n📂 OPEN FILES:");
    console.log("   • 'open demo file'");
    console.log("   • 'open test file'");
    
    console.log("\n⏰ UTILITY:");
    console.log("   • 'what time is it'");
    console.log("   • 'what date is it'");
    console.log("   • 'thank you jarvis'");
    console.log("   • 'goodbye jarvis'");
    
    console.log("\n" + "=".repeat(70));
    console.log("💡 TIP: Say commands EXACTLY as shown above for best results");
    console.log("=".repeat(70));
    console.log("\n🎧 Listening for your voice commands...\n");
    
    // Poll every 1 second for voice commands
    setInterval(listenForVoiceInput, 1000);
}

// Start voice-controlled Jarvis
startVoiceJarvis();