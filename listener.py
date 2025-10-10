"""
Jarvis Voice Listener - Using Google Speech Recognition
Simple and accurate voice-to-text API for Jarvis
"""

from flask import Flask, jsonify
import speech_recognition as sr
import threading
import time
import sys

app = Flask(__name__)

# Global state for commands
command_state = {
    "current": "",
    "timestamp": 0,
    "is_new": False
}

print("="*70)
print("🔧 Initializing Voice Recognition...")
print("="*70)

# Initialize recognizer and microphone
try:
    recognizer = sr.Recognizer()
    microphone = sr.Microphone()
    print("✅ Speech Recognition loaded")
    print("✅ Microphone initialized")
except Exception as e:
    print(f"❌ Error initializing: {e}")
    print("\n💡 Fix:")
    print("   pip uninstall SpeechRecognition")
    print("   pip install SpeechRecognition")
    sys.exit(1)

# Calibrate for ambient noise
print("\n🎤 Calibrating microphone...")
print("   Please wait 2 seconds (stay quiet)...")
try:
    with microphone as source:
        recognizer.adjust_for_ambient_noise(source, duration=2)
    print("✅ Calibration complete!")
except Exception as e:
    print(f"❌ Microphone error: {e}")
    print("\n💡 Make sure microphone is connected and accessible")
    sys.exit(1)

print("="*70)

def listen_continuously():
    """
    Background thread that listens for voice commands
    Uses Google's Speech Recognition API (requires internet)
    """
    print("\n🎙️  Voice listener started!")
    print("🔴 Speak clearly when you see 'Listening...'\n")
    
    consecutive_errors = 0
    max_errors = 5
    
    while True:
        try:
            with microphone as source:
                # Show listening indicator
                print("🔴 Listening...                    ", end='\r')
                
                # Listen for audio (5 second timeout, max 5 second phrase)
                audio = recognizer.listen(source, timeout=5, phrase_time_limit=5)
                
                # Show processing indicator
                print("⚙️  Processing...                  ", end='\r')
                
                # Use Google's Speech Recognition
                text = recognizer.recognize_google(audio).lower().strip()
                
                if text:
                    # Update global state
                    command_state["current"] = text
                    command_state["timestamp"] = time.time()
                    command_state["is_new"] = True
                    
                    # Clear line and show recognized text
                    print(" " * 50, end='\r')
                    print(f"\n✅ HEARD: '{text}'")
                    print(f"   Time: {time.strftime('%H:%M:%S')}\n")
                    
                    # Reset error counter on success
                    consecutive_errors = 0
                    
        except sr.WaitTimeoutError:
            # No speech detected - this is normal, continue listening
            consecutive_errors = 0
            pass
            
        except sr.UnknownValueError:
            # Speech was unintelligible
            print("❓ Couldn't understand (speak clearly)  ", end='\r')
            consecutive_errors = 0
            
        except sr.RequestError as e:
            # API error (usually network issue)
            consecutive_errors += 1
            print(f"\n⚠️  Network error: {e}")
            
            if consecutive_errors >= max_errors:
                print("\n❌ Too many network errors. Check internet connection!")
                break
            
            time.sleep(2)
            
        except Exception as e:
            # Other errors
            consecutive_errors += 1
            print(f"\n❌ Error: {e}")
            
            if consecutive_errors >= max_errors:
                print("\n❌ Too many errors. Stopping listener.")
                break
                
            time.sleep(1)

# Start listening in background thread
listener_thread = threading.Thread(target=listen_continuously, daemon=True)
listener_thread.start()

@app.route("/listen", methods=["GET"])
def get_command():
    """
    API endpoint for Node.js to get the latest voice command
    Returns command only once (is_new flag prevents duplicates)
    """
    text = ""
    
    if command_state["is_new"]:
        text = command_state["current"]
        command_state["is_new"] = False  # Mark as consumed
        print(f"📤 Sent to Node.js: '{text}'\n")
    
    return jsonify({
        "text": text,
        "success": True
    })

@app.route("/status", methods=["GET"])
def status():
    """Health check endpoint"""
    return jsonify({
        "status": "running",
        "current_command": command_state["current"],
        "command_age_seconds": round(time.time() - command_state["timestamp"], 1),
        "is_new": command_state["is_new"],
        "timestamp": time.strftime('%H:%M:%S')
    })

@app.route("/clear", methods=["POST"])
def clear_command():
    """Manually clear the current command"""
    command_state["current"] = ""
    command_state["is_new"] = False
    return jsonify({"status": "cleared"})

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🎙️  JARVIS VOICE LISTENER - READY")
    print("="*70)
    print("Server:    http://127.0.0.1:5000")
    print("Endpoints: /listen  /status  /clear")
    print("\nRecognition: Google Speech API (requires internet)")
    print("\n💡 TIPS:")
    print("   • Speak at normal pace, clearly")
    print("   • Wait for 'Listening...' indicator")
    print("   • Reduce background noise for best results")
    print("   • Keep microphone close (1-2 feet away)")
    print("="*70 + "\n")
    
    try:
        # Run Flask server
        app.run(
            host='127.0.0.1', 
            port=5000, 
            debug=False,           # No debug mode (prevents threading issues)
            threaded=True,         # Allow multiple requests
            use_reloader=False     # Don't restart on code changes
        )
    except KeyboardInterrupt:
        print("\n\n✅ Voice listener stopped gracefully")
        sys.exit(0)