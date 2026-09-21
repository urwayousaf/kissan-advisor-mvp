from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import jwt
import tensorflow as tf
import numpy as np
import io
import os

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

# =========================================
# KISSAN ADVISOR - AI SERVICE
# =========================================

app = FastAPI(title="Kissan Advisor AI Service")

# =========================================
# Configuration
# =========================================

# Must match the JWT_SECRET used by the Node API, so the tokens it issues
# to logged-in users are accepted here. No default on purpose.
JWT_SECRET = os.getenv("JWT_SECRET", "")

if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is not set. It must match the JWT_SECRET of the Node API."
    )

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

MODEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "wheat_disease_model.keras",
)

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

model = tf.keras.models.load_model(MODEL_PATH)

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
# Authentication
# =========================================

def require_user(authorization: str = Header(default="")):
    scheme, _, token = authorization.partition(" ")

    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=401,
            detail="Authentication required."
        )

    try:
        return jwt.decode(
            token.strip(),
            JWT_SECRET,
            algorithms=["HS256"]
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Session expired or invalid. Please login again."
        )

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

# Plain `def` (not async): model.predict blocks, so FastAPI runs this
# in a worker thread instead of freezing the event loop.
@app.post("/predict")
def predict(
    file: UploadFile = File(...),
    user: dict = Depends(require_user)
):

    # Read uploaded image (one byte over the limit is enough to reject it)
    image_bytes = file.file.read(MAX_UPLOAD_BYTES + 1)

    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Image is too large. Maximum size is 10 MB."
        )

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty."
        )

    # Open image
    try:
        image = Image.open(
            io.BytesIO(image_bytes)
        ).convert("RGB")
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is not a valid image."
        )

    # Resize according to model input
    image = image.resize((224, 224))

    # Convert image to NumPy array (raw 0-255 pixels).
    # Do NOT normalize here: the saved model already starts with a
    # Rescaling(1/127.5, offset=-1) layer, so normalizing again would
    # feed it near-constant input.
    image_array = np.array(
        image,
        dtype="float32"
    )

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
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000"))
    )
