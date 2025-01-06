export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch('/api/py/health');
    console.log('Health check response:', response);
    const data = await response.json();
    return data.status === 'OK';
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}