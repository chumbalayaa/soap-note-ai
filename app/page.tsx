'use client'

import { useState, useRef } from 'react'

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState<string>('')
  const [soapNote, setSoapNote] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  
  // MediaRecorder instance to handle audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  // Array to store audio chunks as they're recorded
  const audioChunksRef = useRef<Blob[]>([])

  // Start recording audio using the browser's MediaRecorder API
  const startRecording = async () => {
    try {
      // Request access to the user's microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Create a MediaRecorder instance to capture audio
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      // Collect audio data chunks as they're recorded
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      // When recording stops, combine all chunks into a single Blob
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await sendAudioToServer(audioBlob)
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop())
      }

      // Start recording
      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Failed to start recording. Please allow microphone access.')
    }
  }

  // Stop the current recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  // Send the recorded audio Blob to the backend API route
  const sendAudioToServer = async (audioBlob: Blob) => {
    setIsProcessing(true)
    setTranscript('')
    setSoapNote('')

    try {
      // Create FormData to send the audio file as multipart/form-data
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      // Send the audio to our API route
      const response = await fetch('/api/soap-from-audio', {
        method: 'POST',
        body: formData,
      })

      // Parse the JSON response (even if there's an error, it may contain a message)
      const data = await response.json()

      if (!response.ok) {
        // Display the error message from the API if available
        alert(`Error: ${data.error || 'Failed to process audio'}`)
        return
      }
      
      // Check if the response contains an error message (even with 200 status)
      if (data.error) {
        alert(`Error: ${data.error}`)
        return
      }
      
      setTranscript(data.transcript)
      setSoapNote(data.soapNote)
    } catch (error) {
      console.error('Error sending audio:', error)
      alert('Failed to process audio. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>SOAP Note Generator</h1>
      
      <div style={{ marginBottom: '30px' }}>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: isRecording ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
          }}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        
        {isProcessing && (
          <p style={{ marginTop: '10px', color: '#666' }}>Processing audio...</p>
        )}
        
        <p style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>
          Note: Maximum file size is 25 MB (~10-15 minutes for WebM audio)
        </p>
      </div>

      {transcript && (
        <div style={{ marginBottom: '30px' }}>
          <h2>Transcript</h2>
          <div style={{
            padding: '15px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            whiteSpace: 'pre-wrap',
          }}>
            {transcript}
          </div>
        </div>
      )}

      {soapNote && (
        <div>
          <h2>SOAP Note</h2>
          <div style={{
            padding: '15px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            whiteSpace: 'pre-wrap',
          }}>
            {soapNote}
          </div>
        </div>
      )}
    </div>
  )
}

