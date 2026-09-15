package com.cbcreations.babysteps.wear

import android.content.Intent
import android.os.Bundle
import android.view.HapticFeedbackConstants
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import kotlinx.coroutines.delay
import java.util.concurrent.TimeUnit

class ActionActivity : ComponentActivity() {
    private var selectedAction by mutableStateOf("nursing")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        selectedAction = actionFrom(intent)
        setContent {
            val action = selectedAction
            key(action) {
                var state by remember { mutableStateOf(WearStateStore.read(this)) }
                var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
                var status by remember { mutableStateOf("") }
                var lastRetryAt by remember { mutableLongStateOf(0L) }

                LaunchedEffect(Unit) {
                    CommandTransport.flushPending(this@ActionActivity)
                    CommandTransport.send(this@ActionActivity, "sync") {}
                    while (true) {
                        val nextState = WearStateStore.read(this@ActionActivity)
                        when {
                            nextState.completedAtMillis > state.completedAtMillis -> {
                                status = nextState.message
                            }
                            state.pendingAction != null && nextState.pendingAction == null -> {
                                status = nextState.message
                            }
                        }
                        state = nextState
                        now = System.currentTimeMillis()
                        if (nextState.pendingTimedOut && now - lastRetryAt >= 15_000L) {
                            lastRetryAt = now
                            CommandTransport.flushPending(this@ActionActivity)
                        }
                        delay(50)
                    }
                }

                val pending = state.pendingCount > 0

                MaterialTheme {
                    ScalingLazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    autoCentering = null,
                    contentPadding = PaddingValues(top = 24.dp, bottom = 24.dp),
                    ) {
                    item {
                        Text(
                            WearStateStore.labelFor(action),
                            color = colorFor(action),
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.title2,
                        )
                    }
                    item {
                        Text(
                            headline(action, state, now),
                            style = MaterialTheme.typography.caption1,
                        )
                    }

                    if (action == "nursing") {
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(0.82f),
                                horizontalArrangement = Arrangement.SpaceEvenly,
                            ) {
                                Text("Left ${formatDuration(sideSeconds("left", state, now))}")
                                Text("Right ${formatDuration(sideSeconds("right", state, now))}")
                            }
                        }
                        item {
                            Text("Start nursing", style = MaterialTheme.typography.caption2)
                        }
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(0.82f),
                                horizontalArrangement = Arrangement.Center,
                            ) {
                                Chip(
                                    modifier = Modifier.weight(1f),
                                    onClick = { send("nursing_left") { status = it } },
                                    label = { Text("Left") },
                                )
                                Spacer(Modifier.width(6.dp))
                                Chip(
                                    modifier = Modifier.weight(1f),
                                    onClick = { send("nursing_right") { status = it } },
                                    label = { Text("Right") },
                                )
                            }
                        }
                        if (state.activeType == "nursing") {
                            item {
                                Row(
                                    modifier = Modifier.fillMaxWidth(0.82f),
                                    horizontalArrangement = Arrangement.Center,
                                ) {
                                    Chip(
                                        modifier = Modifier.weight(1f),
                                        onClick = { send("nursing_pause") { status = it } },
                                        label = { Text(if (state.activeSide == null) "Paused" else "Pause") },
                                    )
                                    Spacer(Modifier.width(6.dp))
                                    Chip(
                                        modifier = Modifier.weight(1f),
                                        onClick = { send("nursing_stop") { status = it } },
                                        label = { Text("Done") },
                                    )
                                }
                            }
                        }
                    } else if (action == "diaper") {
                        item {
                            Text("Log nappy", style = MaterialTheme.typography.caption2)
                        }
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(0.86f),
                                horizontalArrangement = Arrangement.SpaceEvenly,
                            ) {
                                listOf(
                                    "diaper_wet" to "Wet",
                                    "diaper_dirty" to "Dirty",
                                    "diaper_both" to "Both",
                                ).forEach { (command, label) ->
                                    Button(
                                        onClick = { send(command) { status = it } },
                                    ) {
                                        Text(label, style = MaterialTheme.typography.caption2)
                                    }
                                }
                            }
                        }
                    } else {
                        item {
                            val active = state.activeType == action
                            CareChip(
                                if (active) "Stop ${WearStateStore.labelFor(action).lowercase()}" else "Start ${WearStateStore.labelFor(action).lowercase()}",
                            ) {
                                send(action) { status = it }
                            }
                        }
                    }

                    if (state.snapshots[action]?.detail != null) {
                        item {
                            Text(
                                state.snapshots.getValue(action).detail.orEmpty(),
                                style = MaterialTheme.typography.caption2,
                            )
                        }
                    }
                    val visibleStatus = when {
                        pending -> state.message
                        else -> status
                    }
                    if (visibleStatus.isNotBlank()) {
                        item { Text(visibleStatus, style = MaterialTheme.typography.caption2) }
                    }
                    if (pending) {
                        item {
                            Text(
                                if (state.pendingCount == 1) "Saved on watch · syncing" else "Saved on watch · ${state.pendingCount} to sync",
                                color = Color(0xFFA9DEF9),
                                style = MaterialTheme.typography.caption2,
                            )
                        }
                    }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        selectedAction = actionFrom(intent)
    }

    private fun actionFrom(intent: Intent): String =
        intent.getStringExtra(EXTRA_ACTION)
            ?.takeIf { it in SUPPORTED_ACTIONS }
            ?: "nursing"

    @androidx.compose.runtime.Composable
    private fun CareChip(label: String, onClick: () -> Unit) {
        Chip(
            modifier = Modifier.fillMaxWidth(0.78f),
            onClick = onClick,
            label = { Text(label) },
        )
    }

    private fun send(command: String, updateStatus: (String) -> Unit) {
        window.decorView.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
        updateStatus("")
        CommandTransport.send(this, command) { result ->
            if (result.isFailure) {
                runOnUiThread { updateStatus("Saved on watch · sync will retry") }
            }
        }
    }

    private fun headline(action: String, state: WearState, now: Long): String {
        if (state.activeType == action) {
            if (
                action == "nursing" &&
                state.activeSide == null &&
                state.snapshots[action]?.active == true
            ) {
                val elapsed = state.activeSinceMillis?.let {
                    formatDuration((now - it).coerceAtLeast(0L) / 1_000)
                } ?: "active"
                return "Nursing paused - $elapsed"
            }
            val elapsed = state.activeSinceMillis?.let { formatDuration((now - it) / 1_000) }
                ?: "active"
            return when (action) {
                "nursing" -> "${state.activeSide?.replaceFirstChar(Char::uppercase) ?: "Nursing"} active - $elapsed"
                "sleep" -> "Sleeping - $elapsed"
                else -> "Running - $elapsed"
            }
        }
        val snapshot = state.snapshots[action]
        val since = snapshot?.lastEventAtMs?.let { elapsedSince(it, now) }
            ?: snapshot?.summary
            ?: "Not logged yet"
        return when (action) {
            "nursing" -> "Last feed $since"
            "bottle" -> "Last bottle $since"
            "sleep" -> "Last sleep $since"
            else -> "Last nappy $since"
        }
    }

    private fun sideSeconds(side: String, state: WearState, now: Long): Long {
        val snapshot = state.snapshots["nursing"]
        val stored = if (side == "left") snapshot?.leftSeconds else snapshot?.rightSeconds
        if (state.activeType != "nursing" || state.activeSide != side) return stored ?: 0L
        val started = snapshot?.activeSideStartedAtMs ?: state.activeSinceMillis ?: now
        return (stored ?: 0L) + TimeUnit.MILLISECONDS.toSeconds((now - started).coerceAtLeast(0L))
    }

    private fun elapsedSince(whenMillis: Long, now: Long): String {
        val minutes = TimeUnit.MILLISECONDS.toMinutes((now - whenMillis).coerceAtLeast(0L))
        return when {
            minutes >= 60 -> "${minutes / 60}h ${minutes % 60}m ago"
            minutes > 0 -> "${minutes}m ago"
            else -> "just now"
        }
    }

    private fun formatDuration(seconds: Long): String =
        "%d:%02d".format(seconds / 60, seconds % 60)

    private fun colorFor(action: String) = when (action) {
        "sleep" -> Color(0xFFA9DEF9)
        "diaper" -> Color(0xFFD3F8E2)
        else -> Color(0xFFFFB5A7)
    }

    companion object {
        const val EXTRA_ACTION = "action"
        private val SUPPORTED_ACTIONS = setOf("nursing", "bottle", "sleep", "diaper")
    }
}
