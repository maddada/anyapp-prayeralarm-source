import { useEffect, useState } from 'react';

import { isAlarmSoundPlaying } from './alarms';

function check(): boolean {
  try {
    return isAlarmSoundPlaying();
  } catch {
    return false;
  }
}

/** True while the adhan or a spoken reminder is sounding, so screens can offer a Stop button. */
export function useSoundPlaying(): boolean {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const update = () => setPlaying(check());
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);
  return playing;
}
