from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import tempfile
import os
import logging
from typing import Dict
import torch
import torchaudio
import soundfile as sf
from transformers import AutoProcessor, SeamlessM4Tv2Model
import numpy as np
from scipy.io import wavfile
from datetime import datetime
import base64
import io
import shutil
import librosa


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")


# Load models once at startup
try:
    processor = AutoProcessor.from_pretrained("facebook/seamless-m4t-v2-large")
    model = SeamlessM4Tv2Model.from_pretrained("facebook/seamless-m4t-v2-large")
    device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    model = model.to(device)
    logger.info(f"Model loaded successfully on {device}")
except Exception as e:
    logger.error(f"Failed to load model: {str(e)}")
    raise

@app.get("/api/py/health")
def health_check():
    return {"status": "OK"}

def transcribe_m4t(audio_file, language: str = "tel") -> Dict:
    try:
        audio_array, sampling_rate = sf.read(audio_file)
        audio = {"array": torch.tensor(audio_array), "sampling_rate": sampling_rate}

        audio = torchaudio.functional.resample(
            audio["array"],
            orig_freq=audio['sampling_rate'],
            new_freq=model.config.sampling_rate
        )

        audio_inputs = processor(audios=audio, return_tensors="pt").to(device)

        output_tokens_tel = model.generate(**audio_inputs, tgt_lang=language, generate_speech=False)
        output_tokens_eng = model.generate(**audio_inputs, tgt_lang="eng", generate_speech=False)

        return {
            "transcription": processor.decode(output_tokens_tel[0].tolist()[0], skip_special_tokens=True),
            "translation": processor.decode(output_tokens_eng[0].tolist()[0], skip_special_tokens=True)
        }
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        raise

@app.get("/")
def read_root():
    health_check()
    return {"message": "Hello from FastAPI"}


# Create audio directory if not exists
AUDIO_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'audio')
os.makedirs(AUDIO_DIR, exist_ok=True)

@app.post("/api/py/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    if not file.filename.endswith('.wav'):
        raise HTTPException(status_code=400, detail="Only WAV files are supported")

    try:

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = os.path.join(AUDIO_DIR, f"audio_{timestamp}.wav")

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Load and validate audio
        try:
            audio_data, sample_rate = librosa.load(file_path, sr=16000)
            sf.write(file_path, audio_data, sample_rate, subtype='PCM_16')
            logger.info(f"Audio validated and converted: {file_path}")
        except Exception as e:
            logger.error(f"Audio validation failed: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid audio format")

        logger.info(f"Processing file: {file_path}")
        output = transcribe_m4t(file_path)
        logger.info(f"Transcription result: {output}")

        return JSONResponse(content=output)

    except Exception as e:
        logger.error(f"Error processing file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

