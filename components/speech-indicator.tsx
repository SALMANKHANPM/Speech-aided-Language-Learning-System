import React from 'react'
import { cn } from "@/lib/utils"

interface SpeechIndicatorProps {
  isRecording: boolean
}

const SpeechIndicator: React.FC<SpeechIndicatorProps> = ({ isRecording }) => {
  return (
    <div className="flex items-center justify-center h-8">
      <div className="relative">
        <div
          className={cn(
            "w-4 h-4 rounded-full transition-all duration-300 ease-in-out",
            isRecording ? "bg-red-500" : "bg-gray-300"
          )}
        />
        {isRecording && (
          <>
            <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
            <div className="absolute inset-0 rounded-full bg-red-500 animate-pulse opacity-75" />
          </>
        )}
      </div>
      {/* <span className="ml-2 text-sm font-medium">
        {isRecording ? "Recording..." : "Ready"}
      </span> */}
    </div>
  )
}

export default SpeechIndicator

