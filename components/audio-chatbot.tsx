'use client'

import React, { useState, useRef } from 'react'
import { useChat } from 'ai/react'
import { Mic, Play, CircleStopIcon as Stop, Volume2, Loader2, Upload } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import SpeechIndicator from './speech-indicator'
import AudioPlayer from './audio-player'

interface TranscriptionData { 
  transcription: string;
  translations: { [key: string]: string };
}

interface AudioChatbotProps {
  onTranscription: (data: TranscriptionData) => void;
}

const AudioChatbot: React.FC<AudioChatbotProps> = ({ onTranscription }) => {
  const { messages, setInput, handleSubmit } = useChat()
  const [isRecording, setIsRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [currentTranscription, setCurrentTranscription] = useState<TranscriptionData | null>(null)
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)

  const startRecording = async () => {
    try {
      if (currentTranscription) {
        setTranscriptionHistory(prev => [...prev, currentTranscription])
        setCurrentTranscription(null)
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder.current = new MediaRecorder(stream)
      const audioChunks: Blob[] = []

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.push(event.data)
      }

      mediaRecorder.current.onstop = async () => {
        setIsLoading(true)
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
        const url = URL.createObjectURL(audioBlob)
        setAudioUrl(url)
        
        await processAudio(audioBlob)
      }

      mediaRecorder.current.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error accessing microphone:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop()
      setIsRecording(false)
    }
  }

  const playTTS = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text)
    window.speechSynthesis.speak(utterance)
  }

  const renderTranscriptionData = (data: TranscriptionData) => (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-lg">Transcription</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Card className="bg-green-100">
          <CardContent className="p-4">
            <p className="font-semibold">{data.transcription}</p>
          </CardContent>
        </Card>

        <CardTitle className="text-lg mt-4">Translation</CardTitle>
        <Card className="bg-green-100">
          <CardContent className="p-4">
            <p>{data.translations.English}</p>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )

  const processAudio = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');

    try {
      const response = await fetch('/api/py/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to process audio');
      
      const result = await response.json();
      
      const newTranscription: TranscriptionData = {
        transcription: result.transcription,
        translations: { 
          English: result.translation,
          Telugu: result.transcription
        },
      };

      setCurrentTranscription(newTranscription);
      setInput(result.translation);
      handleSubmit(new Event('submit') as any);
      onTranscription(newTranscription); // Pass data to parent component
    } catch (error) {
      console.error('Error processing audio:', error);
    }
    setIsLoading(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.includes('audio/wav')) {
      alert('Please upload a WAV file');
      return;
    }
  
    setIsLoading(true);
    try {
      await processAudio(file);
    } catch (error) {
      console.error('Error uploading file:', error);
    }
    setIsLoading(false);
  };

  return (
    <>
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Audio Chatbot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <Tabs defaultValue="current">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="current">Current</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="current">
            <ScrollArea className="h-[50vh] pr-4">
              {isLoading ? (
                <Card>
                  <CardContent className="p-8 flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                    <p className="text-lg font-semibold">Processing audio...</p>
                    <p className="text-sm text-muted-foreground mt-2">This may take a few moments</p>
                  </CardContent>
                </Card>
              ) : currentTranscription ? (
                renderTranscriptionData(currentTranscription)
              ) : (
                <Card>
                  <CardContent className="p-4 flex items-center justify-center">
                    <p className="text-lg font-semibold">No current transcription</p>
                  </CardContent>
                </Card>
              )}
            </ScrollArea>
          </TabsContent>
          <TabsContent value="history">
            <ScrollArea className="h-[50vh] pr-4">
              {transcriptionHistory.length > 0 ? (
                transcriptionHistory.map((data, index) => (
                  <div key={index}>
                    {renderTranscriptionData(data)}
                  </div>
                ))
              ) : (
                <Card>
                  <CardContent className="p-4 flex items-center justify-center">
                    <p className="text-lg font-semibold">No transcription history</p>
                  </CardContent>
                </Card>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

      </CardContent>
      <CardFooter className="flex justify-center space-x-2 p-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-8 h-8">
            {isRecording && (
              <div className="relative">
                <div className="absolute -left-2 top-1/2 -translate-y-1/2">
                  <div className="flex items-center gap-1">
                  <SpeechIndicator isRecording={isRecording} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <Button 
            onClick={isRecording ? stopRecording : startRecording} 
            variant="outline"
            disabled={isLoading}
          >
            {isRecording ? <Stop className="text-red-500 mr-2" /> : <Mic className="mr-2" />}
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </Button>
          {audioUrl && (
            <Button onClick={() => new Audio(audioUrl).play()} variant="outline" disabled={isLoading}>
              <Play className="mr-2" />
              Play Audio
            </Button>
          )}
          <div className="relative">
            <input
              type="file"
              accept="audio/wav"
              onChange={handleFileUpload}
              className="hidden"
              id="audio-upload"
            />
            <Button
              variant="outline"
              disabled={isLoading}
              onClick={() => document.getElementById('audio-upload')?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload WAV
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
    </>
  )
}

export default AudioChatbot;

