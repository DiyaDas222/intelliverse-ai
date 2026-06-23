import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "processing";

export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(Array(24).fill(0));
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType =
        ["audio/webm", "audio/mp4"].find((t) =>
          typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
        ) || "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        resolveRef.current?.(blob.size > 512 ? blob : null);
        resolveRef.current = null;
        cleanup();
        setLevels(Array(24).fill(0));
      };
      recorder.start(250);

      // waveform
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        const bars: number[] = [];
        const step = Math.max(1, Math.floor(buf.length / 24));
        for (let i = 0; i < 24; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += buf[i * step + j] ?? 0;
          bars.push(Math.min(1, sum / step / 180));
        }
        setLevels(bars);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setState("recording");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Microphone unavailable";
      setError(msg);
      setState("idle");
      cleanup();
    }
  }, [cleanup]);

  const stop = useCallback(() => {
    return new Promise<Blob | null>((resolve) => {
      const r = recorderRef.current;
      if (!r || r.state === "inactive") {
        resolve(null);
        return;
      }
      resolveRef.current = resolve;
      setState("processing");
      r.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    const r = recorderRef.current;
    if (r && r.state !== "inactive") {
      resolveRef.current = () => {};
      r.stop();
    }
    cleanup();
    setState("idle");
    setLevels(Array(24).fill(0));
  }, [cleanup]);

  return { state, error, levels, start, stop, cancel, setStateIdle: () => setState("idle") };
}
