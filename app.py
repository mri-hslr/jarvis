from flask import Flask, jsonify
import speech_recognition as sr
import threading
import time

app = Flask(__name__)

# State management
command_state = {
    "current": "",
    "timestamp": 0,
    "is_new": False
}

# Initialize recognizer
recognizer = sr.Recognizer()
microphone = sr.Microphone()

# Adjust for ambient noise once at startup
print("🎤 Calibrating microphone for ambient noise...")
with microphone as source:
    recognizer.adjust_for_ambient_noise(source, duration=2)
print("✅ Calibration complete!\n")

def listen_for_commands():
    """Background thread that continuously listens for voice commands"""
    print("🎙️  Listening for commands... Speak clearly!\n")
    
    while True:
        try:
            with microphone as source:
                print("🔴 Listening...", end='\r')
                
                # Listen for audio with timeout
                audio = recognizer.listen(source, timeout=5, phrase_time_limit=5)
                
                print("🔄 Processing speech...       ", end='\r')
                
                # Use Google's speech recognition (online - very accurate)
                try:
                    text = recognizer.recognize_google(audio).lower()
                    
                    if text:
                        # Update command state
                        command_state["current"] = text
                        command_state["timestamp"] = time.time()
                        command_state["is_new"] = True
                        
                        print(f"\n✅ RECOGNIZED: '{text}'")
                        print(f"   Time: {time.strftime('%H:%M:%S')}\n")
                        
                except sr.UnknownValueError:
                    # Speech was unintelligible
                    print("❓ Could not understand audio", end='\r')
                except sr.RequestError as e:
                    print(f"\n❌ API Error: {e}")
                    
        except sr.WaitTimeoutError:
            # No speech detected in timeout period - this is normal
            pass
        except Exception as e:
            print(f"\n❌ Error: {e}")
            time.sleep(1)

# Start listening thread
listener_thread = threading.Thread(target=listen_for_commands, daemon=True)
listener_thread.start()

@app.route("/listen", methods=["GET"])
def get_command():
    """Endpoint for Node.js to get the latest command"""
    text = ""
    
    # Check if there's a new command
    if command_state["is_new"]:
        text = command_state["current"]
        command_state["is_new"] = False  # Mark as read
        print(f"📤 Sent to Node.js: '{text}'\n")
    
    return jsonify({"text": text})

@app.route("/status", methods=["GET"])
def status():
    """Health check endpoint"""
    return jsonify({
        "status": "running",
        "current_command": command_state["current"],
        "is_new": command_state["is_new"],
        "time": time.strftime('%H:%M:%S')
    })

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🎙️  VOICE RECOGNITION API - RUNNING")
    print("="*60)
    print("Server: http://127.0.0.1:5000")
    print("\nUsing: Google Speech Recognition (online)")
    print("\n💡 TIPS:")
    print("   • Speak clearly at normal pace")
    print("   • Wait for 'Listening...' before speaking")
    print("   • Reduce background noise")
    print("="*60 + "\n")
    
    app.run(host='127.0.0.1', port=5000, debug=False, threaded=True, use_reloader=False)