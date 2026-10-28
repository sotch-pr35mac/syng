package xyz.bytecraft.syng

import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.core.graphics.Insets
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override val handleBackNavigation: Boolean = true
  override fun onCreate(savedInstanceState: Bundle?) {
    installSplashScreen()
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    val contentView = findViewById<View>(android.R.id.content)
    val initialPaddingLeft = contentView.paddingLeft
    val initialPaddingTop = contentView.paddingTop
    val initialPaddingRight = contentView.paddingRight
    val initialPaddingBottom = contentView.paddingBottom
    ViewCompat.setOnApplyWindowInsetsListener(contentView) { view, windowInsets ->
      val handledTypes = WindowInsetsCompat.Type.systemBars() or
        WindowInsetsCompat.Type.displayCutout()
      val safeArea = windowInsets.getInsets(handledTypes)
      view.setPadding(
        initialPaddingLeft + safeArea.left,
        initialPaddingTop + safeArea.top,
        initialPaddingRight + safeArea.right,
        initialPaddingBottom + safeArea.bottom,
      )
      // The WebView must still receive inset changes, but not the dimensions
      // already handled by its parent. Leave IME insets for viewport resizing.
      WindowInsetsCompat.Builder(windowInsets)
        .setInsets(handledTypes, Insets.NONE)
        .build()
    }
    ViewCompat.requestApplyInsets(contentView)
  }
}
