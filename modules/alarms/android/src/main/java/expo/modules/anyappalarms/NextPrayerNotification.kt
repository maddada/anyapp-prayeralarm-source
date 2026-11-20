package expo.modules.anyappalarms

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.Icon
import android.os.Build
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.util.Log
import android.widget.RemoteViews
import androidx.core.content.ContextCompat

/**
 * A quiet, always-there notification with five times in a row (the next one marked), the
 * Islamic date in its header, and the next time drawn as the status bar icon: the hour on top,
 * the minutes under it.
 *
 * Six times take turns in the five places: from Isha until sunrise it shows Fajr, Shuruq, Dhuhr,
 * Asr, Maghrib (Shuruq is next between Fajr and sunrise); after sunrise the usual Fajr, Dhuhr,
 * Asr, Maghrib, Isha. Shuruq has no alarm.
 *
 * It is refreshed by [PrayerScheduler.refresh]: when the settings change, when any alarm rings,
 * after a restart, and by its own exact "tick" at every time it shows, sunrise included (so it
 * moves on even when all alarms are turned off).
 */
object NextPrayerNotification {
  private const val CHANNEL = "anyapp_next_prayer"
  private const val NOTIFICATION_ID = 7_100_001
  const val ACTION_TICK = "expo.modules.anyappalarms.PRAYER_TICK"

  private val NAME_IDS = intArrayOf(
    R.id.anyapp_prayer_name_0, R.id.anyapp_prayer_name_1, R.id.anyapp_prayer_name_2,
    R.id.anyapp_prayer_name_3, R.id.anyapp_prayer_name_4,
  )
  private val TIME_IDS = intArrayOf(
    R.id.anyapp_prayer_time_0, R.id.anyapp_prayer_time_1, R.id.anyapp_prayer_time_2,
    R.id.anyapp_prayer_time_3, R.id.anyapp_prayer_time_4,
  )

  const val SHURUQ = "Shuruq"

  /** The day shown, its five names and times, and which one is next. */
  class Shown(val day: Long, val names: List<String>, val times: LongArray, val next: Int)

  /** Pure logic, no Android: which day's row to show at [now], and the next time in it. */
  fun pick(config: PrayerPlan.Config, now: Long): Shown {
    var day = PrayerPlan.dayIndex(now)
    var prayers = PrayerPlan.userTimes(config, day)
    // After Isha: show tomorrow.
    if (prayers.none { it > now }) {
      day += 1
      prayers = PrayerPlan.userTimes(config, day)
    }
    val names = PrayerPlan.PRAYERS.map { PrayerPlan.NAMES.getValue(it) }
    val sunrise = PrayerPlan.sunriseTime(config, day)
    if (now < sunrise) {
      // Until sunrise: Fajr, Shuruq, Dhuhr, Asr, Maghrib.
      val times = longArrayOf(prayers[0], sunrise, prayers[1], prayers[2], prayers[3])
      val shown = listOf(names[0], SHURUQ, names[1], names[2], names[3])
      return Shown(day, shown, times, times.indexOfFirst { it > now })
    }
    return Shown(day, names, prayers, prayers.indexOfFirst { it > now })
  }

  /** "12" over "45" for 12:45 (12-hour without AM/PM, or 24-hour). */
  fun iconParts(at: Long, hour24: Boolean): Pair<String, String> {
    val minuteOfDay = PrayerPlan.minuteOfDay(at)
    val hours = (minuteOfDay / 60).toInt()
    val minutes = (minuteOfDay % 60).toString().padStart(2, '0')
    val hour = if (hour24) hours.toString().padStart(2, '0') else (if (hours % 12 == 0) 12 else hours % 12).toString()
    return hour to minutes
  }

  /** "5:11", "12:00" (no AM/PM, as in the row) or "05:11" for the 24-hour clock. */
  private fun shortClock(at: Long, hour24: Boolean): String {
    val (hour, minutes) = iconParts(at, hour24)
    return "$hour:$minutes"
  }

  private fun statusIcon(at: Long, hour24: Boolean): Icon {
    val (hour, minutes) = iconParts(at, hour24)
    val size = 96
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      textAlign = Paint.Align.CENTER
      typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD)
    }
    // Two lines, each as large as fits in half the square.
    fun fit(text: String): Float {
      var textSize = 54f
      paint.textSize = textSize
      while (textSize > 20f && paint.measureText(text) > size - 2) {
        textSize -= 2f
        paint.textSize = textSize
      }
      return textSize
    }
    val textSize = minOf(fit(hour), fit(minutes), fit("00"))
    paint.textSize = textSize
    val capHeight = textSize * 0.72f
    val gap = (size - 2 * capHeight) / 3f
    canvas.drawText(hour, size / 2f, gap + capHeight, paint)
    canvas.drawText(minutes, size / 2f, 2 * gap + 2 * capHeight, paint)
    return Icon.createWithBitmap(bitmap)
  }

  private fun bold(text: String, color: Int? = null): CharSequence =
    SpannableString(text).apply {
      setSpan(StyleSpan(Typeface.BOLD), 0, text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
      // The pill's text colour as a span, so a column that stops being next loses it again.
      if (color != null) setSpan(ForegroundColorSpan(color), 0, text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }

  /**
   * One row of five columns. Sizes, the pill and the spacing are fixed in the layouts (copied
   * from the notification the person liked, 13sp), so it looks the same on every refresh; the
   * time fills its column and a long name ends in "...".
   */
  private fun row(c: Context, layout: Int, shown: Shown, hour24: Boolean): RemoteViews {
    val views = RemoteViews(c.packageName, layout)
    val pillText = ContextCompat.getColor(c, R.color.anyapp_prayer_pill_text)
    for (i in 0 until 5) {
      val time = shortClock(shown.times[i], hour24)
      if (i == shown.next) {
        views.setTextViewText(NAME_IDS[i], bold(shown.names[i]))
        views.setTextViewText(TIME_IDS[i], bold(time, pillText))
        views.setInt(TIME_IDS[i], "setBackgroundResource", R.drawable.anyapp_prayer_pill)
      } else {
        views.setTextViewText(NAME_IDS[i], shown.names[i])
        views.setTextViewText(TIME_IDS[i], time)
        views.setInt(TIME_IDS[i], "setBackgroundResource", 0)
      }
    }
    return views
  }

  private fun ensureChannel(c: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = c.getSystemService(NotificationManager::class.java) ?: return
    if (nm.getNotificationChannel(CHANNEL) != null) return
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL, "Prayer times", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Today's prayer times, and the next one in the status bar"
        setSound(null, null)
        enableVibration(false)
        setShowBadge(false)
      }
    )
  }

  private fun build(c: Context, config: PrayerPlan.Config, shown: Shown): Notification {
    ensureChannel(c)
    @Suppress("DEPRECATION")
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(c, CHANNEL) else Notification.Builder(c)
    val nextAt = shown.times[shown.next]
    val nextName = shown.names[shown.next]
    val hijri = Hijri.text(shown.day, config.hijriCorrection)
    return builder
      .setSmallIcon(statusIcon(nextAt, config.hour24))
      .setContentTitle("$nextName ${PrayerPlan.clock(nextAt, config.hour24)}")
      .setStyle(Notification.DecoratedCustomViewStyle())
      .setCustomContentView(row(c, R.layout.anyapp_prayer_row, shown, config.hour24))
      .setCustomBigContentView(row(c, R.layout.anyapp_prayer_row_big, shown, config.hour24))
      .apply { if (hijri.isNotEmpty()) setSubText(hijri) }
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setContentIntent(AlarmScheduler.launchPendingIntent(c))
      .build()
  }

  private fun tickIntent(c: Context): PendingIntent {
    val intent = Intent(c, AlarmReceiver::class.java).setAction(ACTION_TICK)
    return PendingIntent.getBroadcast(c, 2, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Wakes up just after [at] to move the notification on to the next time (sunrise too). */
  private fun scheduleTick(c: Context, at: Long) {
    val am = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pending = tickIntent(c)
    val time = at + 1_000
    if (AlarmScheduler.canScheduleExact(c)) {
      am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, pending)
    } else {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, pending)
    }
  }

  fun cancel(c: Context) {
    (c.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(tickIntent(c))
    c.getSystemService(NotificationManager::class.java)?.cancel(NOTIFICATION_ID)
  }

  /** Shows (or hides) the notification for the current moment and sets the next tick. */
  fun update(c: Context, config: PrayerPlan.Config) {
    if (!config.statusBar || !config.hasPlace) {
      cancel(c)
      return
    }
    val shown = pick(config, System.currentTimeMillis())
    scheduleTick(c, shown.times[shown.next])
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) {
      return
    }
    try {
      c.getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, build(c, config, shown))
    } catch (e: Exception) {
      Log.w(AlarmScheduler.TAG, "Could not show the prayer times notification", e)
    }
  }
}
