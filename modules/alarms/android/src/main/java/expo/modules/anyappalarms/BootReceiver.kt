package expo.modules.anyappalarms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import java.util.TimeZone

/** Android forgets alarms on reboot; this re-arms the stored ones. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    Log.i(AlarmScheduler.TAG, "Re-arming alarms after ${intent.action}")
    // The prayer times follow the phone's time zone: make sure the new one is used right away.
    if (intent.action == Intent.ACTION_TIMEZONE_CHANGED) TimeZone.setDefault(null)
    AlarmScheduler.rescheduleAll(context)
    PrayerScheduler.refresh(context)
  }
}
