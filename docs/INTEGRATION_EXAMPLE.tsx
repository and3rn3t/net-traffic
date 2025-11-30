/**
 * Example: How to update App.tsx to use real backend API
 *
 * This file shows the changes needed to integrate the backend.
 * Copy the relevant parts into your src/App.tsx file.
 */

import { useState, useEffect } from 'react';
// Remove these imports when switching to real API:
// import { useKV } from '@github/spark/hooks';
// import { generateInitialDevices, ... } from '@/lib/mockData';

// Add this import:
import { useApiData } from '@/hooks/useApiData';

// Keep all your component imports
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { NetworkFlow, Device, Threat } from '@/lib/types';
// ... other imports

function App() {
  // REPLACE THIS SECTION:
  // =====================
  // const [devices, setDevices] = useKV<Device[]>('network-devices', []);
  // const [flows, setFlows] = useKV<NetworkFlow[]>('network-flows', []);
  // const [threats, setThreats] = useKV<Threat[]>('network-threats', []);
  // const [analyticsData] = useState(() => generateAnalyticsData(24));
  // const [protocolStats] = useState(() => generateProtocolStats());
  // const [isCapturing, setIsCapturing] = useState(true);

  // WITH THIS:
  const {
    devices = [],
    flows = [],
    threats = [],
    analyticsData = [],
    protocolStats = [],
    isCapturing,
    isLoading,
    isConnected,
    error,
    startCapture,
    stopCapture,
    dismissThreat,
  } = useApiData({
    pollingInterval: 5000, // Poll every 5 seconds as backup
    useWebSocket: true, // Enable real-time updates
  });

  // REMOVE THIS SECTION (mock data initialization):
  // ===============================================
  // useEffect(() => {
  //   if (!devices || devices.length === 0) {
  //     const initialDevices = generateInitialDevices(8);
  //     const initialFlows = generateInitialFlows(initialDevices, 30);
  //     const initialThreats = generateInitialThreats(initialDevices, initialFlows, 3);
  //     setDevices(initialDevices);
  //     setFlows(initialFlows);
  //     setThreats(initialThreats);
  //   }
  // }, []);

  // REMOVE THIS SECTION (mock data generation):
  // ===========================================
  // useEffect(() => {
  //   if (!isCapturing || !devices || devices.length === 0) return;
  //   const interval = setInterval(() => {
  //     // ... mock data generation code ...
  //   }, 3000);
  //   return () => clearInterval(interval);
  // }, [isCapturing, devices, flows, setFlows, setDevices, setThreats]);

  // UPDATE THIS FUNCTION:
  const handleDismissThreat = (id: string) => {
    // The useApiData hook provides dismissThreat function
    dismissThreat(id);

    // Remove manual state update:
    // setThreats(currentThreats => {
    //   if (!currentThreats) return [];
    //   return currentThreats.map(t => (t.id === id ? { ...t, dismissed: true } : t));
    // });
  };

  // ADD LOADING STATE HANDLING:
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Connecting to backend...</p>
        </div>
      </div>
    );
  }

  // ADD ERROR STATE HANDLING (optional):
  if (error && !isConnected) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">Backend Connection Failed</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry Connection</Button>
          <p className="text-sm text-muted-foreground mt-4">
            Ensure your Raspberry Pi backend is running and accessible.
          </p>
        </div>
      </div>
    );
  }

  // UPDATE CAPTURE BUTTON:
  // ======================
  // Replace:
  //   onClick={() => setIsCapturing(!isCapturing)}
  //
  // With:
  //   onClick={() => {
  //     if (isCapturing) {
  //       stopCapture();
  //     } else {
  //       startCapture();
  //     }
  //   }}

  // Rest of your component remains the same...
  const activeThreats = (threats || []).filter(t => !t.dismissed);
  const activeFlows = (flows || []).filter(f => f.status === 'active');
  const totalBytes = (flows || []).reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0);

  // ... rest of your component code
  return (
    <div className="min-h-screen bg-background text-foreground">{/* Your existing JSX */}</div>
  );
}

export default App;
