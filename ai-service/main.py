from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import tensorflow as tf
import numpy as np
import io
import os

# =========================================
# KISSAN ADVISOR - AI SERVICE
# =========================================

app = FastAPI(title="Kissan Advisor AI Service")

# =========================================
# CORS - Allow React Frontend
# =========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        *[
            o.strip().rstrip("/")
            for o in os.getenv("CORS_ORIGINS", "").split(",")
            if o.strip()
        ],
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================
# Load Trained Wheat Disease Model
# =========================================

model = tf.keras.models.load_model("wheat_disease_model.keras")

# =========================================
# Disease Classes
# =========================================

class_names = [
    "BrownRust",
    "Healthy",
    "Mildew",
    "Septoria",
    "YellowRust"
]

# =========================================
# Home / Health Check
# =========================================

@app.get("/")
def home():
    return {
        "message": "Kissan Advisor AI Service is running",
        "status": "success"
    }

# =========================================
# AI Disease Prediction
# =========================================

@app.post("/predict")
async def predict(file: UploadFile = File(...)):

    # Read uploaded image
    image_bytes = await file.read()

    # Open image
    image = Image.open(
        io.BytesIO(image_bytes)
    ).convert("RGB")

    # Resize according to model input
    image = image.resize((224, 224))

    # Convert image to NumPy array
    image_array = np.array(image)

    # Normalize image
    image_array = image_array / 127.5 - 1

    # Add batch dimension
    image_array = np.expand_dims(
        image_array,
        axis=0
    )

    # Make prediction
    predictions = model.predict(
        image_array,
        verbose=0
    )

    # Get highest probability class
    predicted_index = np.argmax(
        predictions[0]
    )

    # Get confidence
    confidence = (
        float(predictions[0][predicted_index])
        * 100
    )

    # Get disease name
    predicted_class = class_names[
        predicted_index
    ]

    # Return result
    return {
        "crop": "Wheat",
        "disease": predicted_class,
        "confidence": round(confidence, 2),
        "status": "success"
    }
# =========================================
# START AI SERVER
# =========================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000
    )