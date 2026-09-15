import { useState, useEffect } from "react";

export function isMobileOrAndroidDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  // Check URL override for testing purposes if needed (e.g. ?allowMobile=true)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("allowMobile") === "true") {
    return false;
  }
  if (urlParams.get("testMobile") === "true") {
    return true;
  }

  const userAgent = (navigator.userAgent || navigator.vendor || window.opera || "").toLowerCase();

  // 1. Explicit Android check
  const isAndroid = /android/i.test(userAgent);

  // 2. Comprehensive Mobile / Phone / Tablet check
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|silk|kindle/i.test(
    userAgent
  );

  // 3. UserAgentData check (Modern Chrome / Edge)
  const isMobileClientHint = Boolean(navigator.userAgentData?.mobile);

  // 4. Screen dimensions & touch points (Phones & Tablets)
  const isSmallScreen = window.innerWidth < 1024 || (window.screen && window.screen.width < 1024);
  const hasTouchScreen = navigator.maxTouchPoints > 1;

  // If UA indicates Android or Mobile, or if screen is small like a phone/tablet
  if (isAndroid || isMobileUA || isMobileClientHint || (isSmallScreen && hasTouchScreen)) {
    return true;
  }

  return false;
}

export function useDeviceDetector() {
  const [isMobile, setIsMobile] = useState(isMobileOrAndroidDevice());

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(isMobileOrAndroidDevice());
    };

    window.addEventListener("resize", checkDevice);
    window.addEventListener("orientationchange", checkDevice);

    return () => {
      window.removeEventListener("resize", checkDevice);
      window.removeEventListener("orientationchange", checkDevice);
    };
  }, []);

  return isMobile;
}
