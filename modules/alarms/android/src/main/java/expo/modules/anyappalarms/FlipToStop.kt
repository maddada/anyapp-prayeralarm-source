package expo.modules.anyappalarms

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.util.Log
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * Turning the phone face down stops the alarm. Listens to the gravity sensor (or the
 * accelerometer on phones without one) only while AlarmService plays, so it costs no battery
 * otherwise. A flip counts only when the phone was not already face down when the sound
 * started (or was picked up since), and then lies face down and steady for [STEADY_MS].
 */
internal class FlipToStop(context: Context, private val handler: Handler, private val onFlip: () -> Unit) :
  SensorEventListener {
  private val sensors = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
  private var listening = false
  private var gravitySensor = false
  private var seen = false
  private var armed = false
  private var z = 0f
  private var downSince = 0L

  fun start() {
    if (listening) return
    val sm = sensors ?: return
    val sensor = sm.getDefaultSensor(Sensor.TYPE_GRAVITY) ?: sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    if (sensor == null) {
      Log.i(AlarmScheduler.TAG, "No motion sensor: flip to stop is not available")
      return
    }
    gravitySensor = sensor.type == Sensor.TYPE_GRAVITY
    seen = false
    armed = false
    downSince = 0L
    listening = sm.registerListener(this, sensor, SAMPLE_US, handler)
  }

  fun stop() {
    if (!listening) return
    listening = false
    runCatching { sensors?.unregisterListener(this) }
  }

  override fun onSensorChanged(event: SensorEvent) {
    if (!listening || event.values.size < 3) return
    val x = event.values[0]
    val y = event.values[1]
    val rawZ = event.values[2]
    // The accelerometer also feels the hand moving: smooth it, and only trust readings close to
    // plain gravity. The gravity sensor already does this.
    z = if (!seen || gravitySensor) rawZ else z + SMOOTHING * (rawZ - z)
    val still = gravitySensor || abs(sqrt(x * x + y * y + rawZ * rawZ) - SensorManager.GRAVITY_EARTH) < 2f
    val faceDown = z < FACE_DOWN_Z && still
    val now = event.timestamp / 1_000_000L
    if (!seen) {
      seen = true
      armed = !faceDown
      return
    }
    if (!armed) {
      // It was lying face down when the sound started: wait until it is picked up.
      if (z > ARM_Z) armed = true
      return
    }
    if (!faceDown) {
      downSince = 0L
      return
    }
    if (downSince == 0L) downSince = now
    if (now - downSince >= STEADY_MS) {
      stop()
      onFlip()
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  companion object {
    private const val SAMPLE_US = 50_000
    private const val SMOOTHING = 0.3f
    /** Face down: the screen points at the floor (gravity on -z), within about 35 degrees. */
    private const val FACE_DOWN_Z = -8f
    /** Clearly not face down any more (picked up or turned over). */
    private const val ARM_Z = -5f
    private const val STEADY_MS = 500L
  }
}
