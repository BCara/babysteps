const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');

const WIDGET_RECEIVER = '.QuickCareWidgetProvider';
const PIN_RESULT_RECEIVER = '.QuickCareWidgetPinResultReceiver';
const CONFIGURE_ACTIVITY = '.QuickCareWidgetConfigureActivity';
const ACTIVITY_WIDGETS = [
  { className: 'NursingWidgetProvider', label: 'Nursing', action: 'nursing', resourceName: 'nursing', color: '#FFB5A7' },
  { className: 'BottleWidgetProvider', label: 'Bottle', action: 'bottle', resourceName: 'bottle', color: '#FFB5A7' },
  { className: 'SleepWidgetProvider', label: 'Sleep', action: 'sleep', resourceName: 'sleep', color: '#A9DEF9' },
  { className: 'NappyWidgetProvider', label: 'Nappy', action: 'diaper', resourceName: 'diaper', color: '#D3F8E2' },
  { className: 'PumpingWidgetProvider', label: 'Pumping', action: 'pumping', resourceName: 'pumping', color: '#BDE5D6' },
  { className: 'SolidsWidgetProvider', label: 'Solids', action: 'solids', resourceName: 'solids', color: '#FFE0A8' },
  { className: 'PottyWidgetProvider', label: 'Potty', action: 'potty', resourceName: 'potty', color: '#CDECCF' },
  { className: 'TummyTimeWidgetProvider', label: 'Tummy time', action: 'tummyTime', resourceName: 'tummy_time', color: '#FDE2E4' },
  { className: 'BathWidgetProvider', label: 'Bath', action: 'bath', resourceName: 'bath', color: '#D8E8FF' },
  { className: 'GrowthWidgetProvider', label: 'Growth', action: 'growth', resourceName: 'growth', color: '#D8D4FF' },
  { className: 'MilestoneWidgetProvider', label: 'Milestone', action: 'milestone', resourceName: 'milestone', color: '#FFF1B8' },
  { className: 'TeethingWidgetProvider', label: 'Teething', action: 'teething', resourceName: 'teething', color: '#E9E0F7' },
  { className: 'TemperatureWidgetProvider', label: 'Temperature', action: 'temperature', resourceName: 'temperature', color: '#FFD1C7' },
  { className: 'MedicationWidgetProvider', label: 'Medicine', action: 'medication', resourceName: 'medication', color: '#FFE5D9' },
  { className: 'SymptomWidgetProvider', label: 'Observation', action: 'symptom', resourceName: 'symptom', color: '#F3D5E5' },
  { className: 'AppointmentWidgetProvider', label: 'Appointment', action: 'appointment', resourceName: 'appointment', color: '#D5E8F5' },
  { className: 'ImmunizationWidgetProvider', label: 'Immunisation', action: 'immunization', resourceName: 'immunization', color: '#D7E9DF' },
];

const widgetLayout = `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/quick_care_widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/quick_care_widget_background"
    android:padding="6dp">

    <LinearLayout
        android:id="@+id/quick_care_group"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="vertical">

        <LinearLayout
            android:id="@+id/quick_care_row_one"
            android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="1"
            android:orientation="horizontal">

            <LinearLayout
                android:id="@+id/quick_care_action_one"
                android:layout_width="0dp"
                android:layout_height="match_parent"
                android:layout_weight="1"
                android:gravity="center_vertical"
                android:orientation="vertical"
                android:padding="5dp">
                <TextView android:id="@+id/quick_care_action_one_title" android:layout_width="match_parent" android:layout_height="wrap_content" android:maxLines="1" android:ellipsize="end" android:text="Nursing" android:textColor="#302C3B" android:textSize="13sp" android:textStyle="bold" />
                <TextView android:id="@+id/quick_care_action_one_summary" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:maxLines="1" android:text="Tap to log" android:textColor="#554F60" android:textSize="11sp" />
                <Chronometer android:id="@+id/quick_care_action_one_timer" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:maxLines="1" android:textColor="#554F60" android:textSize="11sp" android:textStyle="bold" android:visibility="gone" />
            </LinearLayout>

            <LinearLayout
                android:id="@+id/quick_care_action_two"
                android:layout_width="0dp"
                android:layout_height="match_parent"
                android:layout_marginStart="7dp"
                android:layout_weight="1"
                android:gravity="center_vertical"
                android:orientation="vertical"
                android:padding="5dp">
                <TextView android:id="@+id/quick_care_action_two_title" android:layout_width="match_parent" android:layout_height="wrap_content" android:maxLines="1" android:ellipsize="end" android:text="Bottle" android:textColor="#302C3B" android:textSize="13sp" android:textStyle="bold" />
                <TextView android:id="@+id/quick_care_action_two_summary" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:maxLines="1" android:text="Tap to log" android:textColor="#554F60" android:textSize="11sp" />
                <Chronometer android:id="@+id/quick_care_action_two_timer" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:maxLines="1" android:textColor="#554F60" android:textSize="11sp" android:textStyle="bold" android:visibility="gone" />
            </LinearLayout>

            <LinearLayout
                android:id="@+id/quick_care_action_three_wide"
                android:layout_width="0dp"
                android:layout_height="match_parent"
                android:layout_marginStart="7dp"
                android:layout_weight="1"
                android:gravity="center_vertical"
                android:orientation="vertical"
                android:padding="5dp"
                android:visibility="gone">
                <TextView android:id="@+id/quick_care_action_three_wide_title" android:layout_width="match_parent" android:layout_height="wrap_content" android:maxLines="1" android:text="Sleep" android:textColor="#302C3B" android:textSize="13sp" android:textStyle="bold" />
                <TextView android:id="@+id/quick_care_action_three_wide_summary" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:maxLines="1" android:text="Tap to log" android:textColor="#554F60" android:textSize="11sp" />
                <Chronometer android:id="@+id/quick_care_action_three_wide_timer" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:maxLines="1" android:textColor="#554F60" android:textSize="11sp" android:textStyle="bold" android:visibility="gone" />
            </LinearLayout>
        </LinearLayout>

        <LinearLayout
            android:id="@+id/quick_care_row_two"
            android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_marginTop="7dp"
            android:layout_weight="1"
            android:orientation="horizontal">

            <LinearLayout
                android:id="@+id/quick_care_action_three"
                android:layout_width="0dp"
                android:layout_height="match_parent"
                android:layout_weight="1"
                android:gravity="center_vertical"
                android:orientation="vertical"
                android:padding="5dp">
                <TextView android:id="@+id/quick_care_action_three_title" android:layout_width="match_parent" android:layout_height="wrap_content" android:maxLines="1" android:ellipsize="end" android:text="Sleep" android:textColor="#302C3B" android:textSize="13sp" android:textStyle="bold" />
                <TextView android:id="@+id/quick_care_action_three_summary" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:maxLines="1" android:text="Tap to log" android:textColor="#554F60" android:textSize="11sp" />
                <Chronometer android:id="@+id/quick_care_action_three_timer" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:maxLines="1" android:textColor="#554F60" android:textSize="11sp" android:textStyle="bold" android:visibility="gone" />
            </LinearLayout>

            <LinearLayout
                android:id="@+id/quick_care_action_four"
                android:layout_width="0dp"
                android:layout_height="match_parent"
                android:layout_marginStart="7dp"
                android:layout_weight="1"
                android:gravity="center_vertical"
                android:orientation="vertical"
                android:padding="5dp">
                <TextView android:id="@+id/quick_care_action_four_title" android:layout_width="match_parent" android:layout_height="wrap_content" android:maxLines="1" android:ellipsize="end" android:text="Nappy" android:textColor="#302C3B" android:textSize="13sp" android:textStyle="bold" />
                <TextView android:id="@+id/quick_care_action_four_summary" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:maxLines="1" android:text="Tap to log" android:textColor="#554F60" android:textSize="11sp" />
                <Chronometer android:id="@+id/quick_care_action_four_timer" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:maxLines="1" android:textColor="#554F60" android:textSize="11sp" android:textStyle="bold" android:visibility="gone" />
            </LinearLayout>
        </LinearLayout>
    </LinearLayout>

    <LinearLayout
        android:id="@+id/quick_care_single"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:gravity="center_vertical"
        android:orientation="vertical"
        android:padding="2dp"
        android:visibility="gone">

        <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:gravity="center_vertical" android:orientation="horizontal">
            <TextView android:id="@+id/quick_care_single_title" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:maxLines="1" android:textColor="#302C3B" android:textSize="16sp" android:textStyle="bold" />
            <TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="PitterPatter" android:textColor="#6E6878" android:textSize="10sp" />
        </LinearLayout>

        <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="3dp" android:gravity="center_vertical" android:orientation="horizontal">
            <TextView android:id="@+id/quick_care_single_summary" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:maxLines="1" android:textColor="#302C3B" android:textSize="13sp" android:textStyle="bold" />
            <Chronometer android:id="@+id/quick_care_single_timer" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#302C3B" android:textSize="17sp" android:textStyle="bold" android:visibility="gone" />
        </LinearLayout>

        <TextView android:id="@+id/quick_care_single_detail" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:maxLines="1" android:textColor="#554F60" android:textSize="11sp" />

        <LinearLayout android:id="@+id/quick_care_nursing_stats" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="5dp" android:orientation="horizontal" android:visibility="gone">
            <TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="L " android:textColor="#302C3B" android:textSize="11sp" android:textStyle="bold" />
            <TextView android:id="@+id/quick_care_left_value" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:text="00:00" android:textColor="#302C3B" android:textSize="13sp" android:textStyle="bold" />
            <Chronometer android:id="@+id/quick_care_left_timer" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:textColor="#302C3B" android:textSize="13sp" android:textStyle="bold" android:visibility="gone" />
            <TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="R " android:textColor="#302C3B" android:textSize="11sp" android:textStyle="bold" />
            <TextView android:id="@+id/quick_care_right_value" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:text="00:00" android:textColor="#302C3B" android:textSize="13sp" android:textStyle="bold" />
            <Chronometer android:id="@+id/quick_care_right_timer" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:textColor="#302C3B" android:textSize="13sp" android:textStyle="bold" android:visibility="gone" />
        </LinearLayout>

        <LinearLayout android:id="@+id/quick_care_single_actions" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="7dp" android:orientation="horizontal">
            <TextView android:id="@+id/quick_care_single_action_one" android:layout_width="0dp" android:layout_height="40dp" android:layout_weight="1" android:background="@drawable/quick_care_widget_button_background" android:gravity="center" android:textColor="#302C3B" android:textSize="12sp" android:textStyle="bold" />
            <TextView android:id="@+id/quick_care_single_action_two" android:layout_width="0dp" android:layout_height="40dp" android:layout_marginStart="6dp" android:layout_weight="1" android:background="@drawable/quick_care_widget_button_background" android:gravity="center" android:textColor="#302C3B" android:textSize="12sp" android:textStyle="bold" />
            <TextView android:id="@+id/quick_care_single_action_three" android:layout_width="0dp" android:layout_height="40dp" android:layout_marginStart="6dp" android:layout_weight="1" android:background="@drawable/quick_care_widget_button_background" android:gravity="center" android:textColor="#302C3B" android:textSize="12sp" android:textStyle="bold" />
        </LinearLayout>
    </LinearLayout>
</FrameLayout>
`;

const widgetInfo = packageName => `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:configure="${packageName}.QuickCareWidgetConfigureActivity"
    android:initialLayout="@layout/quick_care_widget"
    android:previewLayout="@layout/quick_care_widget"
    android:minWidth="110dp"
    android:minHeight="80dp"
    android:minResizeWidth="110dp"
    android:minResizeHeight="80dp"
    android:resizeMode="horizontal|vertical"
    android:targetCellWidth="4"
    android:targetCellHeight="2"
    android:updatePeriodMillis="1800000"
    android:widgetCategory="home_screen"
    android:widgetFeatures="reconfigurable" />
`;

const roundedBackground = (color, radius = 20) => `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="${color}" />
    <corners android:radius="${radius}dp" />
</shape>
`;

const widgetModelsSource = (packageName, widgets) => `package ${packageName}

data class WidgetAction(
  val key: String,
  val label: String,
  val backgroundResource: Int,
  val color: String,
)

data class WidgetSnapshot(
  val key: String,
  val label: String,
  val summary: String,
  val detail: String?,
  val active: Boolean,
  val lastEventAtMs: Long?,
  val timerStartedAtMs: Long?,
  val leftSeconds: Long?,
  val rightSeconds: Long?,
  val activeSide: String?,
)

object WidgetActions {
  val supported = linkedMapOf(
${widgets.map(widget => `    "${widget.action}" to WidgetAction("${widget.action}", "${widget.label}", R.drawable.quick_care_${widget.resourceName}_background, "${widget.color}"),`).join('\n')}
  )

  val defaultDashboardKeys = listOf("nursing", "bottle", "sleep", "diaper")

  fun sanitize(keys: List<String>): List<String> {
    val unique = keys.filter { supported.containsKey(it) }.distinct().take(4)
    return if (unique.isEmpty()) defaultDashboardKeys else unique
  }

  fun validKind(kind: String) = kind == "dashboard" || supported.containsKey(kind)
}
`;

const widgetPreferencesSource = packageName => `package ${packageName}

import android.content.Context
import org.json.JSONArray

object WidgetPreferences {
  private const val FILE_NAME = "pitterpatter_widgets"
  private const val DASHBOARD_ACTIONS = "dashboard_actions"
  private const val WATCH_ACTIONS = "watch_actions"
  private const val WIDGET_KIND_PREFIX = "widget_kind_"
  private const val SNAPSHOTS = "widget_snapshots"

  private fun preferences(context: Context) =
    context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)

  fun dashboardActions(context: Context): List<String> {
    val stored = preferences(context).getString(DASHBOARD_ACTIONS, null)
    return WidgetActions.sanitize(stored?.split(",") ?: emptyList())
  }

  fun setDashboardActions(context: Context, actions: List<String>) {
    preferences(context).edit()
      .putString(DASHBOARD_ACTIONS, WidgetActions.sanitize(actions).joinToString(","))
      .apply()
  }

  fun watchActions(context: Context): List<String> {
    val stored = preferences(context).getString(WATCH_ACTIONS, null)
    val supported = setOf("nursing", "bottle", "sleep", "diaper")
    val result = stored?.split(",")?.filter(supported::contains)?.distinct()?.take(4).orEmpty()
    return if (result.isEmpty()) listOf("nursing", "bottle", "sleep", "diaper") else result
  }

  fun setWatchActions(context: Context, actions: List<String>) {
    val supported = setOf("nursing", "bottle", "sleep", "diaper")
    val result = actions.filter(supported::contains).distinct().take(4)
    preferences(context).edit()
      .putString(WATCH_ACTIONS, (if (result.isEmpty()) listOf("nursing") else result).joinToString(","))
      .apply()
  }

  fun storedWidgetKind(context: Context, widgetId: Int): String? =
    preferences(context).getString("$WIDGET_KIND_PREFIX$widgetId", null)

  fun widgetKind(context: Context, widgetId: Int): String =
    storedWidgetKind(context, widgetId)?.takeIf(WidgetActions::validKind) ?: "dashboard"

  fun setWidgetKind(context: Context, widgetId: Int, kind: String) {
    if (!WidgetActions.validKind(kind)) return
    preferences(context).edit().putString("$WIDGET_KIND_PREFIX$widgetId", kind).apply()
  }

  fun removeWidget(context: Context, widgetId: Int) {
    preferences(context).edit().remove("$WIDGET_KIND_PREFIX$widgetId").apply()
  }

  fun setSnapshots(context: Context, snapshots: String) {
    preferences(context).edit().putString(SNAPSHOTS, snapshots).apply()
  }

  fun snapshotsJson(context: Context): String =
    preferences(context).getString(SNAPSHOTS, "[]") ?: "[]"

  fun snapshots(context: Context): Map<String, WidgetSnapshot> {
    val raw = preferences(context).getString(SNAPSHOTS, "[]") ?: "[]"
    return runCatching {
      val array = JSONArray(raw)
      buildMap {
        for (index in 0 until array.length()) {
          val item = array.getJSONObject(index)
          val key = item.optString("key")
          if (!WidgetActions.supported.containsKey(key)) continue
          put(key, WidgetSnapshot(
            key = key,
            label = item.optString("label", WidgetActions.supported.getValue(key).label),
            summary = item.optString("summary", "Open PitterPatter to sync"),
            detail = item.optString("detail").takeIf(String::isNotBlank),
            active = item.optBoolean("active", false),
            lastEventAtMs = item.optLong("lastEventAtMs").takeIf { item.has("lastEventAtMs") },
            timerStartedAtMs = item.optLong("timerStartedAtMs").takeIf { item.has("timerStartedAtMs") },
            leftSeconds = item.optDouble("leftSeconds").takeIf { item.has("leftSeconds") }?.toLong(),
            rightSeconds = item.optDouble("rightSeconds").takeIf { item.has("rightSeconds") }?.toLong(),
            activeSide = item.optString("activeSide").takeIf(String::isNotBlank),
          ))
        }
      }
    }.getOrDefault(emptyMap())
  }
}
`;

const widgetIntentSource = (packageName, scheme) => `package ${packageName}

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri

object WidgetIntents {
  fun quickCare(
    context: Context,
    action: String,
    requestCode: Int,
    choice: String? = null,
  ): PendingIntent {
    val uri = if (action == "home") {
      Uri.parse("${scheme}://")
    } else {
      Uri.Builder()
        .scheme("${scheme}")
        .authority("quick-care")
        .appendQueryParameter("action", action)
        .apply { if (choice != null) appendQueryParameter("choice", choice) }
        .build()
    }
    val intent = Intent(Intent.ACTION_VIEW, uri, context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    return PendingIntent.getActivity(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
`;

const widgetProviderSource = packageName => `package ${packageName}

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews

class QuickCareWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, widgetIds: IntArray) {
    updateWidgets(context, manager, widgetIds)
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    manager: AppWidgetManager,
    widgetId: Int,
    newOptions: Bundle,
  ) {
    updateWidget(context, manager, widgetId)
  }

  override fun onDeleted(context: Context, widgetIds: IntArray) {
    widgetIds.forEach { WidgetPreferences.removeWidget(context, it) }
  }

  companion object {
    private const val THREE_COLUMN_MIN_WIDTH_DP = 300
    private const val GROUP_PADDING_DP = 6
    private const val ROW_GAP_DP = 7

    private data class GroupViewIds(
      val container: Int,
      val title: Int,
      val summary: Int,
      val timer: Int,
    )

    private val compactGroupViews = listOf(
      GroupViewIds(R.id.quick_care_action_one, R.id.quick_care_action_one_title, R.id.quick_care_action_one_summary, R.id.quick_care_action_one_timer),
      GroupViewIds(R.id.quick_care_action_two, R.id.quick_care_action_two_title, R.id.quick_care_action_two_summary, R.id.quick_care_action_two_timer),
      GroupViewIds(R.id.quick_care_action_three, R.id.quick_care_action_three_title, R.id.quick_care_action_three_summary, R.id.quick_care_action_three_timer),
      GroupViewIds(R.id.quick_care_action_four, R.id.quick_care_action_four_title, R.id.quick_care_action_four_summary, R.id.quick_care_action_four_timer),
    )

    private val wideThreeGroupViews = listOf(
      GroupViewIds(R.id.quick_care_action_one, R.id.quick_care_action_one_title, R.id.quick_care_action_one_summary, R.id.quick_care_action_one_timer),
      GroupViewIds(R.id.quick_care_action_two, R.id.quick_care_action_two_title, R.id.quick_care_action_two_summary, R.id.quick_care_action_two_timer),
      GroupViewIds(R.id.quick_care_action_three_wide, R.id.quick_care_action_three_wide_title, R.id.quick_care_action_three_wide_summary, R.id.quick_care_action_three_wide_timer),
    )

    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, QuickCareWidgetProvider::class.java)
      updateWidgets(context, manager, manager.getAppWidgetIds(component))
    }

    fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
      val views = RemoteViews(context.packageName, R.layout.quick_care_widget)
      val kind = WidgetPreferences.widgetKind(context, widgetId)
      val snapshots = WidgetPreferences.snapshots(context)
      if (kind == "dashboard") renderGroup(context, views, manager, widgetId, snapshots)
      else renderSingle(context, views, widgetId, kind, snapshots[kind])
      manager.updateAppWidget(widgetId, views)
    }

    private fun updateWidgets(context: Context, manager: AppWidgetManager, widgetIds: IntArray) {
      widgetIds.forEach { updateWidget(context, manager, it) }
    }

    private fun renderGroup(
      context: Context,
      views: RemoteViews,
      manager: AppWidgetManager,
      widgetId: Int,
      snapshots: Map<String, WidgetSnapshot>,
    ) {
      views.setViewVisibility(R.id.quick_care_group, View.VISIBLE)
      views.setViewVisibility(R.id.quick_care_single, View.GONE)
      val padding = (GROUP_PADDING_DP * context.resources.displayMetrics.density).toInt()
      views.setViewPadding(R.id.quick_care_widget_root, padding, padding, padding, padding)
      views.setOnClickPendingIntent(
        R.id.quick_care_widget_root,
        WidgetIntents.quickCare(context, "home", 100 + widgetId),
      )
      val actions = WidgetPreferences.dashboardActions(context)
      val options = manager.getAppWidgetOptions(widgetId)
      val minWidth = options.getInt(
        AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,
        0,
      )
      val minHeight = options.getInt(
        AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,
        0,
      )
      val useThreeColumns = actions.size == 3 && minWidth >= THREE_COLUMN_MIN_WIDTH_DP
      val rowCount = if (actions.size > 2 && !useThreeColumns) 2 else 1
      val rowHeight = (minHeight - GROUP_PADDING_DP * 2 - ROW_GAP_DP * (rowCount - 1)) / rowCount
      // Budget for both lines at the user's font size, plus the card's padding.
      // A two-row widget needs more height than a single strip of three actions.
      val showSummaries = rowHeight >= 10 + 40 * context.resources.configuration.fontScale
      val groupViews = if (useThreeColumns) wideThreeGroupViews else compactGroupViews
      views.setViewVisibility(
        R.id.quick_care_action_three_wide,
        if (useThreeColumns) View.VISIBLE else View.GONE,
      )
      groupViews.forEachIndexed { index, ids ->
        val action = actions.getOrNull(index)?.let(WidgetActions.supported::get)
        views.setViewVisibility(ids.container, if (action == null) View.GONE else View.VISIBLE)
        if (action != null) {
          val snapshot = snapshots[action.key]
          val showNursingTimer = showSummaries && action.key == "nursing" && snapshot?.active == true
          views.setTextViewText(ids.title, action.label)
          views.setTextViewText(ids.summary, snapshotSummary(snapshot))
          views.setViewVisibility(
            ids.summary,
            if (showNursingTimer || !showSummaries) View.GONE else View.VISIBLE,
          )
          views.setViewVisibility(ids.timer, if (showNursingTimer) View.VISIBLE else View.GONE)
          if (showNursingTimer) setGroupNursingTimer(views, ids.timer, snapshot)
          views.setInt(ids.container, "setBackgroundResource", action.backgroundResource)
          views.setContentDescription(ids.container, "\${action.label}. \${snapshotSummary(snapshot)}")
          views.setOnClickPendingIntent(
            ids.container,
            WidgetIntents.quickCare(context, action.key, 200 + widgetId * 10 + index),
          )
        }
      }
      views.setViewVisibility(
        R.id.quick_care_row_two,
        if (actions.size > 2 && !useThreeColumns) View.VISIBLE else View.GONE,
      )
    }

    private fun setGroupNursingTimer(
      views: RemoteViews,
      timerViewId: Int,
      snapshot: WidgetSnapshot,
    ) {
      val totalSeconds =
        (snapshot.leftSeconds ?: 0L) + (snapshot.rightSeconds ?: 0L)
      val running = snapshot.activeSide == "left" || snapshot.activeSide == "right"
      val format = when (snapshot.activeSide) {
        "left" -> "Left · %s"
        "right" -> "Right · %s"
        else -> "Paused · %s"
      }
      views.setChronometer(
        timerViewId,
        SystemClock.elapsedRealtime() - totalSeconds.coerceAtLeast(0L) * 1_000L,
        format,
        running,
      )
    }

    private fun renderSingle(
      context: Context,
      views: RemoteViews,
      widgetId: Int,
      key: String,
      snapshot: WidgetSnapshot?,
    ) {
      val action = WidgetActions.supported.getValue(key)
      views.setViewVisibility(R.id.quick_care_group, View.GONE)
      views.setViewVisibility(R.id.quick_care_single, View.VISIBLE)
      val padding = (12 * context.resources.displayMetrics.density).toInt()
      views.setViewPadding(R.id.quick_care_widget_root, padding, padding, padding, padding)
      views.setInt(R.id.quick_care_widget_root, "setBackgroundResource", action.backgroundResource)
      views.setTextViewText(R.id.quick_care_single_title, action.label)
      views.setTextViewText(R.id.quick_care_single_summary, snapshotSummary(snapshot))
      views.setTextViewText(R.id.quick_care_single_detail, snapshot?.detail ?: "Quick Care")
      views.setContentDescription(
        R.id.quick_care_single,
        "\${action.label}. \${snapshotSummary(snapshot)}",
      )
      views.setOnClickPendingIntent(
        R.id.quick_care_single,
        WidgetIntents.quickCare(context, key, 500 + widgetId),
      )

      val timerStartedAtMs = snapshot?.timerStartedAtMs
      views.setViewVisibility(
        R.id.quick_care_single_timer,
        if (snapshot?.active == true && timerStartedAtMs != null) View.VISIBLE else View.GONE,
      )
      if (snapshot?.active == true && timerStartedAtMs != null) {
        val elapsed = (System.currentTimeMillis() - timerStartedAtMs).coerceAtLeast(0L)
        views.setChronometer(
          R.id.quick_care_single_timer,
          SystemClock.elapsedRealtime() - elapsed,
          null,
          true,
        )
      }

      val nursing = key == "nursing"
      views.setViewVisibility(R.id.quick_care_nursing_stats, if (nursing) View.VISIBLE else View.GONE)
      if (nursing) {
        setSideTimer(
          views,
          R.id.quick_care_left_timer,
          R.id.quick_care_left_value,
          snapshot?.leftSeconds ?: 0L,
          snapshot?.activeSide == "left",
        )
        setSideTimer(
          views,
          R.id.quick_care_right_timer,
          R.id.quick_care_right_value,
          snapshot?.rightSeconds ?: 0L,
          snapshot?.activeSide == "right",
        )
      }

      configureButtons(context, views, widgetId, action, snapshot)
    }

    private fun snapshotSummary(snapshot: WidgetSnapshot?): String {
      if (snapshot == null) return "Tap to log"
      if (snapshot.active || snapshot.lastEventAtMs == null) return snapshot.summary
      val minutes = ((System.currentTimeMillis() - snapshot.lastEventAtMs) / 60_000L).coerceAtLeast(0L)
      return when {
        minutes < 1L -> "Just now"
        minutes < 60L -> "\${minutes}m ago"
        minutes % 60L == 0L -> "\${minutes / 60L}h ago"
        else -> "\${minutes / 60L}h \${minutes % 60L}m ago"
      }
    }

    private fun setSideTimer(
      views: RemoteViews,
      timerViewId: Int,
      valueViewId: Int,
      seconds: Long,
      running: Boolean,
    ) {
      views.setViewVisibility(timerViewId, if (running) View.VISIBLE else View.GONE)
      views.setViewVisibility(valueViewId, if (running) View.GONE else View.VISIBLE)
      if (running) {
        views.setChronometer(
          timerViewId,
          SystemClock.elapsedRealtime() - seconds.coerceAtLeast(0L) * 1_000L,
          null,
          true,
        )
      } else {
        views.setTextViewText(valueViewId, formatDuration(seconds))
      }
    }

    private fun formatDuration(totalSeconds: Long): String {
      val safeSeconds = totalSeconds.coerceAtLeast(0L)
      val hours = safeSeconds / 3_600L
      val minutes = (safeSeconds % 3_600L) / 60L
      val seconds = safeSeconds % 60L
      return if (hours > 0L) {
        "%d:%02d:%02d".format(hours, minutes, seconds)
      } else {
        "%02d:%02d".format(minutes, seconds)
      }
    }

    private fun configureButtons(
      context: Context,
      views: RemoteViews,
      widgetId: Int,
      action: WidgetAction,
      snapshot: WidgetSnapshot?,
    ) {
      val ids = listOf(
        R.id.quick_care_single_action_one,
        R.id.quick_care_single_action_two,
        R.id.quick_care_single_action_three,
      )
      val buttons = when (action.key) {
        "nursing" -> listOf(
          Triple("Left", "left", 1),
          Triple("Right", "right", 2),
          Triple(if (snapshot?.active == true) "Finish" else "Open", null, 3),
        )
        "diaper" -> listOf(
          Triple("Wet", "wet", 1),
          Triple("Mixed", "both", 2),
          Triple("Dirty", "dirty", 3),
        )
        else -> listOf(
          Triple(
            if (snapshot?.active == true) "Stop"
            else if (action.key in listOf("sleep", "pumping")) "Start"
            else if (action.key == "bottle") "Quick log"
            else "Add",
            null,
            1,
          ),
        )
      }

      ids.forEachIndexed { index, viewId ->
        val button = buttons.getOrNull(index)
        views.setViewVisibility(viewId, if (button == null) View.GONE else View.VISIBLE)
        if (button != null) {
          views.setTextViewText(viewId, button.first)
          views.setOnClickPendingIntent(
            viewId,
            WidgetIntents.quickCare(
              context,
              action.key,
              1_000 + widgetId * 10 + button.third,
              button.second,
            ),
          )
        }
      }
    }
  }
}
`;

const configureActivitySource = packageName => `package ${packageName}

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class QuickCareWidgetConfigureActivity : Activity() {
  private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val surfaceColor = Color.parseColor("#FFF9F5")
    window.statusBarColor = surfaceColor
    window.navigationBarColor = surfaceColor
    var systemUi = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      systemUi = systemUi or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
    }
    window.decorView.systemUiVisibility = systemUi
    setResult(RESULT_CANCELED)
    widgetId = intent?.extras?.getInt(
      AppWidgetManager.EXTRA_APPWIDGET_ID,
      AppWidgetManager.INVALID_APPWIDGET_ID,
    ) ?: AppWidgetManager.INVALID_APPWIDGET_ID
    if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
      finish()
      return
    }

    showChoices()
  }

  private fun showChoices() {
    val padding = dp(20)
    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.parseColor("#FFF9F5"))
      setPadding(padding, padding, padding, padding)
      setOnApplyWindowInsetsListener { view, insets ->
        view.setPadding(
          padding,
          padding + insets.systemWindowInsetTop,
          padding,
          padding + insets.systemWindowInsetBottom,
        )
        insets
      }
    }
    content.addView(TextView(this).apply {
      text = "Set up Quick Care"
      textSize = 24f
      setTextColor(Color.parseColor("#302C3B"))
      setTypeface(typeface, android.graphics.Typeface.BOLD)
    })
    content.addView(TextView(this).apply {
      text = "Choose one activity card, or use your in-app group layout."
      textSize = 15f
      setTextColor(Color.parseColor("#6E6878"))
      setPadding(0, dp(6), 0, dp(14))
    })
    content.addView(choiceButton("Quick Care group", "#FFF9F5") { complete("dashboard") })
    WidgetActions.supported.values.forEach { action ->
      content.addView(choiceButton(action.label, action.color) { complete(action.key) })
    }
    setContentView(ScrollView(this).apply {
      setBackgroundColor(Color.parseColor("#FFF9F5"))
      addView(content)
    })
  }

  private fun choiceButton(label: String, color: String, onClick: () -> Unit) =
    Button(this).apply {
      text = label
      textSize = 15f
      gravity = Gravity.START or Gravity.CENTER_VERTICAL
      backgroundTintList = ColorStateList.valueOf(Color.parseColor(color))
      setTextColor(Color.parseColor("#302C3B"))
      setOnClickListener { onClick() }
      layoutParams = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        dp(54),
      ).apply { bottomMargin = dp(8) }
    }

  private fun complete(kind: String) {
    WidgetPreferences.setWidgetKind(this, widgetId, kind)
    QuickCareWidgetProvider.updateWidget(
      this,
      AppWidgetManager.getInstance(this),
      widgetId,
    )
    setResult(
      RESULT_OK,
      Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId),
    )
    finish()
  }

  private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
`;

const widgetSettingsModuleSource = packageName => `package ${packageName}

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import org.json.JSONArray
import org.json.JSONObject

class WidgetSettingsModule(
  private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {
  override fun getName() = "PitterPatterWidgets"

  @ReactMethod
  fun getDashboardActions(promise: Promise) {
    val result = Arguments.createArray()
    WidgetPreferences.dashboardActions(context).forEach(result::pushString)
    promise.resolve(result)
  }

  @ReactMethod
  fun setDashboardActions(actions: ReadableArray, promise: Promise) {
    try {
      val keys = (0 until actions.size()).mapNotNull(actions::getString)
      WidgetPreferences.setDashboardActions(context, keys)
      QuickCareWidgetProvider.updateAll(context)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WIDGET_SAVE_FAILED", error)
    }
  }

  @ReactMethod
  fun getWatchActions(promise: Promise) {
    val result = Arguments.createArray()
    WidgetPreferences.watchActions(context).forEach(result::pushString)
    promise.resolve(result)
  }

  @ReactMethod
  fun setWatchActions(actions: ReadableArray, promise: Promise) {
    try {
      val keys = (0 until actions.size()).mapNotNull(actions::getString)
      WidgetPreferences.setWatchActions(context, keys)
      WatchStateSync.push(context)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WATCH_SAVE_FAILED", error)
    }
  }

  @ReactMethod
  fun setWidgetSnapshots(snapshots: ReadableArray, promise: Promise) {
    try {
      val array = JSONArray()
      for (index in 0 until snapshots.size()) {
        val source = snapshots.getMap(index) ?: continue
        val item = JSONObject()
        listOf("key", "label", "summary", "detail", "activeSide").forEach { name ->
          if (source.hasKey(name) && !source.isNull(name)) item.put(name, source.getString(name))
        }
        if (source.hasKey("active") && !source.isNull("active")) item.put("active", source.getBoolean("active"))
        listOf("lastEventAtMs", "timerStartedAtMs", "leftSeconds", "rightSeconds", "activeSideStartedAtMs").forEach { name ->
          if (source.hasKey(name) && !source.isNull(name)) item.put(name, source.getDouble(name))
        }
        array.put(item)
      }
      WidgetPreferences.setSnapshots(context, array.toString())
      QuickCareWidgetProvider.updateAll(context)
      WatchStateSync.push(context)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WIDGET_SYNC_FAILED", error)
    }
  }

  @ReactMethod
  fun requestPinWidget(kind: String, promise: Promise) {
    if (!WidgetActions.validKind(kind)) {
      promise.reject("WIDGET_UNKNOWN", "Unknown widget type: $kind")
      return
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(false)
      return
    }
    val manager = AppWidgetManager.getInstance(context)
    if (!manager.isRequestPinAppWidgetSupported) {
      promise.resolve(false)
      return
    }
    val callbackFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_ONE_SHOT or
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
    val successCallback = PendingIntent.getBroadcast(
      context,
      kind.hashCode(),
      Intent(context, QuickCareWidgetPinResultReceiver::class.java)
        .putExtra(QuickCareWidgetPinResultReceiver.EXTRA_WIDGET_KIND, kind),
      callbackFlags,
    )
    val requested = manager.requestPinAppWidget(
      ComponentName(context, QuickCareWidgetProvider::class.java),
      null,
      successCallback,
    )
    promise.resolve(requested)
  }
}
`;

const widgetPinResultReceiverSource = packageName => `package ${packageName}

import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class QuickCareWidgetPinResultReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val widgetId = intent.getIntExtra(
      AppWidgetManager.EXTRA_APPWIDGET_ID,
      AppWidgetManager.INVALID_APPWIDGET_ID,
    )
    val kind = intent.getStringExtra(EXTRA_WIDGET_KIND)
    if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID || kind == null || !WidgetActions.validKind(kind)) {
      return
    }

    WidgetPreferences.setWidgetKind(context, widgetId, kind)
    QuickCareWidgetProvider.updateWidget(
      context,
      AppWidgetManager.getInstance(context),
      widgetId,
    )
  }

  companion object {
    const val EXTRA_WIDGET_KIND = "widget_kind"
  }
}
`;

const widgetSettingsPackageSource = packageName => `package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class WidgetSettingsPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(WidgetSettingsModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`;

function receiver() {
  return {
    $: {
      'android:name': WIDGET_RECEIVER,
      'android:exported': 'false',
      'android:label': 'Quick Care',
    },
    'intent-filter': [{ action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] }],
    'meta-data': [{ $: { 'android:name': 'android.appwidget.provider', 'android:resource': '@xml/quick_care_widget_info' } }],
  };
}

function pinResultReceiver() {
  return {
    $: {
      'android:name': PIN_RESULT_RECEIVER,
      'android:exported': 'false',
    },
  };
}

function configureActivity() {
  return {
    $: {
      'android:name': CONFIGURE_ACTIVITY,
      'android:exported': 'true',
      'android:theme': '@style/Theme.AppCompat.Light.NoActionBar',
    },
    'intent-filter': [{ action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_CONFIGURE' } }] }],
  };
}

function addWidgetComponents(androidManifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  const legacyReceivers = new Set([
    WIDGET_RECEIVER,
    PIN_RESULT_RECEIVER,
    ...ACTIVITY_WIDGETS.map(widget => `.${widget.className}`),
  ]);
  application.receiver = (application.receiver || []).filter(
    item => !legacyReceivers.has(item.$?.['android:name']),
  );
  application.receiver.push(receiver());
  application.receiver.push(pinResultReceiver());

  application.activity = (application.activity || []).filter(
    item => item.$?.['android:name'] !== CONFIGURE_ACTIVITY,
  );
  application.activity.push(configureActivity());
  return androidManifest;
}

function addWidgetPackage(mainApplication) {
  if (mainApplication.includes('add(WidgetSettingsPackage())')) return mainApplication;
  const anchor = '// add(MyReactNativePackage())';
  if (!mainApplication.includes(anchor)) {
    throw new Error('Unable to register WidgetSettingsPackage in MainApplication.');
  }
  return mainApplication.replace(anchor, `${anchor}\n              add(WidgetSettingsPackage())`);
}

function writeFile(projectRoot, relativePath, contents) {
  const target = path.join(projectRoot, 'android', 'app', 'src', 'main', relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function removeFile(projectRoot, relativePath) {
  const target = path.join(projectRoot, 'android', 'app', 'src', 'main', relativePath);
  if (fs.existsSync(target)) fs.unlinkSync(target);
}

module.exports = function withQuickCareWidget(config) {
  const packageName = config.android?.package;
  const scheme = Array.isArray(config.scheme) ? config.scheme[0] : config.scheme;
  if (!packageName || !scheme) {
    throw new Error('Quick care widgets require expo.android.package and expo.scheme.');
  }

  config = withAndroidManifest(config, nextConfig => {
    nextConfig.modResults = addWidgetComponents(nextConfig.modResults);
    return nextConfig;
  });

  config = withMainApplication(config, nextConfig => {
    nextConfig.modResults.contents = addWidgetPackage(nextConfig.modResults.contents);
    return nextConfig;
  });

  return withDangerousMod(config, [
    'android',
    nextConfig => {
      const projectRoot = nextConfig.modRequest.projectRoot;
      const javaRoot = path.join('java', ...packageName.split('.'));
      writeFile(projectRoot, path.join(javaRoot, 'WidgetModels.kt'), widgetModelsSource(packageName, ACTIVITY_WIDGETS));
      writeFile(projectRoot, path.join(javaRoot, 'WidgetPreferences.kt'), widgetPreferencesSource(packageName));
      writeFile(projectRoot, path.join(javaRoot, 'WidgetIntents.kt'), widgetIntentSource(packageName, scheme));
      writeFile(projectRoot, path.join(javaRoot, 'QuickCareWidgetProvider.kt'), widgetProviderSource(packageName));
      writeFile(projectRoot, path.join(javaRoot, 'QuickCareWidgetConfigureActivity.kt'), configureActivitySource(packageName));
      writeFile(projectRoot, path.join(javaRoot, 'QuickCareWidgetPinResultReceiver.kt'), widgetPinResultReceiverSource(packageName));
      writeFile(projectRoot, path.join(javaRoot, 'WidgetSettingsModule.kt'), widgetSettingsModuleSource(packageName));
      writeFile(projectRoot, path.join(javaRoot, 'WidgetSettingsPackage.kt'), widgetSettingsPackageSource(packageName));
      removeFile(projectRoot, path.join(javaRoot, 'ActivityWidgetProviders.kt'));

      writeFile(projectRoot, path.join('res', 'layout', 'quick_care_widget.xml'), widgetLayout);
      writeFile(projectRoot, path.join('res', 'xml', 'quick_care_widget_info.xml'), widgetInfo(packageName));
      removeFile(projectRoot, path.join('res', 'layout', 'quick_care_activity_widget.xml'));
      removeFile(projectRoot, path.join('res', 'xml', 'quick_care_activity_widget_info.xml'));
      writeFile(projectRoot, path.join('res', 'drawable', 'quick_care_widget_background.xml'), roundedBackground('#FFF9F5'));
      writeFile(projectRoot, path.join('res', 'drawable', 'quick_care_widget_button_background.xml'), roundedBackground('#B8FFFFFF', 13));
      ACTIVITY_WIDGETS.forEach(widget => {
        writeFile(
          projectRoot,
          path.join('res', 'drawable', `quick_care_${widget.resourceName}_background.xml`),
          roundedBackground(widget.color),
        );
      });
      return nextConfig;
    },
  ]);
};
