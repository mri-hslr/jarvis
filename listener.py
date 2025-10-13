"""
Jarvis Voice Listener - Optimized for Fast, Reliable Recognition
Hardcoded commands for best performance
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
print("🎙️  Initializing Voice Recognition...")
print("="*70)

# Initialize recognizer
try:
    recognizer = sr.Recognizer()
    
    # OPTIMIZED SETTINGS for faster, more accurate recognition
    recognizer.energy_threshold = 400  # Slightly higher to reduce false positives
    recognizer.dynamic_energy_threshold = True
    recognizer.dynamic_energy_adjustment_damping = 0.15
    recognizer.dynamic_energy_ratio = 1.5
    recognizer.pause_threshold = 0.5  # Reduced for faster response (was 0.8)
    recognizer.phrase_threshold = 0.3
    recognizer.non_speaking_duration = 0.4  # Faster cutoff (was 0.5)
    
    print("✅ Speech Recognition loaded")
    print("🎛️  Settings optimized for speed and accuracy")
    
except Exception as e:
    print(f"❌ Error initializing recognizer: {e}")
    print("\n🔧 Fix:")
    print("   pip install SpeechRecognition")
    sys.exit(1)

# List and select microphone
try:
    print("\n🎤 Available Microphones:")
    mic_list = sr.Microphone.list_microphone_names()
    for index, name in enumerate(mic_list):
        print(f"   [{index}] {name}")
    
    microphone = sr.Microphone()
    print(f"✅ Using default microphone")
    
except Exception as e:
    print(f"❌ Error initializing microphone: {e}")
    print("\n🔧 Make sure microphone is connected and accessible")
    sys.exit(1)

# Quick calibration
print("\n🔧 Quick calibration (1 second)...")
try:
    with microphone as source:
        recognizer.adjust_for_ambient_noise(source, duration=1)
    print("✅ Calibration complete!")
except Exception as e:
    print(f"❌ Microphone error: {e}")
    sys.exit(1)

print("="*70)

def listen_continuously():
    """
    Optimized listener for fast recognition with hardcoded commands
    """
    print("\n🎧 Voice listener started!")
    print("💡 Speak CLEARLY and use EXACT commands\n")
    
    consecutive_errors = 0
    max_errors = 5
    last_command = ""
    last_time = 0
    iteration_count = 0
    
    while True:
        try:
            with microphone as source:
                # Quick noise adjustment every 15 iterations
                iteration_count += 1
                if iteration_count % 15 == 0:
                    recognizer.adjust_for_ambient_noise(source, duration=0.3)
                
                print("👂 Listening...                    ", end='\r')
                
                # SHORTER timeouts for faster response
                audio = recognizer.listen(
                    source, 
                    timeout=4,           # Reduced from 5
                    phrase_time_limit=5  # Reduced from 10 for faster commands
                )
                
                print("⚙️  Processing...                   ", end='\r')
                
                # Use Google's Speech Recognition
                text = recognizer.recognize_google(audio).lower().strip()
                
                current_time = time.time()
                
                # Prevent duplicates (same command within 2 seconds)
                if text and (text != last_command or current_time - last_time > 2):
                    command_state["current"] = text
                    command_state["timestamp"] = current_time
                    command_state["is_new"] = True
                    last_command = text
                    last_time = current_time
                    
                    # Clear line and show recognized text
                    print(" " * 50, end='\r')
                    print(f"\n✅ HEARD: '{text}'")
                    print(f"   🕐 {time.strftime('%H:%M:%S')}\n")
                    
                    consecutive_errors = 0
                    
        except sr.WaitTimeoutError:
            # No speech - normal
            consecutive_errors = 0
            continue
            
        except sr.UnknownValueError:
            # Speech unclear - don't spam messages
            consecutive_errors = 0
            pass
            
        except sr.RequestError as e:
            consecutive_errors += 1
            print(f"\n⚠️  Network error: {e}")
            
            if consecutive_errors >= max_errors:
                print("\n❌ Too many network errors!")
                break
            
            print("   Retrying in 2 seconds...")
            time.sleep(2)
            
        except Exception as e:
            consecutive_errors += 1
            print(f"\n❌ Error: {e}")
            
            if consecutive_errors >= max_errors:
                print("\n❌ Too many errors. Stopping.")
                break
                
            time.sleep(1)

# Start listening thread
listener_thread = threading.Thread(target=listen_continuously, daemon=True)
listener_thread.start()

@app.route("/listen_and_consume", methods=["GET"])
def get_and_consume_command():
    """
    Atomically get and consume command
    """
    text = ""
    
    if command_state["is_new"]:
        text = command_state["current"]
        command_state["is_new"] = False
        command_state["current"] = ""
        print(f"📤 Sent: '{text}' ✓\n")
    
    return jsonify({
        "text": text,
        "success": True,
        "timestamp": time.time()
    })

@app.route("/listen", methods=["GET"])
def get_command():
    """Legacy endpoint"""
    text = ""
    
    if command_state["is_new"]:
        text = command_state["current"]
        command_state["is_new"] = False
        print(f"📤 Sent: '{text}'\n")
    
    return jsonify({
        "text": text,
        "success": True
    })

@app.route("/status", methods=["GET"])
def status():
    """Health check"""
    return jsonify({
        "status": "running",
        "current_command": command_state["current"],
        "is_new": command_state["is_new"],
        "timestamp": time.strftime('%H:%M:%S'),
        "energy_threshold": recognizer.energy_threshold
    })

@app.route("/clear", methods=["POST"])
def clear_command():
    """Clear command"""
    command_state["current"] = ""
    command_state["is_new"] = False
    return jsonify({"status": "cleared"})

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🤖 JARVIS VOICE LISTENER - OPTIMIZED")
    print("="*70)
    print("Server:    http://127.0.0.1:5000")
    print("\n💡 OPTIMIZATIONS:")
    print("   ✓ Faster response times")
    print("   ✓ Reduced timeout periods")
    print("   ✓ Better duplicate prevention")
    print("   ✓ Exact command matching")
    print("\n⚡ FOR BEST RESULTS:")
    print("   • Speak commands EXACTLY as listed")
    print("   • Speak clearly at normal pace")
    print("   • Wait for 'Listening...' indicator")
    print("   • Reduce background noise")
    print("="*70 + "\n")
    
    try:
        app.run(
            host='127.0.0.1', 
            port=5000, 
            debug=False,
            threaded=True,
            use_reloader=False
        )
    except KeyboardInterrupt:
        print("\n\n👋 Stopped gracefully")
        sys.exit(0)