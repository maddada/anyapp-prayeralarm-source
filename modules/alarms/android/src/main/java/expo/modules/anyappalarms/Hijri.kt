package expo.modules.anyappalarms

/**
 * The Islamic (Umm al-Qura) date, for the notification header. The same table and rules as
 * src/lib/hijri.ts: keep them in step. Pure Kotlin, so it can be checked on a PC.
 */
object Hijri {
  /** 1 Muharram 1447 was 26 June 2025: day 20265 counted from 1 January 1970. */
  private const val FIRST_DAY = 20265L
  private const val FIRST_YEAR = 1447
  private const val MONTH_COUNT = 1848

  // Length of every month from Muharram 1447 to the end of 1600: 1 = 30 days, 0 = 29 days.
  private const val MONTH_LENGTHS =
    "baa5b52b6a56e4db25b52b6a5ad2ae92f49764b6a56acad655d49da4dd16d955aa5b52da95b4ad5956ca6e4aea4f52b6" +
    "956aaab54bd25d92ea96d4ada95b4aba55b29b54d6a97547693749b5556aa6b52ba8bd46da35caad64db26b94baa5b52" +
    "b695751768b725b52b5655b49da4ed16d8b6aa6d52da95d4ada95b4ab653729762ba95b2ab5555b25d92ec96d2ae956b" +
    "4aba55d29d54daa9b54baa3b49ba4daaaad52da95d45ea2ec9ad556b26b94baa5d52da95b52ba8bb45b92da95ab4ada4" +
    "ed16e8b6a56d535695d4ada8dd46da55b29d62bb15b4ab955aaaae92ec8f5276956aaad655d29d"

  private val MONTH_NAMES = arrayOf(
    "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Awwal", "Jumada al-Thani",
    "Rajab", "Shaban", "Ramadan", "Shawwal", "Dhu al-Qadah", "Dhu al-Hijjah",
  )

  private fun monthLength(index: Int): Int {
    val digit = Character.digit(MONTH_LENGTHS[index shr 2], 16)
    return if ((digit shr (3 - (index and 3))) and 1 == 1) 30 else 29
  }

  /** "30 Jumada al-Awwal 1448" for a calendar day number (days since 1 January 1970), or "" outside the table. */
  fun text(day: Long, correctionDays: Int = 0): String {
    var days = day + correctionDays - FIRST_DAY
    if (days < 0) return ""
    for (index in 0 until MONTH_COUNT) {
      val length = monthLength(index)
      if (days < length) {
        return "${days + 1} ${MONTH_NAMES[index % 12]} ${FIRST_YEAR + index / 12}"
      }
      days -= length
    }
    return ""
  }
}
