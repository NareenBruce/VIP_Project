from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import cv2
from ultralytics import YOLO
import math
import time
import os
import json
from datetime import datetime

# --- CONFIGURATION ---
MODEL_PATH = "best.pt"
SAMPLE_VIDEO_PATH = "sample_video.mp4"
IMAGE_FOLDER = "detected_images"
DB_FILE = "alerts.json"

# --- GLOBAL STATE ---
current_source = SAMPLE_VIDEO_PATH 
processing_enabled = False # Default to OFF (Let user start it)

# Ensure folders exist
if not os.path.exists(IMAGE_FOLDER):
    os.makedirs(IMAGE_FOLDER)

# Ensure DB file exists
if not os.path.exists(DB_FILE):
    with open(DB_FILE, 'w') as f:
        json.dump([], f)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/images", StaticFiles(directory=IMAGE_FOLDER), name="images")

print("Loading YOLO model...")
model = YOLO(MODEL_PATH)
classNames = ['Pothole', 'Crack', 'Open Manhole']

# Shared state for the frontend stats
system_state = {
    "fps": 0,
    "hazard_count": 0,
    "active": False
}

# --- DATA MODELS ---
class SystemControl(BaseModel):
    command: str 

class SourceSelection(BaseModel):
    source_type: str 

class DeleteRequest(BaseModel):
    id: int

# --- HELPER FUNCTIONS ---
def load_history():
    """Reads the JSON database and returns list of alerts"""
    try:
        with open(DB_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_alert(alert):
    """Appends a new alert to the JSON database"""
    history = load_history()
    # Add new alert to the beginning
    history.insert(0, alert)
    with open(DB_FILE, 'w') as f:
        json.dump(history, f, indent=4)

def delete_alert_by_id(alert_id):
    """Removes an alert from the JSON database"""
    history = load_history()
    # Filter out the alert with the matching ID
    new_history = [a for a in history if a.get("id") != alert_id]
    with open(DB_FILE, 'w') as f:
        json.dump(new_history, f, indent=4)
    return new_history

# --- API ENDPOINTS ---

@app.post("/control")
def control_system(data: SystemControl):
    global processing_enabled
    if data.command == "start":
        processing_enabled = True
        system_state["active"] = True
    elif data.command == "stop":
        processing_enabled = False
        system_state["active"] = False
        system_state["fps"] = 0
    return {"message": f"System {data.command}ed"}

@app.post("/set_source")
def set_source(selection: SourceSelection):
    global current_source
    if selection.source_type == "webcam":
        current_source = 0 
    else:
        current_source = SAMPLE_VIDEO_PATH
    return {"message": "Source updated", "current": str(current_source)}

@app.get("/history")
def get_history():
    """Returns the persistent history log"""
    return load_history()

@app.delete("/history/{alert_id}")
def delete_history_item(alert_id: int):
    """Deletes an item from history"""
    delete_alert_by_id(alert_id)
    return {"message": "Deleted"}

@app.get("/stats")
def get_stats():
    # Return live stats + current count from DB
    history = load_history()
    system_state["hazard_count"] = len(history)
    return system_state

# --- VIDEO GENERATOR ---
def generate_frames():
    cap = cv2.VideoCapture(current_source)
    
    # TIMING VARIABLES FOR 30 FPS LOCK
    target_fps = 30.0
    frame_duration = 1.0 / target_fps
    
    prev_time = 0
    last_save_time = 0
    save_cooldown = 3.0
    
    # OPTIMIZATION
    frame_count = 0
    skip_frames = 2 # Run AI every 3rd frame
    last_results = [] 

    while True:
        start_time = time.time() # Start timer for this frame

        success, frame = cap.read()
        if not success:
            if isinstance(current_source, str):
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            else:
                break
        
        # --- PAUSE LOGIC ---
        if not processing_enabled:
            # Send raw frame efficiently
            time.sleep(0.03) # Mild sleep to prevent CPU burn
            ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            continue

        # --- AI PROCESSING ---
        frame_count += 1
        current_time = time.time()
        
        # Run YOLO only every (skip_frames + 1) frames to save CPU for FPS
        if frame_count % (skip_frames + 1) == 0:
            results = model(frame, stream=True, conf=0.4)
            last_results = [] 
            
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = math.ceil((box.conf[0] * 100)) / 100
                    cls = int(box.cls[0])
                    cls_name = classNames[cls]
                    
                    color = (0, 255, 255)
                    if cls_name == 'Open Manhole': color = (0, 0, 255)
                    elif cls_name == 'Pothole': color = (0, 165, 255)
                    
                    last_results.append((x1, y1, x2, y2, cls_name, conf, color))
                    
                    # SAVE LOGIC (PERSISTENT)
                    if conf > 0.5 and (current_time - last_save_time) > save_cooldown:
                        # Create unique ID based on timestamp
                        alert_id = int(datetime.now().timestamp() * 1000)
                        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
                        filename = f"{cls_name}_{timestamp_str}.jpg"
                        filepath = os.path.join(IMAGE_FOLDER, filename)
                        
                        # Save Image
                        cv2.imwrite(filepath, frame)
                        
                        # Save to JSON DB
                        new_alert = {
                            "id": alert_id,
                            "type": cls_name,
                            "conf": conf,
                            "time": datetime.now().strftime("%I:%M:%S %p"),
                            "date": datetime.now().strftime("%Y-%m-%d"),
                            "image_url": f"http://127.0.0.1:8000/images/{filename}"
                        }
                        save_alert(new_alert)
                        last_save_time = current_time

        # --- DRAWING ---
        for (x1, y1, x2, y2, cls_name, conf, color) in last_results:
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)
            cv2.putText(frame, f'{cls_name} {conf}', (x1, y1 - 10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        # --- FPS LOCK LOGIC ---
        # Calculate how long processing took
        process_time = time.time() - start_time
        # Sleep exactly the amount needed to hit 30 FPS
        wait_time = frame_duration - process_time
        if wait_time > 0:
            time.sleep(wait_time)
            
        # Actual FPS calculation for display
        system_state["fps"] = round(1.0 / (time.time() - start_time), 1)

        # Encode
        ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

@app.get("/video_feed")
def video_feed():
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")