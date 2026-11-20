package expo.modules.anyappalarms

import android.content.Context
import android.util.Log
import org.json.JSONObject

/**
 * Keeps the prayer alarms going without the app being opened. The app hands over the user's
 * settings once ([setConfig]); after that [refresh] runs every time an alarm rings, after the
 * phone restarts and after a clock change, and adds the alarms of the next days.
 */
object PrayerScheduler {
  private const val PREFS = "expo.modules.anyappalarms.prayer"
  private const val KEY_CONFIG = "config"

  /** Stores the user's settings (JSON from src/lib/schedule.ts) and brings the alarms in line. */
  fun setConfig(c: Context, json: String) {
    c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_CONFIG, json).commit()
    refresh(c)
    // The app is open: get the speech voice ready now, so the first spoken reminder is not late.
    // (Not done in refresh, which also runs while an alarm is speaking.)
    try {
      config(c)?.let { cfg -> PrayerPlan.plan(cfg, System.currentTimeMillis()).firstOrNull { !it.speak.isNullOrBlank() } }
        ?.let { TtsWarmer.warm(c, it.language) }
    } catch (e: Exception) {
      Log.w(AlarmScheduler.TAG, "Could not prepare the speech voice", e)
    }
  }

  private fun config(c: Context): PrayerPlan.Config? {
    val raw = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_CONFIG, null) ?: return null
    return try {
      val json = JSONObject(raw)
      val adjust = json.optJSONObject("adjust")
      val prayerOn = json.optJSONObject("prayerOn")
      // A place from the app, or none (older settings, or not chosen yet): then no alarms.
      val latitude = json.optDouble("latitude", Double.NaN).takeIf { it.isFinite() && it in -90.0..90.0 }
      val longitude = json.optDouble("longitude", Double.NaN).takeIf { it.isFinite() && it in -180.0..180.0 }
      PrayerPlan.Config(
        latitude = latitude.takeIf { longitude != null },
        longitude = longitude.takeIf { latitude != null },
        enabled = json.optBoolean("enabled", true),
        firstMinutes = json.optInt("firstMinutes", 20).coerceIn(1, 120),
        secondMinutes = json.optInt("secondMinutes", 5).coerceIn(1, 120),
        adjust = PrayerPlan.PRAYERS.associateWith { (adjust?.optInt(it, 0) ?: 0).coerceIn(-60, 60) },
        hour24 = json.optBoolean("hour24", false),
        method = json.optString("method", "uae").takeIf { it in PrayerPlan.METHODS } ?: "uae",
        hanafiAsr = json.optString("asrSchool", "standard") == "hanafi",
        sound = json.optString("adhanSound", "adhan").takeIf { it.matches(Regex("[a-z][a-z0-9_]*")) } ?: "adhan",
        soundEndMs = json.optLong("adhanEndMs", 0L).coerceIn(0L, 10 * 60_000L),
        hijriCorrection = json.optInt("hijriCorrection", 0).coerceIn(-2, 2),
        statusBar = json.optBoolean("statusBar", true),
        prayerOn = PrayerPlan.PRAYERS.associateWith { prayerOn?.optBoolean(it, true) ?: true },
      )
    } catch (e: Exception) {
      Log.e(AlarmScheduler.TAG, "Could not read the prayer settings", e)
      null
    }
  }

  /** Alarms made by this scheduler (or by older versions of the app). Others are left alone. */
  private fun isOurs(id: String) = id.startsWith("p-") || id == "renew"

  /**
   * Makes the waiting alarms match the plan for the next days. Only what differs is touched,
   * so on a normal day this just adds the newest day. Does nothing until the app has handed
   * over the settings once. Never throws: a problem here must not stop an alarm from ringing.
   */
  @Synchronized
  fun refresh(c: Context) {
    try {
      val config = config(c) ?: return
      val now = System.currentTimeMillis()
      val plan = PrayerPlan.plan(config, now)
      val wanted = plan.map { it.id }.toHashSet()
      val existing = AlarmStore.all(c)

      // An alarm that is due this very moment is left alone so it still rings.
      for (alarm in existing) {
        if (isOurs(alarm.id) && alarm.id !in wanted && alarm.at > now + 10_000) {
          AlarmScheduler.cancel(c, alarm.id)
        }
      }

      val have = existing.associateBy { it.id }
      var added = 0
      for (p in plan) {
        // fullScreen = false: the prayer alarms show as a notification with a Stop button, as
        // they always have, and never take over the screen.
        val alarm = AlarmData(p.id, p.at, p.title, p.body, p.speak, p.language, p.sound, null, fullScreen = false, soundEndMs = p.soundEndMs)
        if (have[p.id] == alarm) continue
        AlarmScheduler.schedule(c, alarm)
        added++
      }
      if (added > 0) {
        Log.i(AlarmScheduler.TAG, "Prayer alarms topped up: $added set, ${plan.size} waiting")
        val late = if (AlarmScheduler.canScheduleExact(c)) "" else ", but they may ring late: exact alarms are not allowed"
        val next = plan.minByOrNull { it.at }
        val first = if (next != null) " (next: ${next.title} at ${AlarmDiary.time(next.at)})" else ""
        AlarmDiary.note(c, "Prayer alarms topped up: $added set, ${plan.size} waiting$first$late")
      }
      if (existing.any { isOurs(it.id) && it.id !in wanted }) {
        if (!config.hasPlace) AlarmDiary.note(c, "Prayer alarms paused: no place chosen yet")
        else if (!config.enabled) AlarmDiary.note(c, "Prayer alarms switched off")
      }
    } catch (e: Exception) {
      Log.e(AlarmScheduler.TAG, "Could not top up the prayer alarms", e)
    }
    try {
      config(c)?.let { NextPrayerNotification.update(c, it) }
    } catch (e: Exception) {
      Log.e(AlarmScheduler.TAG, "Could not update the prayer times notification", e)
    }
  }
}
