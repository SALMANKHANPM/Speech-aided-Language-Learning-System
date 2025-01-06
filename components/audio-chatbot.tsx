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

interface ModelOutput {
  transcription: string;
  translation: string;
}

interface TranscriptionData {
  m4t: ModelOutput;
  whisper: ModelOutput;
}

interface AudioChatbotProps {
  onTranscription: (data: TranscriptionData) => void;
}

interface UploadStatus {
  progress: number;
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
  message: string;
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
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    progress: 0,
    status: 'idle',
    message: ''
  });

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
    <Tabs defaultValue="m4t">
      <TabsList>
        <TabsTrigger value="m4t">M4T Model</TabsTrigger>
        <TabsTrigger value="whisper">Whisper Model</TabsTrigger>
      </TabsList>
      
      <TabsContent value="m4t">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">M4T : Transcription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Card className="bg-green-100">
              <CardContent className="p-4">
                <p className="font-semibold">{data.m4t.transcription}</p>
              </CardContent>
            </Card>
            <CardTitle className="text-lg mt-4">Translation</CardTitle>
            <Card className="bg-green-100">
              <CardContent className="p-4">
                <p>{data.m4t.translation}</p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="whisper">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Whisper :  Transcription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Card className="bg-green-100">
              <CardContent className="p-4">
                <p className="font-semibold">{data.whisper.transcription}</p>
              </CardContent>
            </Card>
            <CardTitle className="text-lg mt-4">Translation</CardTitle>
            <Card className="bg-green-100">
              <CardContent className="p-4">
                <p>{data.whisper.translation}</p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )

  const processAudio = async (audioBlob: Blob) => {
    setUploadStatus({ progress: 0, status: 'uploading', message: 'Uploading audio...' });
    
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');

    try {
      setUploadStatus({ progress: 50, status: 'processing', message: 'Processing audio...' });
      
      const response = await fetch('/api/py/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to process audio');
      
      const result = await response.json();
      console.log('Transcription result:', result); // Debug log
      
      const newTranscription: TranscriptionData = {
        m4t: {
          transcription: result[0].transcription,
          translation: result[0].translation
        },
        whisper: {
          transcription: result[1].transcription[0], // Fix array access
          translation: result[1].translation[0]      // Fix array access
        }
      };

      setCurrentTranscription(newTranscription);
      setInput(newTranscription.m4t.translation);
      handleSubmit(new Event('submit') as any);
      onTranscription(newTranscription);
      
      setUploadStatus({ progress: 100, status: 'complete', message: 'Complete!' });
      
    } catch (error) {
      console.error('Error processing audio:', error);
      setUploadStatus({ 
        progress: 0, 
        status: 'error', 
        message: 'Error processing audio' 
      });
    } finally {
      // Reset status after 2 seconds
      setTimeout(() => {
        setUploadStatus({ progress: 0, status: 'idle', message: '' });
      }, 2000);
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const ACCEPTED_AUDIO_TYPES = [
      'audio/mpeg',
      'audio/mp3',
      'audio/ogg',
      'audio/webm',
      'audio/wav',
      'audio/aac'
    ];
    if (!file) return;
    
    if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) {
      alert(`Please upload a valid audio file (${ACCEPTED_AUDIO_TYPES.join(', ')})`);
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

  const renderUploadStatus = () => {
    if (uploadStatus.status === 'idle') return null;

    return (
      <div className="mt-4 p-4 rounded-md bg-secondary">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{uploadStatus.message}</span>
          <span className="text-sm">{uploadStatus.progress}%</span>
        </div>
        <div className="w-full bg-secondary-foreground/20 rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${uploadStatus.progress}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <>
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Audio Chatbot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {renderUploadStatus()}
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
              accept="audio/*"
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

