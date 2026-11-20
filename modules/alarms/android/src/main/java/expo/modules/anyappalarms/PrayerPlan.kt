package expo.modules.anyappalarms

import java.util.Calendar
import java.util.GregorianCalendar
import java.util.TimeZone
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.asin
import kotlin.math.atan
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.tan

/**
 * Prayer times for the chosen place and the alarms that go with them, worked out without the
 * app's JavaScript, so the alarms can renew themselves for ever while the app stays closed.
 *
 * The numbers must stay the same as in src/lib/prayerTimes.ts (the times shown on screen).
 * Clock times and calendar days follow the phone's own time zone (summer time included), like
 * the JavaScript side. Pure Kotlin on purpose (no Android classes), so it can be checked on a PC.
 */
object PrayerPlan {
  class Config(
    /** The chosen place in degrees (north and east positive). Null while none is chosen. */
    val latitude: Double?,
    val longitude: Double?,
    val enabled: Boolean,
    /** Minutes before each prayer for the two spoken reminders. */
    val firstMinutes: Int,
    val secondMinutes: Int,
    /** The user's own minutes for each prayer, by key ("fajr", "dhuhr", ...). */
    val adjust: Map<String, Int>,
    val hour24: Boolean,
    /** Calculation method id, as in src/lib/prayerTimes.ts METHODS. */
    val method: String = "uae",
    /** Hanafi Asr (shadow twice the length) instead of the standard one. */
    val hanafiAsr: Boolean = false,
    /** The adhan recording (a file in res/raw, copied from assets/sounds). */
    val sound: String = "adhan",
    /** Where the short adhan stops (ms), or 0 for the whole adhan. */
    val soundEndMs: Long = 0,
    /** Days to move the Islamic date by. */
    val hijriCorrection: Int = 0,
    /** Show the quiet notification with the times and the next prayer in the status bar. */
    val statusBar: Boolean = true,
    /** Per prayer key: false means no reminders and no adhan for it. Missing means on. */
    val prayerOn: Map<String, Boolean> = emptyMap(),
  ) {
    /** Without a place there are no times: no alarms and no notification. */
    val hasPlace: Boolean get() = latitude != null && longitude != null
  }

  /** One calculation method. Must match METHODS in src/lib/prayerTimes.ts. */
  class Method(
    val fajrAngle: Double,
    /** Null when Isha is a fixed number of minutes after Maghrib. */
    val ishaAngle: Double?,
    val ishaAfterMaghrib: Int,
    val sunriseAngle: Double,
    val sunsetAngle: Double,
    /** Minutes added after rounding: fajr, sunrise, dhuhr, asr, maghrib, isha. */
    val added: IntArray,
  )

  private val NONE = intArrayOf(0, 0, 0, 0, 0, 0)
  private fun standard(fajr: Double, isha: Double?) =
    Method(fajr, isha, if (isha == null) 90 else 0, 0.833, 0.833, NONE)

  val METHODS: Map<String, Method> = mapOf(
    "uae" to Method(18.18, 18.0, 0, 0.89, 1.15, intArrayOf(0, -3, 2, 0, 1, 0)),
    "karachi" to standard(18.0, 18.0),
    "mwl" to standard(18.0, 17.0),
    "ummalqura" to standard(18.5, null),
    "egypt" to standard(19.5, 17.5),
    "gulf" to standard(19.5, null),
    "kuwait" to standard(18.0, 17.5),
    "qatar" to standard(18.0, null),
    "isna" to standard(15.0, 15.0),
  )

  class Planned(
    val id: String,
    val at: Long,
    val title: String,
    val body: String,
    val speak: String?,
    val language: String?,
    val sound: String?,
    val soundEndMs: Long? = null,
  )

  /** How many days of alarms are kept waiting. They are topped up every time one rings. */
  const val DAYS_AHEAD = 7

  val PRAYERS = listOf("fajr", "dhuhr", "asr", "maghrib", "isha")
  val NAMES = mapOf(
    "fajr" to "Fajr",
    "dhuhr" to "Dhuhr",
    "asr" to "Asr",
    "maghrib" to "Maghrib",
    "isha" to "Isha",
  )

  const val DAY_MS = 86_400_000L

  private const val SPEECH_LANGUAGE = "en-US"

  private const val RAD = Math.PI / 180.0
  private fun sinD(deg: Double) = sin(deg * RAD)
  private fun cosD(deg: Double) = cos(deg * RAD)
  private fun tanD(deg: Double) = tan(deg * RAD)
  private fun turn(deg: Double) = ((deg % 360.0) + 360.0) % 360.0

  /** The sun's declination (degrees) and the equation of time (minutes) at a Julian day. */
  private fun sunPosition(jd: Double): DoubleArray {
    val t = (jd - 2451545.0) / 36525.0
    val meanLongitude = turn(280.46646 + t * (36000.76983 + 0.0003032 * t))
    val meanAnomaly = turn(357.52911 + t * (35999.05029 - 0.0001537 * t))
    val eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
    val centre =
      sinD(meanAnomaly) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
        sinD(2 * meanAnomaly) * (0.019993 - 0.000101 * t) +
        sinD(3 * meanAnomaly) * 0.000289
    val omega = 125.04 - 1934.136 * t
    val longitude = meanLongitude + centre - 0.00569 - 0.00478 * sinD(omega)
    val obliquity =
      23.0 + (26.0 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60.0) / 60.0 + 0.00256 * cosD(omega)
    val declination = asin(sinD(obliquity) * sinD(longitude)) / RAD
    val y = tanD(obliquity / 2) * tanD(obliquity / 2)
    val equationOfTime =
      (4 *
        (y * sinD(2 * meanLongitude) -
          2 * eccentricity * sinD(meanAnomaly) +
          4 * eccentricity * y * sinD(meanAnomaly) * cosD(2 * meanLongitude) -
          0.5 * y * y * sinD(4 * meanLongitude) -
          1.25 * eccentricity * eccentricity * sinD(2 * meanAnomaly))) /
        RAD
    return doubleArrayOf(declination, equationOfTime)
  }

  /** Milliseconds the phone's clock is ahead of UTC at a moment (summer time included). */
  fun offsetMs(at: Long): Long = TimeZone.getDefault().getOffset(at).toLong()

  /** The number of the phone's calendar day (days since 1 January 1970) at a moment. */
  fun dayIndex(at: Long): Long = Math.floorDiv(at + offsetMs(at), DAY_MS)

  /**
   * Minutes the phone's clock is ahead of UTC on a calendar day, taken at its local noon (the
   * same as `utcOffsetMinutes` in src/lib/prayerTimes.ts).
   */
  fun offsetMinutes(day: Long): Double {
    val noonUtc = day * DAY_MS + DAY_MS / 2
    val noon = noonUtc - offsetMs(noonUtc)
    return (offsetMs(noon) / 60_000L).toDouble()
  }

  /** One calendar day at one place: the Julian day at its 00:00 UTC and the clock's offset. */
  private class Sky(val day: Long, val latitude: Double, val longitude: Double) {
    val jd0 = day + 2440587.5
    val offset = offsetMinutes(day)
  }

  /** The sun at [minutes] after local midnight. */
  private fun sunAt(sky: Sky, minutes: Double) = sunPosition(sky.jd0 + (minutes - sky.offset) / 1440.0)

  /** Minutes after local midnight when the sun reaches an altitude, before (-1) or after (+1) noon. */
  private fun whenAt(sky: Sky, side: Int, guess: Double, altitude: (declination: Double) -> Double): Double {
    var minutes = guess
    repeat(4) {
      val sun = sunAt(sky, minutes)
      val target = altitude(sun[0])
      val cosHour = (sinD(target) - sinD(sky.latitude) * sinD(sun[0])) / (cosD(sky.latitude) * cosD(sun[0]))
      val hourAngle = acos(cosHour.coerceIn(-1.0, 1.0)) / RAD
      minutes = 720.0 - 4 * sky.longitude - sun[1] + sky.offset + side * 4 * hourAngle
    }
    return minutes
  }

  private fun stamp(sky: Sky, minutes: Double, added: Int) =
    sky.day * DAY_MS - Math.round(sky.offset * 60_000.0) + (Math.round(minutes) + added) * 60_000L

  /**
   * The prayer times of one calendar day at a place as timestamps in milliseconds, in the order
   * of [PRAYERS], by a calculation method and before the user's own adjustments.
   */
  fun officialTimes(
    day: Long,
    latitude: Double,
    longitude: Double,
    methodId: String = "uae",
    hanafiAsr: Boolean = false,
  ): LongArray {
    val method = METHODS[methodId] ?: METHODS.getValue("uae")
    val shadow = if (hanafiAsr) 2.0 else 1.0
    val sky = Sky(day, latitude, longitude)

    var noon = 720.0
    repeat(3) { noon = 720.0 - 4 * longitude - sunAt(sky, noon)[1] + sky.offset }

    val fajr = whenAt(sky, -1, 300.0) { -method.fajrAngle }
    val asr = whenAt(sky, 1, 960.0) { declination -> atan(1.0 / (shadow + tanD(abs(latitude - declination)))) / RAD }
    val maghrib = whenAt(sky, 1, 1080.0) { -method.sunsetAngle }

    val maghribAt = stamp(sky, maghrib, method.added[4])
    val ishaAngle = method.ishaAngle
    val ishaAt = if (ishaAngle == null) {
      maghribAt + (method.ishaAfterMaghrib + method.added[5]) * 60_000L
    } else {
      stamp(sky, whenAt(sky, 1, 1140.0) { -ishaAngle }, method.added[5])
    }
    return longArrayOf(
      stamp(sky, fajr, method.added[0]),
      stamp(sky, noon, method.added[2]),
      stamp(sky, asr, method.added[3]),
      maghribAt,
      ishaAt,
    )
  }

  /**
   * Sunrise (Shuruq) of one calendar day at a place, the same as `sunrise` in
   * src/lib/prayerTimes.ts. No alarm goes with it and the user's own minutes do not apply to it.
   */
  fun sunriseTime(day: Long, latitude: Double, longitude: Double, methodId: String = "uae"): Long {
    val method = METHODS[methodId] ?: METHODS.getValue("uae")
    val sky = Sky(day, latitude, longitude)
    return stamp(sky, whenAt(sky, -1, 360.0) { -method.sunriseAngle }, method.added[1])
  }

  /** Sunrise for the place in the settings (which must have one, see [Config.hasPlace]). */
  fun sunriseTime(config: Config, day: Long): Long =
    sunriseTime(day, checkNotNull(config.latitude), checkNotNull(config.longitude), config.method)

  /** "20261110": the date part of alarm ids. */
  private fun dayKey(day: Long): String {
    val cal = GregorianCalendar(TimeZone.getTimeZone("UTC"))
    cal.timeInMillis = day * DAY_MS
    val month = (cal.get(Calendar.MONTH) + 1).toString().padStart(2, '0')
    val date = cal.get(Calendar.DAY_OF_MONTH).toString().padStart(2, '0')
    return "${cal.get(Calendar.YEAR)}$month$date"
  }

  /**
   * The day's times with the user's own minutes added, in the order of [PRAYERS]. Only for
   * settings with a place ([Config.hasPlace]).
   */
  fun userTimes(config: Config, day: Long): LongArray {
    val latitude = checkNotNull(config.latitude) { "No place chosen" }
    val longitude = checkNotNull(config.longitude) { "No place chosen" }
    val times = officialTimes(day, latitude, longitude, config.method, config.hanafiAsr)
    PRAYERS.forEachIndexed { i, prayer -> times[i] += (config.adjust[prayer] ?: 0) * 60_000L }
    return times
  }

  /** Minutes after midnight on the phone's clock at a moment. */
  fun minuteOfDay(at: Long): Long = Math.floorMod(at + offsetMs(at), DAY_MS) / 60_000L

  /** "5:13 AM" or "05:13", on the phone's clock. */
  fun clock(at: Long, hour24: Boolean): String {
    val minuteOfDay = minuteOfDay(at)
    val hours = (minuteOfDay / 60).toInt()
    val minutes = (minuteOfDay % 60).toString().padStart(2, '0')
    if (hour24) return "${hours.toString().padStart(2, '0')}:$minutes"
    val hour12 = if (hours % 12 == 0) 12 else hours % 12
    return "$hour12:$minutes ${if (hours < 12) "AM" else "PM"}"
  }

  private fun minutesWords(count: Int) = if (count == 1) "1 minute" else "$count minutes"

  /** Every prayer alarm that should be waiting on the phone at [now], soonest first. */
  fun plan(config: Config, now: Long): List<Planned> {
    if (!config.enabled || !config.hasPlace) return emptyList()
    val plan = ArrayList<Planned>()
    val today = dayIndex(now)
    val soonest = now + 2_000
    // If both reminders are set to the same number of minutes, speak only once.
    val before = listOf(config.firstMinutes, config.secondMinutes).distinct()

    for (i in 0 until DAYS_AHEAD) {
      val day = today + i
      val key = dayKey(day)
      val times = userTimes(config, day)
      PRAYERS.forEachIndexed { index, prayer ->
        // A prayer switched off gets nothing: no spoken reminders and no adhan.
        if (config.prayerOn[prayer] == false) return@forEachIndexed
        val name = NAMES.getValue(prayer)
        val at = times[index]
        before.forEachIndexed { n, minutes ->
          val alarmAt = at - minutes * 60_000L
          if (alarmAt > soonest) {
            plan.add(
              Planned(
                id = "p-$key-$prayer-${n + 1}",
                at = alarmAt,
                title = "$name in ${minutesWords(minutes)}",
                body = "$name is at ${clock(at, config.hour24)}.",
                speak = "$name prayer is in ${minutesWords(minutes)}.",
                language = SPEECH_LANGUAGE,
                sound = null,
              )
            )
          }
        }
        if (at > soonest) {
          plan.add(
            Planned(
              id = "p-$key-$prayer-adhan",
              at = at,
              title = name,
              body = "It is time for $name prayer.",
              speak = null,
              language = null,
              sound = config.sound,
              soundEndMs = config.soundEndMs.takeIf { it > 0 },
            )
          )
        }
      }
    }
    plan.sortBy { it.at }
    return plan
  }
}
