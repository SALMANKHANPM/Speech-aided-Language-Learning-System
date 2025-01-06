from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import tempfile
import os
import logging
from typing import Dict
import torch
import torchaudio
import soundfile as sf
from transformers import AutoProcessor, SeamlessM4Tv2Model, AutoModelForSpeechSeq2Seq
import numpy as np
from scipy.io import wavfile
from datetime import datetime
import base64
import io
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")


@app.get("/api/py/health")
def health_check():
    return {"status": "OK"}

def transcribe_m4t(audio_file, language: str = "tel") -> Dict:
    try:
        processor = AutoProcessor.from_pretrained("facebook/seamless-m4t-v2-large")
        model = SeamlessM4Tv2Model.from_pretrained("facebook/seamless-m4t-v2-large")
        device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        model = model.to(device)
        logger.info(f"Model loaded successfully on {device}")
    except Exception as e:
        logger.error(f"Failed to load model: {str(e)}")
        raise
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


def transcribe_whisper(audio_file) -> Dict:
    try:
        processor_whisper = AutoProcessor.from_pretrained("swechatelangana/whisper-small-te-146h")
        model_whisper = AutoModelForSpeechSeq2Seq.from_pretrained("swechatelangana/whisper-small-te-146h")
        device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        model_whisper = model_whisper.to(device)
        logger.info(f"Model loaded successfully on {device}")
    except Exception as e:
        logger.error(f"Failed to load model: {str(e)}")
        raise
    # Load and process audio
    speech_array, sampling_rate = torchaudio.load(audio_file)
    speech_array = speech_array.mean(dim=0)

    transform = torchaudio.transforms.Resample(orig_freq=sampling_rate, new_freq=16000)
    speech_array = transform(speech_array).squeeze()

    # Prepare inputs and transfer to GPU
    inputs = processor_whisper(speech_array, sampling_rate=16000, return_tensors="pt")
    inputs = {key: tensor.to(device) for key, tensor in inputs.items()}

    # Generate predictions
    with torch.no_grad():
        predicted_ids = model_whisper.generate(inputs["input_features"], language='telugu', suppress_tokens=None)
        predicted_ids_eng = model_whisper.generate(inputs["input_features"], language='english', suppress_tokens=None)

    transcription = processor_whisper.batch_decode(predicted_ids, skip_special_tokens=True)
    transcription_eng = processor_whisper.batch_decode(predicted_ids_eng, skip_special_tokens=True)

    
    return {
        "transcription": transcription,
        "translation": transcription_eng
    }
@app.get("/")
def read_root():
    health_check()
    return {"message": "Hello from FastAPI"}


# Create audio directory if not exists
AUDIO_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'audio')
os.makedirs(AUDIO_DIR, exist_ok=True)


import soundfile as sf
import numpy as np
from scipy.io import wavfile
import librosa

@app.post("/api/py/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    if not file.filename.endswith('.wav'):
        raise HTTPException(status_code=400, detail="Only WAV files are supported")
    
    try:
        # Generate unique filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"audio_{timestamp}.wav"
        file_path = os.path.join(AUDIO_DIR, filename)
        
        # Save original file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
            
        # Load and validate audio
        try:
            audio_data, sample_rate = librosa.load(file_path, sr=16000)
            sf.write(file_path, audio_data, sample_rate, subtype='PCM_16')
            logger.info(f"Audio validated and converted: {file_path}")
        except Exception as e:
            logger.error(f"Audio validation failed: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid audio format")
        
        logger.info(f"Processing file: {file_path}")
        output_m4t = transcribe_m4t(file_path)
        logger.info(f"Transcription result: M4T : {output_m4t}")
        output_whisper = transcribe_whisper(file_path)
        logger.info(f"Transcription result: Whisper {output_whisper}")
        
        return JSONResponse(content=[output_m4t, output_whisper])
            
    except Exception as e:
        logger.error(f"Error processing file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))