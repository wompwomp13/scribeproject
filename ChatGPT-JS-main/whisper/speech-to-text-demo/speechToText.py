import whisper
import json
import sys

def transcribe_audio():
    try:
        # Load the model
        model = whisper.load_model("tiny")
        
        # Transcribe the audio file
        result = model.transcribe("uploads/blob.wav")
        
        # Return the transcription as JSON
        print(json.dumps({"text": result["text"]}))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    transcribe_audio() 


    