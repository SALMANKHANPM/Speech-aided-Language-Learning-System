import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { checkBackendHealth } from '@/lib/health';

export default function HealthIndicator(){
  const [isHealthy, setIsHealthy] = useState<boolean>(false);

  useEffect(() => {
    const checkHealth = async () => {
      const healthy = await checkBackendHealth();
      setIsHealthy(healthy);
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2">
      {isHealthy ? (
        <CheckCircle2 className="w-4 h-4 text-green-500" />
      ) : (
        <XCircle className="w-4 h-4 text-red-500" />
      )}
      <span className={isHealthy ? "text-green-500" : "text-red-500"}>
        {isHealthy ? "Backend Connected" : "Backend Disconnected"}
      </span>
    </div>
  );
};