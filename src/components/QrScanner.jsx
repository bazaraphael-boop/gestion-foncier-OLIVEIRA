import React, { useEffect, useRef, useState } from 'react';
import { CameraOff, X } from 'lucide-react';

// Camera QR reader of the official site. onResult receives the raw text of the first code read.
export default function QrScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let stream = null;
    let frame = 0;

    const start = async () => {
      try {
        const [{ default: jsQR }, media] = await Promise.all([
          import('jsqr'),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        ]);
        stream = media;
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        video.srcObject = media;
        await video.play();

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const scan = () => {
          if (cancelled) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const found = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            if (found?.data) {
              onResult(found.data);
              return;
            }
          }
          frame = requestAnimationFrame(scan);
        };
        scan();
      } catch {
        if (!cancelled) setError('Caméra indisponible. Autorisez la caméra, ou tapez le code imprimé sur le relevé.');
      }
    };
    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden relative">
      {error ? (
        <div role="alert" className="p-6 text-center text-white text-sm space-y-2">
          <CameraOff className="w-8 h-8 mx-auto text-slate-400" />
          <p>{error}</p>
        </div>
      ) : (
        <video ref={videoRef} muted playsInline aria-label="Aperçu de la caméra" className="w-full aspect-square object-cover block" />
      )}
      <button type="button" onClick={onClose} aria-label="Fermer la caméra" className="absolute top-2 right-2 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
