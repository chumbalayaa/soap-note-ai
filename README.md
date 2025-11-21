# SOAP Note AI

A minimal Next.js app that records audio, transcribes it using OpenAI Whisper, and generates a SOAP note using GPT.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```bash
cp .env.local.example .env.local
```

3. Add your OpenAI API key to `.env.local`:
```
OPENAI_API_KEY=your-api-key-here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Click "Start Recording" to begin recording audio
2. Speak your clinical notes
3. Click "Stop Recording" to stop and process
4. View the transcript and generated SOAP note

## Audio Constraints

The app uses OpenAI's Whisper API for transcription, which has the following limits:

- **Maximum file size**: 25 MB
- **Recommended duration**: ~10-15 minutes for WebM audio format
- **Supported formats**: MP3, MP4, M4A, WAV, WebM

If your recording exceeds 25 MB, you'll receive an error message. For longer recordings, split them into smaller segments before processing.

# soap-note-ai
