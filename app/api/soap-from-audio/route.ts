import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client using the API key from environment variables
// Add timeout configuration to handle long-running requests
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000, // 120 seconds timeout for audio transcription
  maxRetries: 2, // Retry up to 2 times on failure
})

export async function POST(request: NextRequest) {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured. Please set OPENAI_API_KEY in .env.local' },
        { status: 500 }
      )
    }

    // Verify API key is valid by checking it's not empty and has correct format
    if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
      return NextResponse.json(
        { error: 'Invalid OpenAI API key format. API keys should start with "sk-".' },
        { status: 500 }
      )
    }

    // Parse the multipart/form-data request to get the audio file
    const requestFormData = await request.formData()
    const audioFile = requestFormData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // OpenAI Whisper API has a 25 MB file size limit
    // For WebM audio, this typically allows ~10-15 minutes of recording
    const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB in bytes
    const fileSizeMB = (audioFile.size / 1024 / 1024).toFixed(2)

    console.log(`Processing audio file: ${audioFile.name}, size: ${fileSizeMB} MB, type: ${audioFile.type}`)

    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `Audio file is too large. Maximum size is 25 MB (current: ${fileSizeMB} MB). Please record a shorter audio clip.`
        },
        { status: 400 }
      )
    }

    // Use direct HTTP request instead of SDK to avoid File object issues
    // This gives us full control over how the file is sent
    console.log('Preparing file for OpenAI Whisper API...')
    console.log(`File details: name=${audioFile.name}, type=${audioFile.type}, size=${fileSizeMB}MB`)

    // Read the file data
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Create FormData for multipart/form-data request (like the Python example)
    const openAIFormData = new FormData()
    const blob = new Blob([buffer], { type: audioFile.type || 'audio/webm' })
    openAIFormData.append('file', blob, audioFile.name || 'recording.webm')
    openAIFormData.append('model', 'gpt-4o-transcribe')
    openAIFormData.append('response_format', 'json')
    openAIFormData.append('language', 'en')

    console.log('Sending to OpenAI Whisper API via direct HTTP request...')

    // Step 1: Transcribe the audio using OpenAI Whisper API via direct HTTP
    // This bypasses SDK file handling issues
    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: openAIFormData,
    })

    if (!transcriptionResponse.ok) {
      const errorData = await transcriptionResponse.text()
      throw new Error(`OpenAI API error: ${transcriptionResponse.status} - ${errorData}`)
    }

    const transcription = await transcriptionResponse.json()

    // Extract the transcript text from the response
    const transcriptText = transcription.text

    // Step 2: Generate a SOAP note from the transcription using OpenAI Chat API
    // The chat API uses GPT to structure the transcript into a SOAP note format
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4o', // Using GPT-4o for SOAP note generation
      messages: [
        {
          role: 'system',
          content: 'You are a clinician assistant. Produce a SOAP note with S, O, A, P sections, based only on the provided transcript.',
        },
        {
          role: 'user',
          content: `Please create a SOAP note from the following transcript:\n\n${transcriptText}`,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent, clinical output
    })

    const soapNoteText = chatResponse.choices[0]?.message?.content || ''

    // Return both the transcript and the generated SOAP note as JSON
    return NextResponse.json({
      transcript: transcriptText,
      soapNote: soapNoteText,
    })
  } catch (error: any) {
    console.error('Error processing audio:', error)

    // Provide more specific error messages for common issues
    if (error instanceof Error) {
      // Check for connection errors
      if (error.message.includes('ECONNRESET') || error.message.includes('Connection error')) {
        return NextResponse.json(
          { error: 'Connection error with OpenAI API. Please check your internet connection and API key, then try again.' },
          { status: 500 }
        )
      }

      // Check for API key errors
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: 'Invalid OpenAI API key. Please check your .env.local file.' },
          { status: 401 }
        )
      }

      // Check for file size errors
      if (error.message.includes('file size') || error.message.includes('too large')) {
        return NextResponse.json(
          { error: 'Audio file is too large. Maximum size is 25 MB. Please record a shorter clip.' },
          { status: 400 }
        )
      }

      // Check for invalid file format
      if (error.message.includes('Invalid file format') || error.message.includes('unsupported')) {
        return NextResponse.json(
          { error: 'Invalid audio format. Please try recording again.' },
          { status: 400 }
        )
      }
    }

    // Return the actual error message if available for debugging
    const errorMessage = error?.message || error?.error?.message || 'Failed to process audio. Please try again.'

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

