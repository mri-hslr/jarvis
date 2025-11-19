# =====================================================
# PYTHON LISTENER (FIXED TIMING + PROPER THRESHOLDS)
# =====================================================

from flask import Flask, jsonify
import speech_recognition as sr
import threading, time

app = Flask(__name__)

state = {
    "current": "",
    "is_new": False,
    "muted": False
}

print("\nInitializing recognizer...")

recognizer = sr.Recognizer()

# ---- CORRECTED THRESHOLD VALUES ----
recognizer.energy_threshold = 2000  # Lower = more sensitive
recognizer.dynamic_energy_threshold = True

# CRITICAL FIX: These must work together properly
recognizer.pause_threshold = 0.4          # Time of silence to consider phrase complete
recognizer.non_speaking_duration = 0.2    # Min silence to detect between words

# Fine-tuning for responsiveness
recognizer.dynamic_energy_adjustment_damping = 0.15
recognizer.dynamic_energy_ratio = 1.5

mic = sr.Microphone()

# Calibration
with mic as source:
    print("Calibrating for ambient noise (1 second)...")
    recognizer.adjust_for_ambient_noise(source, duration=1)
print("Calibration completed.")


def listen_loop():
    """Background thread that continuously listens for speech"""
    consecutive_errors = 0
    max_errors = 5
    
    while True:
        try:
            if state["muted"]:
                time.sleep(0.05)  # Check mute status frequently
                consecutive_errors = 0
                continue

            with mic as source:
                # Listen with reasonable timeouts
                audio = recognizer.listen(
                    source,
                    timeout=5,           # Wait up to 5s for speech to start
                    phrase_time_limit=5  # Max 5s per phrase
                )

            # Recognize speech
            text = recognizer.recognize_google(audio).lower().strip()

            if text:
                state["current"] = text
                state["is_new"] = True
                print(f"\nHEARD: {text}\n", flush=True)
                consecutive_errors = 0

        except sr.WaitTimeoutError:
            # Normal timeout - no speech detected
            consecutive_errors = 0
            continue
            
        except sr.UnknownValueError:
            # Speech detected but couldn't understand
            consecutive_errors = 0
            continue
            
        except Exception as e:
            consecutive_errors += 1
            if consecutive_errors >= max_errors:
                print(f"Too many errors ({consecutive_errors}), restarting mic...")
                time.sleep(2)
                consecutive_errors = 0
            continue


# Start listening thread
threading.Thread(target=listen_loop, daemon=True).start()


@app.route("/listen_and_consume")
def consume():
    """Return and clear any new speech text"""
    if state["is_new"]:
        t = state["current"]
        state["is_new"] = False
        state["current"] = ""
        return jsonify({"text": t})
    return jsonify({"text": ""})


@app.route("/mute", methods=["POST"])
def mute():
    """Stop listening (during speech output)"""
    state["muted"] = True
    return jsonify({"status": "muted"})


@app.route("/unmute", methods=["POST"])
def unmute():
    """Resume listening"""
    state["muted"] = False
    return jsonify({"status": "unmuted"})


@app.route("/status")
def status():
    """Check listener status"""
    return jsonify({
        "muted": state["muted"],
        "has_text": state["is_new"]
    })


if __name__ == "__main__":
    print("Listener running on 127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)