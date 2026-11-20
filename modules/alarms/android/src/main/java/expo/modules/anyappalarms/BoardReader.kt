package expo.modules.anyappalarms

import android.content.Context
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise

/**
 * Reads the text on a photo (the mosque's prayer time board) with Google's on-device text
 * recognition: no internet, no account. Returns every line and every word with its position,
 * so src/lib/board.ts can find the times and tell which prayer each one belongs to.
 */
object BoardReader {
  fun read(c: Context, uri: String, promise: Promise) {
    val image = try {
      InputImage.fromFilePath(c, Uri.parse(uri))
    } catch (e: Exception) {
      promise.reject("ERR_BOARD_IMAGE", "Could not open the photo", e)
      return
    }
    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    recognizer.process(image)
      .addOnSuccessListener { text ->
        val words = ArrayList<Map<String, Any>>()
        val lines = ArrayList<Map<String, Any>>()
        for (block in text.textBlocks) {
          for (line in block.lines) {
            val box = line.boundingBox ?: continue
            lines.add(mapOf("text" to line.text, "left" to box.left, "top" to box.top, "right" to box.right, "bottom" to box.bottom))
            for (element in line.elements) {
              val b = element.boundingBox ?: continue
              words.add(mapOf("text" to element.text, "left" to b.left, "top" to b.top, "right" to b.right, "bottom" to b.bottom))
            }
          }
        }
        recognizer.close()
        promise.resolve(mapOf("width" to image.width, "height" to image.height, "lines" to lines, "words" to words))
      }
      .addOnFailureListener { e ->
        recognizer.close()
        promise.reject("ERR_BOARD_READ", e.message ?: "Could not read the photo", e)
      }
  }
}
