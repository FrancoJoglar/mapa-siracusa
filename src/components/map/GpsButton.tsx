import { useRef, useCallback } from "react";
import { useMap } from "react-leaflet";

interface Props {
  onWatchStart: () => void;
  onWatchStop: () => void;
  watching: boolean;
}

export default function GpsButton({ onWatchStart, onWatchStop, watching }: Props) {
  const map = useMap();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const flyToPosition = useCallback((lat: number, lng: number) => {
    map.flyTo([lat, lng], 16, { duration: 1 });
  }, [map]);

  const handleDown = useCallback(() => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      if (watching) {
        onWatchStop();
      } else {
        onWatchStart();
      }
    }, 2000);
  }, [watching, onWatchStart, onWatchStop]);

  const handleUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isLongPress.current) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        flyToPosition(pos.coords.latitude, pos.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [flyToPosition]);

  const handleLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        right: 12,
        zIndex: 1000,
        pointerEvents: "auto",
      }}
    >
      <button
        onMouseDown={handleDown}
        onMouseUp={handleUp}
        onMouseLeave={handleLeave}
        onTouchStart={handleDown}
        onTouchEnd={handleUp}
        title="GPS: tap = ir, mantener = seguir"
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "none",
          background: watching ? "#4caf50" : "#1565c0",
          color: "#fff",
          fontSize: 22,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.2s",
          touchAction: "manipulation",
        }}
      >
        {watching ? "📍" : "◎"}
      </button>
    </div>
  );
}
