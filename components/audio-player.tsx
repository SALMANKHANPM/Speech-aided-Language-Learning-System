import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Volume2, Pause, Loader2 } from 'lucide-react';

interface AudioPlayerProps {
  audioUrl: string;
  label: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, label }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = async () => {
    try {
      setIsLoading(true);
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => setIsPlaying(false);
      }
      
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Audio playback error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={togglePlay} 
      variant="outline" 
      size="sm"
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : isPlaying ? (
        <Pause className="w-4 h-4 mr-2" />
      ) : (
        <Volume2 className="w-4 h-4 mr-2" />
      )}
      {isLoading ? 'Loading...' : isPlaying ? 'Playing' : label}
    </Button>
  );
};

export default AudioPlayer;