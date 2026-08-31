import { useState, useEffect, useRef, useCallback } from "react";

interface GeolocationState {
  position: { lat: number; lng: number } | null;
  accuracy: number | null;
  heading: number | null;
  error: string | null;
  watching: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    accuracy: null,
    heading: null,
    error: null,
    watching: false,
  });
  const watchIdRef = useRef<number | null>(null);
  const headingRef = useRef<number | null>(null);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, error: "Geolocalización no soportada" }));
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy: pos.coords.accuracy,
          heading: headingRef.current,
          error: null,
          watching: true,
        });
      },
      (err) => {
        setState(prev => ({ ...prev, error: err.message }));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );

    watchIdRef.current = id;
    setState(prev => ({ ...prev, watching: true, error: null }));

    // Device orientation for heading
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const h = (e as any).alpha;
      if (h != null) {
        headingRef.current = h;
        setState(prev => ({ ...prev, heading: h }));
      }
    };

    if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
      (DeviceOrientationEvent as any).requestPermission()
        .then((perm: string) => {
          if (perm === "granted") {
            window.addEventListener("deviceorientation", handleOrientation);
          }
        })
        .catch(() => {});
    } else {
      window.addEventListener("deviceorientation", handleOrientation);
    }
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState(prev => ({ ...prev, watching: false }));
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { ...state, startWatching, stopWatching };
}
