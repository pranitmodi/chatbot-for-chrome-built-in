import { useEffect, useRef, useState } from "react";
import { createProvider } from "../ai/provider.js";
import { AVAILABILITY, emptyCapabilities } from "../ai/types.js";
import { categorizeError } from "../ai/errors.js";

export function useLocalAi() {
  const providerRef = useRef(null);
  if (!providerRef.current) {
    providerRef.current = createProvider();
  }
  const provider = providerRef.current;

  const [phase, setPhase] = useState("checking");
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [capabilities, setCapabilities] = useState(emptyCapabilities());
  const [error, setError] = useState(null);
  const [contextUsage, setContextUsage] = useState(null);
  const [offline, setOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await provider.availability();
        if (cancelled) return;
        setCapabilities(result.capabilities);
        if (result.status === AVAILABILITY.UNSUPPORTED) {
          setPhase("unsupported");
          return;
        }
        if (result.status === AVAILABILITY.UNAVAILABLE) {
          setPhase("unavailable");
          return;
        }
        if (result.status === AVAILABILITY.AVAILABLE) {
          try {
            await provider.createSession();
            if (cancelled) return;
            setContextUsage(provider.getContextUsage());
            setPhase("ready");
            return;
          } catch {
            if (!cancelled) setPhase("downloadable");
            return;
          }
        }
        if (result.status === AVAILABILITY.DOWNLOADING) {
          setPhase("downloading");
          return;
        }
        setPhase("downloadable");
      } catch {
        if (!cancelled) setPhase("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider]);

  useEffect(() => {
    const onPageHide = () => provider.destroySession();
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [provider]);

  async function prepareModel() {
    setError(null);
    setPhase("downloading");
    setDownloadProgress(0);
    try {
      await provider.createSession({
        onDownloadProgress: (loaded) => {
          setDownloadProgress(loaded);
          setPhase("downloading");
        },
      });
      setContextUsage(provider.getContextUsage());
      setPhase("ready");
      setDownloadProgress(null);
    } catch (caught) {
      setError(categorizeError(caught) || "Chrome couldn't prepare the local model.");
      setPhase("error");
    }
  }

  return {
    provider,
    phase,
    setPhase,
    downloadProgress,
    capabilities,
    error,
    setError,
    contextUsage,
    setContextUsage,
    prepareModel,
    offline,
  };
}
