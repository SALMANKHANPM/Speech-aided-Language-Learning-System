import React, { useRef, useEffect } from 'react'

interface WaveformProps {
  audioUrl: string | null
  isRecording: boolean
}

const Waveform: React.FC<WaveformProps> = ({ audioUrl, isRecording }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let audioContext: AudioContext
    let analyser: AnalyserNode
    let source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode

    const drawDotMatrix = () => {
      if (!analyser) return

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      analyser.getByteFrequencyData(dataArray)

      ctx.fillStyle = 'hsl(var(--background))'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const dotSize = 4
      const gap = 2
      const cols = Math.floor(canvas.width / (dotSize + gap))
      const rows = Math.floor(canvas.height / (dotSize + gap))

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * (dotSize + gap)
          const y = j * (dotSize + gap)

          const index = Math.floor(i / cols * bufferLength)
          const intensity = dataArray[index] / 255

          ctx.beginPath()
          ctx.arc(x, y, dotSize / 2 * intensity, 0, Math.PI * 2)
          ctx.fillStyle = `hsl(var(--primary) / ${intensity})`
          ctx.fill()
        }
      }

      animationRef.current = requestAnimationFrame(drawDotMatrix)
    }

    const setupAudio = async () => {
      if (isRecording) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        audioContext = new AudioContext()
        analyser = audioContext.createAnalyser()
        source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)
      } else if (audioUrl) {
        const audio = new Audio(audioUrl)
        audioContext = new AudioContext()
        analyser = audioContext.createAnalyser()
        source = audioContext.createMediaElementSource(audio)
        source.connect(analyser)
        source.connect(audioContext.destination)
        audio.play()
      }

      if (analyser) {
        analyser.fftSize = 256
        drawDotMatrix()
      }
    }

    setupAudio()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (audioContext) {
        audioContext.close()
      }
    }
  }, [audioUrl, isRecording])

  return (
    <div className="relative w-full h-32 bg-background rounded-md overflow-hidden">
      <canvas ref={canvasRef} width="600" height="128" className="w-full h-full" />
      {isRecording && (
        <div className="absolute top-2 right-2 flex items-center">
          <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse" />
          <span className="text-sm font-medium text-primary">Recording</span>
        </div>
      )}
    </div>
  )
}

export default Waveform

