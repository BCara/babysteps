package com.cbcreations.babysteps.wear

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class WatchActivitySnapshot(
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
    val activeSideStartedAtMs: Long?,
)

data class PendingWatchCommand(
    val id: String,
    val action: String,
    val transportAction: String,
    val occurredAtMillis: Long,
    val lastAttemptAtMillis: Long,
)

data class WearState(
    val message: String,
    val success: Boolean,
    val completedAtMillis: Long,
    val lastResultCommandId: String?,
    val babyName: String,
    val activeType: String?,
    val activeSinceMillis: Long?,
    val activeSide: String?,
    val pendingCommandId: String?,
    val pendingAction: String?,
    val pendingTransportAction: String?,
    val pendingOccurredAtMillis: Long?,
    val pendingSinceMillis: Long?,
    val pendingTimedOut: Boolean,
    val pendingCount: Int,
    val actions: List<String>,
    val snapshots: Map<String, WatchActivitySnapshot>,
)

object WearStateStore {
    private const val FILE_NAME = "pitterpatter_wear_state"
    private val defaultActions = listOf("nursing", "bottle", "sleep", "diaper")

    fun read(context: Context): WearState {
        val preferences = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
        val activeSince = preferences.getLong("activeSinceMillis", -1L)
        val actions = preferences.getString("actions", null)
            ?.split(",")
            ?.filter(::isSupportedAction)
            ?.distinct()
            ?.take(4)
            .orEmpty()
            .ifEmpty { defaultActions }
        val snapshots = parseSnapshots(preferences.getString("snapshots", "[]") ?: "[]")
        val activeSnapshot = snapshots.values.firstOrNull { it.active }
        val pendingCommands = readPendingCommands(preferences)
        val pending = pendingCommands.firstOrNull()
        return WearState(
            message = preferences.getString("message", "Open PitterPatter on your phone to sync")
                ?: "Open PitterPatter on your phone to sync",
            success = preferences.getBoolean("success", true),
            completedAtMillis = preferences.getLong("completedAtMillis", 0L),
            lastResultCommandId = preferences.getString("lastResultCommandId", null),
            babyName = preferences.getString("babyName", "") ?: "",
            activeType = preferences.getString("activeType", null) ?: activeSnapshot?.key,
            activeSinceMillis = activeSince.takeIf { it >= 0L }
                ?: activeSnapshot?.timerStartedAtMs,
            activeSide = preferences.getString("activeSide", null)
                ?: activeSnapshot?.activeSide,
            pendingCommandId = pending?.id,
            pendingAction = pending?.action,
            pendingTransportAction = pending?.transportAction,
            pendingOccurredAtMillis = pending?.occurredAtMillis,
            pendingSinceMillis = pending?.lastAttemptAtMillis,
            pendingTimedOut = pending != null &&
                pending.lastAttemptAtMillis < System.currentTimeMillis() - PENDING_TIMEOUT_MILLIS,
            pendingCount = pendingCommands.size,
            actions = actions,
            snapshots = snapshots,
        )
    }

    fun writeResult(context: Context, result: WearState) {
        context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString("message", result.message)
            .putBoolean("success", result.success)
            .putLong("completedAtMillis", result.completedAtMillis)
            .putString("lastResultCommandId", result.lastResultCommandId)
            .putString("babyName", result.babyName)
            .putString("activeType", result.activeType)
            .putLong("activeSinceMillis", result.activeSinceMillis ?: -1L)
            .putString("activeSide", result.activeSide)
            .putString("pendingCommandId", result.pendingCommandId)
            .putString("pendingAction", result.pendingAction)
            .putString("pendingTransportAction", result.pendingTransportAction)
            .putLong("pendingOccurredAtMillis", result.pendingOccurredAtMillis ?: -1L)
            .putLong("pendingSinceMillis", result.pendingSinceMillis ?: -1L)
            .putString("snapshots", snapshotsJson(result.snapshots))
            .apply()
    }

    @Synchronized
    fun markPending(
        context: Context,
        commandId: String,
        action: String,
        transportAction: String,
        occurredAtMillis: Long,
    ) {
        if (action == "sync") return
        val current = read(context)
        val preferences = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
        val queued = readPendingCommands(preferences) + PendingWatchCommand(
            id = commandId,
            action = action,
            transportAction = transportAction,
            occurredAtMillis = occurredAtMillis,
            lastAttemptAtMillis = occurredAtMillis,
        )
        val optimistic = optimisticState(current, action, occurredAtMillis).copy(
                pendingCommandId = commandId,
                pendingAction = action,
                pendingTransportAction = transportAction,
                pendingOccurredAtMillis = occurredAtMillis,
                pendingSinceMillis = occurredAtMillis,
                pendingTimedOut = false,
                pendingCount = queued.size,
            )
        writeResult(context, optimistic)
        writePendingCommands(preferences, queued)
    }

    fun pendingCommands(context: Context): List<PendingWatchCommand> =
        readPendingCommands(context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE))

    @Synchronized
    fun acknowledge(context: Context, commandId: String): List<PendingWatchCommand> {
        val preferences = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
        val remaining = readPendingCommands(preferences).filterNot { it.id == commandId }
        writePendingCommands(preferences, remaining)
        return remaining
    }

    fun clearPendingRollback(context: Context, commandId: String?) {
        if (commandId == null) return
        val preferences = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
        val pendingId = preferences.getString("pendingCommandId", null)
        if (pendingId != null && pendingId != commandId) return
        preferences.edit()
            .remove(ROLLBACK_PRESENT)
            .remove(ROLLBACK_ACTIVE_TYPE)
            .remove(ROLLBACK_ACTIVE_SINCE)
            .remove(ROLLBACK_ACTIVE_SIDE)
            .remove(ROLLBACK_SNAPSHOTS)
            .apply()
    }

    fun restorePendingFailure(
        context: Context,
        commandId: String,
        message: String,
        completedAtMillis: Long? = null,
    ) {
        val current = read(context)
        if (current.pendingCommandId != commandId) return
        val preferences = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
        val hasRollback = preferences.getBoolean(ROLLBACK_PRESENT, false)
        val restoredSnapshots = if (hasRollback) {
            parseSnapshots(preferences.getString(ROLLBACK_SNAPSHOTS, "[]") ?: "[]")
        } else {
            current.snapshots
        }
        val restoredActiveSince = preferences.getLong(ROLLBACK_ACTIVE_SINCE, -1L)
            .takeIf { hasRollback && it >= 0L }
        val restored = current.copy(
            message = message,
            success = false,
            completedAtMillis = completedAtMillis ?: current.completedAtMillis,
            lastResultCommandId = commandId,
            activeType = preferences.getString(ROLLBACK_ACTIVE_TYPE, null)
                .takeIf { hasRollback },
            activeSinceMillis = restoredActiveSince,
            activeSide = preferences.getString(ROLLBACK_ACTIVE_SIDE, null)
                .takeIf { hasRollback },
            pendingCommandId = null,
            pendingAction = null,
            pendingTransportAction = null,
            pendingOccurredAtMillis = null,
            pendingSinceMillis = null,
            pendingTimedOut = false,
            snapshots = restoredSnapshots,
        )
        writeResult(context, restored)
        clearPendingRollback(context, commandId)
    }

    @Synchronized
    fun markRetryAttempt(context: Context, commandId: String) {
        val preferences = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val updated = readPendingCommands(preferences).map { command ->
            if (command.id == commandId) command.copy(lastAttemptAtMillis = now) else command
        }
        writePendingCommands(preferences, updated)
    }

    fun markTransportFailure(context: Context, commandId: String) {
        if (pendingCommands(context).none { it.id == commandId }) return
        val current = read(context)
        writeResult(
            context,
            current.copy(
                success = true,
            ),
        )
    }

    fun writeSnapshot(context: Context, actions: List<String>, snapshotsJson: String) {
        val sanitized = actions.filter(::isSupportedAction).distinct().take(4)
        val current = read(context)
        if (current.pendingCommandId != null) {
            context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString("actions", (sanitized.ifEmpty { defaultActions }).joinToString(","))
                .apply()
            return
        }
        val snapshots = parseSnapshots(snapshotsJson)
        val activeSnapshot = snapshots.values.firstOrNull { it.active }
        context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString("actions", (sanitized.ifEmpty { defaultActions }).joinToString(","))
            .putString("snapshots", snapshotsJson)
            .putString("activeType", activeSnapshot?.key)
            .putLong("activeSinceMillis", activeSnapshot?.timerStartedAtMs ?: -1L)
            .putString("activeSide", activeSnapshot?.activeSide)
            .apply()
    }

    private fun optimisticState(
        state: WearState,
        action: String,
        occurredAtMillis: Long,
    ): WearState = when (action) {
        "nursing_left" -> optimisticNursingSide(state, "left", occurredAtMillis)
        "nursing_right" -> optimisticNursingSide(state, "right", occurredAtMillis)
        "nursing_pause" -> optimisticNursingPause(state, occurredAtMillis)
        "nursing_stop" -> optimisticNursingStop(state, occurredAtMillis)
        "bottle" -> optimisticTimer(state, "bottle", occurredAtMillis)
        "sleep" -> optimisticTimer(state, "sleep", occurredAtMillis)
        "diaper_wet" -> optimisticNappy(state, "Wet", occurredAtMillis)
        "diaper_dirty" -> optimisticNappy(state, "Dirty", occurredAtMillis)
        "diaper_both" -> optimisticNappy(state, "Wet + dirty", occurredAtMillis)
        else -> state.copy(message = "Confirming care action...")
    }

    private fun optimisticNursingSide(
        state: WearState,
        side: String,
        occurredAtMillis: Long,
    ): WearState {
        if (state.activeType != null && state.activeType != "nursing" && state.activeType != "bottle") {
            return state.copy(message = "Confirming ${side} nursing...")
        }
        val nursing = nursingSnapshot(state)
        if (state.activeType == "nursing" && state.activeSide == side) {
            val paused = accrueActiveNursingSide(nursing, state, occurredAtMillis).copy(
                active = true,
                activeSide = null,
                activeSideStartedAtMs = null,
            )
            return state.copy(
                message = "${side.capitalized()} nursing paused",
                success = true,
                activeSide = null,
                snapshots = state.snapshots + ("nursing" to paused),
            )
        }

        val activeSince = if (state.activeType == "nursing") {
            state.activeSinceMillis ?: occurredAtMillis
        } else {
            occurredAtMillis
        }
        val updated = if (state.activeType == "nursing") {
            accrueActiveNursingSide(nursing, state, occurredAtMillis).copy(
                active = true,
                timerStartedAtMs = activeSince,
                activeSide = side,
                activeSideStartedAtMs = occurredAtMillis,
            )
        } else {
            nursing.copy(
                active = true,
                timerStartedAtMs = activeSince,
                leftSeconds = 0L,
                rightSeconds = 0L,
                activeSide = side,
                activeSideStartedAtMs = occurredAtMillis,
            )
        }
        val otherSnapshots = state.snapshots.mapValues { (key, snapshot) ->
            if (key == "bottle") snapshot.copy(active = false, timerStartedAtMs = null) else snapshot
        }
        val message = if (state.activeType == "nursing") {
            "${side.capitalized()} nursing active"
        } else {
            "${side.capitalized()} nursing started"
        }
        return state.copy(
            message = message,
            success = true,
            activeType = "nursing",
            activeSinceMillis = activeSince,
            activeSide = side,
            snapshots = otherSnapshots + ("nursing" to updated),
        )
    }

    private fun optimisticNursingPause(state: WearState, occurredAtMillis: Long): WearState {
        if (state.activeType != "nursing" || state.activeSide == null) {
            return state.copy(message = "Confirming nursing pause...")
        }
        val paused = accrueActiveNursingSide(
            nursingSnapshot(state),
            state,
            occurredAtMillis,
        ).copy(activeSide = null, activeSideStartedAtMs = null)
        return state.copy(
            message = "Nursing paused",
            success = true,
            activeSide = null,
            snapshots = state.snapshots + ("nursing" to paused),
        )
    }

    private fun optimisticNursingStop(state: WearState, occurredAtMillis: Long): WearState {
        if (state.activeType != "nursing") {
            return state.copy(message = "Confirming nursing finish...")
        }
        val stopped = accrueActiveNursingSide(
            nursingSnapshot(state),
            state,
            occurredAtMillis,
        ).copy(
            summary = "Just now",
            detail = "Last nursing",
            active = false,
            lastEventAtMs = occurredAtMillis,
            timerStartedAtMs = null,
            activeSide = null,
            activeSideStartedAtMs = null,
        )
        return state.copy(
            message = "Nursing finished",
            success = true,
            activeType = null,
            activeSinceMillis = null,
            activeSide = null,
            snapshots = state.snapshots + ("nursing" to stopped),
        )
    }

    private fun optimisticTimer(
        state: WearState,
        action: String,
        occurredAtMillis: Long,
    ): WearState {
        val snapshot = state.snapshots[action] ?: WatchActivitySnapshot(
            key = action,
            label = labelFor(action),
            summary = "Not logged yet",
            detail = null,
            active = false,
            lastEventAtMs = null,
            timerStartedAtMs = null,
            leftSeconds = null,
            rightSeconds = null,
            activeSide = null,
            activeSideStartedAtMs = null,
        )
        if (state.activeType == action) {
            val stopped = snapshot.copy(
                summary = "Just now",
                active = false,
                lastEventAtMs = occurredAtMillis,
                timerStartedAtMs = null,
            )
            return state.copy(
                message = "${labelFor(action)} stopped",
                success = true,
                activeType = null,
                activeSinceMillis = null,
                activeSide = null,
                snapshots = state.snapshots + (action to stopped),
            )
        }
        if (state.activeType != null && !(action == "bottle" && state.activeType == "nursing")) {
            return state.copy(message = "Confirming ${labelFor(action).lowercase()}...")
        }
        val updatedSnapshots = state.snapshots.mapValues { (_, value) ->
            if (value.active) value.copy(active = false, timerStartedAtMs = null) else value
        } + (
            action to snapshot.copy(
                active = true,
                timerStartedAtMs = occurredAtMillis,
            )
        )
        return state.copy(
            message = "${labelFor(action)} timer started",
            success = true,
            activeType = action,
            activeSinceMillis = occurredAtMillis,
            activeSide = null,
            snapshots = updatedSnapshots,
        )
    }

    private fun optimisticNappy(
        state: WearState,
        detail: String,
        occurredAtMillis: Long,
    ): WearState {
        val prior = state.snapshots["diaper"] ?: WatchActivitySnapshot(
            key = "diaper",
            label = "Nappy",
            summary = "Not logged yet",
            detail = null,
            active = false,
            lastEventAtMs = null,
            timerStartedAtMs = null,
            leftSeconds = null,
            rightSeconds = null,
            activeSide = null,
            activeSideStartedAtMs = null,
        )
        return state.copy(
            message = "$detail nappy logged",
            success = true,
            snapshots = state.snapshots + (
                "diaper" to prior.copy(
                    summary = "Just now",
                    detail = detail,
                    lastEventAtMs = occurredAtMillis,
                )
            ),
        )
    }

    private fun nursingSnapshot(state: WearState) = state.snapshots["nursing"]
        ?: WatchActivitySnapshot(
            key = "nursing",
            label = "Nursing",
            summary = "Not logged yet",
            detail = null,
            active = false,
            lastEventAtMs = null,
            timerStartedAtMs = null,
            leftSeconds = 0L,
            rightSeconds = 0L,
            activeSide = null,
            activeSideStartedAtMs = null,
        )

    private fun accrueActiveNursingSide(
        snapshot: WatchActivitySnapshot,
        state: WearState,
        occurredAtMillis: Long,
    ): WatchActivitySnapshot {
        val side = state.activeSide ?: return snapshot
        val startedAt = snapshot.activeSideStartedAtMs
            ?: state.activeSinceMillis
            ?: occurredAtMillis
        val elapsedSeconds = ((occurredAtMillis - startedAt).coerceAtLeast(0L) / 1_000L)
        return when (side) {
            "left" -> snapshot.copy(
                leftSeconds = (snapshot.leftSeconds ?: 0L) + elapsedSeconds,
            )
            "right" -> snapshot.copy(
                rightSeconds = (snapshot.rightSeconds ?: 0L) + elapsedSeconds,
            )
            else -> snapshot
        }
    }

    private fun String.capitalized() = replaceFirstChar(Char::uppercase)

    private fun parseSnapshots(raw: String): Map<String, WatchActivitySnapshot> = runCatching {
        val array = JSONArray(raw)
        buildMap {
            for (index in 0 until array.length()) {
                val item = array.getJSONObject(index)
                val key = item.optString("key")
                if (!isSupportedAction(key)) continue
                put(
                    key,
                    WatchActivitySnapshot(
                        key = key,
                        label = item.optString("label", labelFor(key)),
                        summary = item.optString("summary", "Not logged yet"),
                        detail = item.optString("detail").takeIf(String::isNotBlank),
                        active = item.optBoolean("active", false),
                        lastEventAtMs = item.optLong("lastEventAtMs").takeIf { item.has("lastEventAtMs") },
                        timerStartedAtMs = item.optLong("timerStartedAtMs").takeIf { item.has("timerStartedAtMs") },
                        leftSeconds = item.optLong("leftSeconds").takeIf { item.has("leftSeconds") },
                        rightSeconds = item.optLong("rightSeconds").takeIf { item.has("rightSeconds") },
                        activeSide = item.optString("activeSide").takeIf(String::isNotBlank),
                        activeSideStartedAtMs = item.optLong("activeSideStartedAtMs")
                            .takeIf { item.has("activeSideStartedAtMs") },
                    ),
                )
            }
        }
    }.getOrDefault(emptyMap())

    private fun snapshotsJson(snapshots: Map<String, WatchActivitySnapshot>): String {
        val array = JSONArray()
        snapshots.values.forEach { snapshot ->
            array.put(
                JSONObject().apply {
                    put("key", snapshot.key)
                    put("label", snapshot.label)
                    put("summary", snapshot.summary)
                    snapshot.detail?.let { put("detail", it) }
                    put("active", snapshot.active)
                    snapshot.lastEventAtMs?.let { put("lastEventAtMs", it) }
                    snapshot.timerStartedAtMs?.let { put("timerStartedAtMs", it) }
                    snapshot.leftSeconds?.let { put("leftSeconds", it) }
                    snapshot.rightSeconds?.let { put("rightSeconds", it) }
                    snapshot.activeSide?.let { put("activeSide", it) }
                    snapshot.activeSideStartedAtMs?.let { put("activeSideStartedAtMs", it) }
                },
            )
        }
        return array.toString()
    }

    private fun readPendingCommands(
        preferences: android.content.SharedPreferences,
    ): List<PendingWatchCommand> {
        val stored = preferences.getString(PENDING_COMMANDS, null)
        if (stored != null) {
            return runCatching {
                val array = JSONArray(stored)
                buildList {
                    for (index in 0 until array.length()) {
                        val item = array.getJSONObject(index)
                        val id = item.optString("id")
                        val action = item.optString("action")
                        val occurredAtMillis = item.optLong("occurredAtMillis", -1L)
                        if (id.isBlank() || action.isBlank() || occurredAtMillis < 0L) continue
                        add(
                            PendingWatchCommand(
                                id = id,
                                action = action,
                                transportAction = item.optString("transportAction", action),
                                occurredAtMillis = occurredAtMillis,
                                lastAttemptAtMillis = item.optLong(
                                    "lastAttemptAtMillis",
                                    occurredAtMillis,
                                ),
                            ),
                        )
                    }
                }
            }.getOrDefault(emptyList())
        }

        val legacyId = preferences.getString("pendingCommandId", null) ?: return emptyList()
        val legacyAction = preferences.getString("pendingAction", null) ?: return emptyList()
        val occurredAtMillis = preferences.getLong("pendingOccurredAtMillis", -1L)
        if (occurredAtMillis < 0L) return emptyList()
        return listOf(
            PendingWatchCommand(
                id = legacyId,
                action = legacyAction,
                transportAction = preferences.getString("pendingTransportAction", legacyAction)
                    ?: legacyAction,
                occurredAtMillis = occurredAtMillis,
                lastAttemptAtMillis = preferences.getLong(
                    "pendingSinceMillis",
                    occurredAtMillis,
                ),
            ),
        )
    }

    private fun writePendingCommands(
        preferences: android.content.SharedPreferences,
        commands: List<PendingWatchCommand>,
    ) {
        val array = JSONArray()
        commands.forEach { command ->
            array.put(
                JSONObject().apply {
                    put("id", command.id)
                    put("action", command.action)
                    put("transportAction", command.transportAction)
                    put("occurredAtMillis", command.occurredAtMillis)
                    put("lastAttemptAtMillis", command.lastAttemptAtMillis)
                },
            )
        }
        val first = commands.firstOrNull()
        preferences.edit()
            .putString(PENDING_COMMANDS, array.toString())
            .putString("pendingCommandId", first?.id)
            .putString("pendingAction", first?.action)
            .putString("pendingTransportAction", first?.transportAction)
            .putLong("pendingOccurredAtMillis", first?.occurredAtMillis ?: -1L)
            .putLong("pendingSinceMillis", first?.lastAttemptAtMillis ?: -1L)
            .apply()
    }

    fun labelFor(action: String) = when (action) {
        "nursing" -> "Nursing"
        "bottle" -> "Bottle"
        "sleep" -> "Sleep"
        "diaper" -> "Nappy"
        else -> "Care"
    }

    private fun isSupportedAction(action: String) =
        action == "nursing" || action == "bottle" || action == "sleep" || action == "diaper"

    private const val ROLLBACK_PRESENT = "rollbackPresent"
    private const val ROLLBACK_ACTIVE_TYPE = "rollbackActiveType"
    private const val ROLLBACK_ACTIVE_SINCE = "rollbackActiveSinceMillis"
    private const val ROLLBACK_ACTIVE_SIDE = "rollbackActiveSide"
    private const val ROLLBACK_SNAPSHOTS = "rollbackSnapshots"
    private const val PENDING_COMMANDS = "pendingCommands"
    private const val PENDING_TIMEOUT_MILLIS = 8_000L
}
