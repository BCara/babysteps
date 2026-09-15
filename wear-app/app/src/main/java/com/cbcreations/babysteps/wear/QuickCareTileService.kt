package com.cbcreations.babysteps.wear

import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders
import androidx.wear.protolayout.DimensionBuilders
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.protolayout.TypeBuilders
import androidx.wear.protolayout.expression.DynamicBuilders
import androidx.wear.protolayout.expression.util.DynamicFormatter
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import java.time.Instant
import java.util.concurrent.TimeUnit

abstract class BaseCareTileService : TileService() {
    protected open val fixedAction: String? = null

    override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest,
    ): ListenableFuture<TileBuilders.Tile> {
        handleCommandClick(requestParams)
        val state = WearStateStore.read(this)
        if (state.pendingTimedOut) CommandTransport.flushPending(this)
        val pendingCommand = state.pendingAction
        val actions = fixedAction?.let(::listOf) ?: state.actions.take(4)
        val renderNonce = System.currentTimeMillis()
        val root = if (actions.size == 1) {
            singleActionLayout(actions.first(), state, renderNonce, pendingCommand)
        } else {
            overviewLayout(actions, state)
        }
        val layout = LayoutElementBuilders.Layout.Builder().setRoot(root).build()
        val timeline = TimelineBuilders.Timeline.Builder()
            .addTimelineEntry(
                TimelineBuilders.TimelineEntry.Builder().setLayout(layout).build(),
            )
            .build()
        return Futures.immediateFuture(
            TileBuilders.Tile.Builder()
                .setResourcesVersion(RESOURCES_VERSION)
                .setFreshnessIntervalMillis(15_000)
                .setTileTimeline(timeline)
                .build(),
        )
    }

    override fun onTileResourcesRequest(
        requestParams: RequestBuilders.ResourcesRequest,
    ): ListenableFuture<ResourceBuilders.Resources> = Futures.immediateFuture(
        ResourceBuilders.Resources.Builder().setVersion(RESOURCES_VERSION).build(),
    )

    private fun handleCommandClick(requestParams: RequestBuilders.TileRequest): String? {
        val clickId = requestParams.currentState.lastClickableId
        if (!clickId.startsWith(COMMAND_CLICK_PREFIX)) return null
        val payload = clickId.removePrefix(COMMAND_CLICK_PREFIX)
        val separator = payload.lastIndexOf(':')
        if (separator <= 0) return null
        val command = payload.substring(0, separator)
        if (command !in INLINE_COMMANDS) return null
        val preferences = getSharedPreferences(CLICK_FILE_NAME, MODE_PRIVATE)
        val handledKey = "${javaClass.name}:${requestParams.tileId}"
        synchronized(CLICK_LOCK) {
            if (preferences.getString(handledKey, null) == clickId) return null
            preferences.edit().putString(handledKey, clickId).apply()
        }
        CommandTransport.send(this, command) {}
        WatchTileUpdater.requestAll(this)
        return command
    }

    private fun overviewLayout(
        actions: List<String>,
        state: WearState,
    ): LayoutElementBuilders.Column {
        val rows = actions.chunked(2)
        val root = LayoutElementBuilders.Column.Builder()
            .setWidth(DimensionBuilders.expand())
            .setHeight(DimensionBuilders.expand())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .addContent(spacer(14f))
            .addContent(text("PitterPatter", 15f, BRAND_PINK))
            .addContent(spacer(7f))

        rows.forEachIndexed { index, rowActions ->
            root.addContent(actionRow(rowActions, state))
            if (index < rows.lastIndex) root.addContent(spacer(7f))
        }

        val footer = when {
            state.activeType != null -> "Tap to control timer"
            state.snapshots.isEmpty() -> "Open phone to sync"
            else -> "Tap for details"
        }
        return root.addContent(spacer(7f))
            .addContent(text(footer, 8.5f, MUTED))
            .build()
    }

    private fun singleActionLayout(
        action: String,
        state: WearState,
        renderNonce: Long,
        pendingCommand: String?,
    ): LayoutElementBuilders.Column {
        val root = LayoutElementBuilders.Column.Builder()
            .setWidth(DimensionBuilders.expand())
            .setHeight(DimensionBuilders.expand())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)

        return when (action) {
            "nursing" -> nursingLayout(root, state, renderNonce, pendingCommand)
            "diaper" -> nappyLayout(root, state, renderNonce, pendingCommand)
            else -> timedActionLayout(root, action, state, renderNonce, pendingCommand)
        }.build()
    }

    private fun nursingLayout(
        root: LayoutElementBuilders.Column.Builder,
        state: WearState,
        renderNonce: Long,
        pendingCommand: String?,
    ): LayoutElementBuilders.Column.Builder {
        val active = state.activeType == "nursing"
        val paused = active && state.activeSide == null
        val elapsed = state.activeSinceMillis?.let(::elapsedCompact)
        val headline = when {
            paused -> "Paused${elapsed?.let { " - $it" }.orEmpty()}"
            active -> "${state.activeSide?.replaceFirstChar(Char::uppercase) ?: "Nursing"} - ${elapsed ?: "active"}"
            else -> lastEventText("nursing", state)
        }
        val now = System.currentTimeMillis()
        val headlineText = if (active && !paused && state.activeSinceMillis != null) {
            dynamicText(
                fallback = headline,
                dynamicValue = DynamicBuilders.DynamicString
                    .constant("${state.activeSide?.replaceFirstChar(Char::uppercase) ?: "Nursing"} · ")
                    .concat(dynamicElapsed(state.activeSinceMillis)),
                longestPattern = "Nursing · 999:59",
                size = 17f,
                color = WHITE,
            )
        } else {
            text(headline, 17f, WHITE)
        }
        val sideFallback =
            "Left ${formatSideDuration(sideSeconds("left", state, now))}   " +
                "Right ${formatSideDuration(sideSeconds("right", state, now))}"
        val sideText = dynamicNursingSideText(state, now)?.let { dynamicValue ->
            dynamicText(
                fallback = sideFallback,
                dynamicValue = dynamicValue,
                longestPattern = "Left 999:59   Right 999:59",
                size = 9.5f,
                color = MUTED,
            )
        } ?: text(sideFallback, 9.5f, MUTED)

        root.addContent(spacer(10f))
            .addContent(text("Nursing", 15f, NURSING_PINK))
            .addContent(spacer(2f))
            .addContent(headlineText)
            .addContent(spacer(3f))
            .addContent(sideText)
            .addContent(spacer(5f))
            .addContent(
                controlRow(
                    listOf(
                        Control("Left", "nursing_left", state.activeSide == "left"),
                        Control("Right", "nursing_right", state.activeSide == "right"),
                    ),
                    NURSING_PINK,
                    renderNonce,
                    CONTROL_WIDTH,
                    44f,
                ),
            )

        if (active) {
            root.addContent(spacer(5f))
                .addContent(
                    controlRow(
                        listOf(
                            Control(if (paused) "Paused" else "Pause", "nursing_pause", paused),
                            Control("Done", "nursing_stop", false),
                        ),
                        BOTTLE_PEACH,
                        renderNonce,
                        CONTROL_WIDTH,
                        40f,
                    ),
                )
        } else {
            root.addContent(spacer(7f))
                .addContent(text("Choose a side to start", 8.5f, MUTED))
        }
        if (pendingCommand != null) {
            root.addContent(spacer(3f)).addContent(text(syncLabel(state), 8f, SYNC_BLUE))
        }
        return root
    }

    private fun timedActionLayout(
        root: LayoutElementBuilders.Column.Builder,
        action: String,
        state: WearState,
        renderNonce: Long,
        pendingCommand: String?,
    ): LayoutElementBuilders.Column.Builder {
        val active = state.activeType == action
        val elapsed = state.activeSinceMillis?.let(::elapsedCompact)
        val headline = if (active) elapsed ?: "Active" else lastEventText(action, state)
        val headlineText = if (active && state.activeSinceMillis != null) {
            dynamicText(
                fallback = headline,
                dynamicValue = dynamicElapsed(state.activeSinceMillis),
                longestPattern = "999:59",
                size = 24f,
                color = WHITE,
            )
        } else {
            text(headline, 15f, WHITE)
        }
        val label = WearStateStore.labelFor(action)
        val buttonLabel = if (active) "Stop $label" else "Start $label"

        root.addContent(spacer(22f))
            .addContent(text(label, 16f, colorFor(action)))
            .addContent(spacer(7f))
            .addContent(headlineText)
            .addContent(spacer(5f))
        state.snapshots[action]?.detail?.takeIf(String::isNotBlank)?.let {
            root.addContent(text(it.take(26), 9f, MUTED)).addContent(spacer(10f))
        } ?: root.addContent(spacer(14f))
        root.addContent(
            controlButton(
                Control(buttonLabel, action, active),
                colorFor(action),
                renderNonce,
                142f,
                50f,
            ),
        )
        if (pendingCommand != null) {
            root.addContent(spacer(5f)).addContent(text(syncLabel(state), 8f, SYNC_BLUE))
        }
        return root
    }

    private fun nappyLayout(
        root: LayoutElementBuilders.Column.Builder,
        state: WearState,
        renderNonce: Long,
        pendingCommand: String?,
    ): LayoutElementBuilders.Column.Builder {
        root.addContent(spacer(24f))
            .addContent(text("Nappy", 16f, NAPPY_GREEN))
            .addContent(spacer(7f))
            .addContent(text(lastEventText("diaper", state), 15f, WHITE))
            .addContent(spacer(8f))
            .addContent(text("Log nappy", 9f, MUTED))
            .addContent(spacer(7f))
            .addContent(
                controlRow(
                    listOf(
                        Control("Wet", "diaper_wet", false),
                        Control("Dirty", "diaper_dirty", false),
                        Control("Both", "diaper_both", false),
                    ),
                    NAPPY_GREEN,
                    renderNonce,
                    48f,
                    48f,
                ),
            )
        if (pendingCommand != null) {
            root.addContent(spacer(7f)).addContent(text(syncLabel(state), 8f, SYNC_BLUE))
        }
        return root
    }

    private fun actionRow(
        actions: List<String>,
        state: WearState,
    ): LayoutElementBuilders.Box {
        val row = LayoutElementBuilders.Row.Builder()
            .setWidth(DimensionBuilders.dp(if (actions.size == 1) CARD_WIDTH else ROW_WIDTH))
            .setHeight(DimensionBuilders.dp(CARD_HEIGHT))

        actions.forEachIndexed { index, action ->
            row.addContent(actionCard(action, state))
            if (index < actions.lastIndex) row.addContent(spacer(CARD_GAP))
        }

        return LayoutElementBuilders.Box.Builder()
            .setWidth(DimensionBuilders.expand())
            .setHeight(DimensionBuilders.dp(CARD_HEIGHT))
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .addContent(row.build())
            .build()
    }

    private fun actionCard(action: String, state: WearState): LayoutElementBuilders.Box {
        val activity = ActionBuilders.AndroidActivity.Builder()
            .setPackageName(packageName)
            .setClassName(ActionActivity::class.java.name)
            .addKeyToExtraMapping(
                ActionActivity.EXTRA_ACTION,
                ActionBuilders.AndroidStringExtra.Builder().setValue(action).build(),
            )
            .build()
        val clickable = ModifiersBuilders.Clickable.Builder()
            .setId("care-details-$action")
            .setOnClick(ActionBuilders.LaunchAction.Builder().setAndroidActivity(activity).build())
            .build()
        val glance = glanceText(action, state)
        val glanceElement = if (
            state.activeType == action &&
            !(action == "nursing" && state.activeSide == null) &&
            state.activeSinceMillis != null
        ) {
            val prefix = if (action == "nursing") {
                "\u2022 ${state.activeSide?.firstOrNull()?.uppercase() ?: ""} "
            } else {
                "\u2022 "
            }
            dynamicText(
                fallback = glance,
                dynamicValue = DynamicBuilders.DynamicString.constant(prefix)
                    .concat(dynamicElapsed(state.activeSinceMillis)),
                longestPattern = "\u2022 R 999:59",
                size = 8f,
                color = INK,
            )
        } else {
            text(glance, 8f, INK)
        }
        val content = LayoutElementBuilders.Column.Builder()
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .addContent(text(WearStateStore.labelFor(action), 11f, INK))
            .addContent(spacer(1f))
            .addContent(glanceElement)
            .build()

        return LayoutElementBuilders.Box.Builder()
            .setWidth(DimensionBuilders.dp(CARD_WIDTH))
            .setHeight(DimensionBuilders.dp(CARD_HEIGHT))
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setClickable(clickable)
                    .setBackground(background(colorFor(action), 16f))
                    .build(),
            )
            .addContent(content)
            .build()
    }

    private fun controlRow(
        controls: List<Control>,
        accent: Int,
        renderNonce: Long,
        width: Float,
        height: Float,
    ): LayoutElementBuilders.Row {
        val row = LayoutElementBuilders.Row.Builder()
            .setWidth(DimensionBuilders.dp(width * controls.size + CONTROL_GAP * (controls.size - 1)))
            .setHeight(DimensionBuilders.dp(height))
        controls.forEachIndexed { index, control ->
            row.addContent(controlButton(control, accent, renderNonce, width, height))
            if (index < controls.lastIndex) row.addContent(spacer(CONTROL_GAP))
        }
        return row.build()
    }

    private fun controlButton(
        control: Control,
        accent: Int,
        renderNonce: Long,
        width: Float,
        height: Float,
    ): LayoutElementBuilders.Box {
        val fill = if (control.selected) accent else CONTROL_BACKGROUND
        val foreground = if (control.selected) INK else WHITE
        val clickable = ModifiersBuilders.Clickable.Builder()
            .setId("$COMMAND_CLICK_PREFIX${control.command}:$renderNonce")
            .setOnClick(ActionBuilders.LoadAction.Builder().build())
            .build()
        return LayoutElementBuilders.Box.Builder()
            .setWidth(DimensionBuilders.dp(width))
            .setHeight(DimensionBuilders.dp(height))
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setClickable(clickable)
                    .setBackground(background(fill, height / 2f))
                    .build(),
            )
            .addContent(text(control.label, if (width <= 48f) 8.5f else 10f, foreground))
            .build()
    }

    private fun background(color: Int, radius: Float) =
        ModifiersBuilders.Background.Builder()
            .setColor(ColorBuilders.argb(color))
            .setCorner(
                ModifiersBuilders.Corner.Builder()
                    .setRadius(DimensionBuilders.dp(radius))
                    .build(),
            )
            .build()

    private fun glanceText(action: String, state: WearState): String {
        if (state.activeType == action) {
            if (
                action == "nursing" &&
                state.activeSide == null &&
                state.snapshots[action]?.active == true
            ) {
                val elapsed = state.activeSinceMillis?.let(::elapsedCompact)
                return elapsed?.let { "Paused \u00B7 $it" } ?: "Paused"
            }
            val elapsed = state.activeSinceMillis?.let(::elapsedCompact) ?: "active"
            return if (action == "nursing") {
                "\u2022 ${state.activeSide?.firstOrNull()?.uppercase() ?: ""} $elapsed".trim()
            } else {
                "\u2022 $elapsed"
            }
        }
        val snapshot = state.snapshots[action]
        snapshot?.lastEventAtMs?.let { return elapsedCompact(it) + " ago" }
        val summary = snapshot?.summary?.removeSuffix(" ago") ?: return "No log yet"
        return when {
            summary.startsWith("Not logged", ignoreCase = true) -> "No log yet"
            summary.startsWith("Open PitterPatter", ignoreCase = true) -> "Sync phone"
            else -> summary.take(14)
        }
    }

    private fun lastEventText(action: String, state: WearState): String {
        val snapshot = state.snapshots[action]
        snapshot?.lastEventAtMs?.let { return elapsedCompact(it) + " ago" }
        return snapshot?.summary
            ?.replace("Not logged yet", "No log yet", ignoreCase = true)
            ?.take(22)
            ?: "No log yet"
    }

    private fun sideSeconds(side: String, state: WearState, now: Long): Long {
        val snapshot = state.snapshots["nursing"]
        val stored = if (side == "left") snapshot?.leftSeconds else snapshot?.rightSeconds
        if (state.activeType != "nursing" || state.activeSide != side) return stored ?: 0L
        val started = snapshot?.activeSideStartedAtMs ?: state.activeSinceMillis ?: now
        return (stored ?: 0L) + TimeUnit.MILLISECONDS.toSeconds((now - started).coerceAtLeast(0L))
    }

    private fun dynamicNursingSideText(
        state: WearState,
        now: Long,
    ): DynamicBuilders.DynamicString? {
        if (state.activeType != "nursing") return null
        val activeSide = state.activeSide ?: return null
        val snapshot = state.snapshots["nursing"]
        val leftSeconds = snapshot?.leftSeconds ?: 0L
        val rightSeconds = snapshot?.rightSeconds ?: 0L
        val activeStoredSeconds = if (activeSide == "left") leftSeconds else rightSeconds
        val sideStartedAt = snapshot?.activeSideStartedAtMs ?: state.activeSinceMillis ?: return null
        val totalStartedAt = (sideStartedAt - activeStoredSeconds * 1_000L).coerceAtLeast(0L)
        val activeTimer = dynamicElapsed(totalStartedAt)

        return if (activeSide == "left") {
            DynamicBuilders.DynamicString.constant("Left ")
                .concat(activeTimer)
                .concat(
                    DynamicBuilders.DynamicString.constant(
                        "   Right ${formatSideDuration(sideSeconds("right", state, now))}",
                    ),
                )
        } else {
            DynamicBuilders.DynamicString.constant(
                "Left ${formatSideDuration(sideSeconds("left", state, now))}   Right ",
            ).concat(activeTimer)
        }
    }

    private fun dynamicElapsed(startedAtMillis: Long): DynamicBuilders.DynamicString {
        val elapsed = DynamicBuilders.DynamicInstant
            .withSecondsPrecision(Instant.ofEpochMilli(startedAtMillis))
            .durationUntil(DynamicBuilders.DynamicInstant.platformTimeWithSecondsPrecision())
        return DynamicFormatter().format(
            "%d:%02d",
            elapsed.toIntMinutes(),
            elapsed.secondsPart,
        )
    }

    private fun elapsedCompact(startedAtMillis: Long): String {
        val seconds = TimeUnit.MILLISECONDS.toSeconds(
            (System.currentTimeMillis() - startedAtMillis).coerceAtLeast(0L),
        )
        val hours = seconds / 3600
        val minutes = (seconds % 3600) / 60
        return when {
            hours >= 24 -> "${hours / 24}d ${hours % 24}h"
            hours > 0 -> "${hours}h ${minutes}m"
            minutes > 0 -> "${minutes}m"
            else -> "<1m"
        }
    }

    private fun formatSideDuration(seconds: Long): String =
        "%d:%02d".format(seconds / 60, seconds % 60)

    private fun text(value: String, size: Float, color: Int) =
        LayoutElementBuilders.Text.Builder()
            .setText(value)
            .setFontStyle(
                LayoutElementBuilders.FontStyle.Builder()
                    .setSize(DimensionBuilders.sp(size))
                    .setColor(ColorBuilders.argb(color))
                    .build(),
            )
            .setMaxLines(1)
            .build()

    private fun dynamicText(
        fallback: String,
        dynamicValue: DynamicBuilders.DynamicString,
        longestPattern: String,
        size: Float,
        color: Int,
    ) = LayoutElementBuilders.Text.Builder()
        .setText(
            TypeBuilders.StringProp.Builder(fallback)
                .setDynamicValue(dynamicValue)
                .build(),
        )
        .setLayoutConstraintsForDynamicText(
            TypeBuilders.StringLayoutConstraint.Builder(longestPattern)
                .setAlignment(LayoutElementBuilders.TEXT_ALIGN_CENTER)
                .build(),
        )
        .setFontStyle(
            LayoutElementBuilders.FontStyle.Builder()
                .setSize(DimensionBuilders.sp(size))
                .setColor(ColorBuilders.argb(color))
                .build(),
        )
        .setMaxLines(1)
        .build()

    private fun spacer(size: Float) = LayoutElementBuilders.Spacer.Builder()
        .setWidth(DimensionBuilders.dp(size))
        .setHeight(DimensionBuilders.dp(size))
        .build()

    private fun colorFor(action: String) = when (action) {
        "nursing" -> NURSING_PINK
        "bottle" -> BOTTLE_PEACH
        "sleep" -> SLEEP_BLUE
        "diaper" -> NAPPY_GREEN
        else -> NURSING_PINK
    }

    private fun syncLabel(state: WearState) = if (state.pendingCount == 1) {
        "Saved · syncing"
    } else {
        "Saved · ${state.pendingCount} to sync"
    }

    private data class Control(
        val label: String,
        val command: String,
        val selected: Boolean,
    )

    companion object {
        private const val RESOURCES_VERSION = "6"
        private const val CLICK_FILE_NAME = "pitterpatter_tile_clicks"
        private const val COMMAND_CLICK_PREFIX = "care-command:"
        private const val CARD_WIDTH = 80f
        private const val CARD_HEIGHT = 48f
        private const val CARD_GAP = 7f
        private const val ROW_WIDTH = CARD_WIDTH * 2 + CARD_GAP
        private const val CONTROL_WIDTH = 72f
        private const val CONTROL_GAP = 6f
        private const val BRAND_PINK = 0xFFFF8FB1.toInt()
        private const val NURSING_PINK = 0xFFFFA7C4.toInt()
        private const val BOTTLE_PEACH = 0xFFFFD0A8.toInt()
        private const val SLEEP_BLUE = 0xFFA9D6FF.toInt()
        private const val NAPPY_GREEN = 0xFFBDEBD2.toInt()
        private const val CONTROL_BACKGROUND = 0xFF332E3A.toInt()
        private const val INK = 0xFF211A24.toInt()
        private const val WHITE = 0xFFF8F4FA.toInt()
        private const val MUTED = 0xFFC8C1CD.toInt()
        private const val SYNC_BLUE = 0xFFA9D6FF.toInt()
        private val CLICK_LOCK = Any()
        private val INLINE_COMMANDS = setOf(
            "nursing_left",
            "nursing_right",
            "nursing_pause",
            "nursing_stop",
            "bottle",
            "sleep",
            "diaper_wet",
            "diaper_dirty",
            "diaper_both",
        )
    }
}

class QuickCareTileService : BaseCareTileService()

class NursingTileService : BaseCareTileService() {
    override val fixedAction = "nursing"
}

class BottleTileService : BaseCareTileService() {
    override val fixedAction = "bottle"
}

class SleepTileService : BaseCareTileService() {
    override val fixedAction = "sleep"
}

class NappyTileService : BaseCareTileService() {
    override val fixedAction = "diaper"
}
