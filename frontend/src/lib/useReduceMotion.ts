import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// Defaults to true so animations stay off until the system setting is known,
// and tracks live changes via the reduceMotionChanged listener.
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      changed = true;
      setReduceMotion(value);
    });
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active && !changed) setReduceMotion(value);
    }).catch((error: unknown) => {
      console.warn("Could not read reduce-motion setting; animations stay disabled.", error);
    });
    return () => { active = false; subscription.remove(); };
  }, []);

  return reduceMotion;
}
