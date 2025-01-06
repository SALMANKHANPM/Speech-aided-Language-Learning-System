'use client'

import { useState, useEffect } from 'react'
import AudioChatbot from '@/components/audio-chatbot'
import HealthIndicator from '@/components/health-indicator'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Loader2, AlertTriangle } from 'lucide-react'
import { checkBackendHealth } from '@/lib/health'

export default function Home() {
  const [isHealthy, setIsHealthy] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkHealth = async () => {
    setIsChecking(true);
    const healthy = await checkBackendHealth();
    setIsHealthy(healthy);
    setIsChecking(false);
  };

  useEffect(() => {
    checkHealth();
  }, []);

  if (isChecking) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>Checking backend connection...</p>
      </main>
    );
  }

  if (!isHealthy) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8">
        <Alert variant="destructive" className="max-w-md w-full mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Backend Disconnected</AlertTitle>
          <AlertDescription>
            Unable to connect to the backend service. Please check if the server is running.
          </AlertDescription>
        </Alert>
        <Button onClick={checkHealth} variant="outline" className="mt-4">
          {isChecking ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <AlertTriangle className="h-4 w-4 mr-2" />
          )}
          Retry Connection
        </Button>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 md:px-8 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-8">
        <AudioChatbot onTranscription={(data) => console.log(data)} />
        <div className="flex justify-center">
          <HealthIndicator />
        </div>
      </div>
    </main>
  );
}