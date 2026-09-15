package com.cbcreations.babysteps.wear

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMap
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService

class WatchResultListenerService : WearableListenerService() {
    override fun onDataChanged(dataEvents: DataEventBuffer) {
        dataEvents
            .filter { event -> event.type == DataEvent.TYPE_CHANGED }
            .forEach { event ->
                val path = event.dataItem.uri.path ?: return@forEach
                val data = DataMapItem.fromDataItem(event.dataItem).dataMap
                if (path == STATE_PATH) {
                    WearStateStore.writeSnapshot(
                        this,
                        data.getStringArrayList("actions") ?: arrayListOf(),
                        data.getString("snapshotsJson") ?: "[]",
                    )
                    WatchTileUpdater.requestAll(this)
                    return@forEach
                }
                if (!path.startsWith(RESULT_PREFIX)) return@forEach
                handleResult(data)
                Wearable.getDataClient(this).deleteDataItems(event.dataItem.uri)
            }
    }

    override fun onMessageReceived(messageEvent: MessageEvent) {
        if (messageEvent.path != RESULT_MESSAGE_PATH) return
        val data = runCatching { DataMap.fromByteArray(messageEvent.data) }.getOrNull() ?: return
        handleResult(data)
    }

    private fun handleResult(data: DataMap) {
        val previous = WearStateStore.read(this)
        val commandId = data.getString("commandId")
        val completedAtMillis = data.getLong("completedAtMillis")
        if (
            commandId != null &&
            commandId == previous.lastResultCommandId &&
            completedAtMillis == previous.completedAtMillis
        ) {
            return
        }
        val queuedCommand = commandId?.let { id ->
            WearStateStore.pendingCommands(this).any { it.id == id }
        } == true
        val stateIncluded = if (data.containsKey("stateIncluded")) {
            data.getBoolean("stateIncluded")
        } else {
            // Backward compatibility with phone builds from before the protocol flag.
            data.containsKey("babyName") ||
                data.containsKey("activeType") ||
                data.containsKey("activeSinceMillis") ||
                data.containsKey("nursingLeftSeconds")
        }
        if (!stateIncluded) {
            val success = data.getBoolean("success")
            if (!success && queuedCommand) {
                WearStateStore.writeResult(
                    this,
                    previous.copy(
                        success = true,
                        completedAtMillis = completedAtMillis,
                        lastResultCommandId = commandId,
                    ),
                )
                WatchTileUpdater.requestAll(this)
                return
            }
            val remaining = if (success && commandId != null) {
                WearStateStore.acknowledge(this, commandId)
            } else {
                WearStateStore.pendingCommands(this)
            }
            val nextPending = remaining.firstOrNull()
            WearStateStore.writeResult(
                this,
                previous.copy(
                    message = data.getString("message") ?: previous.message,
                    success = success,
                    completedAtMillis = completedAtMillis,
                    lastResultCommandId = commandId,
                    pendingCommandId = nextPending?.id,
                    pendingAction = nextPending?.action,
                    pendingTransportAction = nextPending?.transportAction,
                    pendingOccurredAtMillis = nextPending?.occurredAtMillis,
                    pendingSinceMillis = nextPending?.lastAttemptAtMillis,
                    pendingCount = remaining.size,
                ),
            )
            vibrate(success)
            WatchTileUpdater.requestAll(this)
            return
        }
        val remaining = if (commandId != null) {
            WearStateStore.acknowledge(this, commandId)
        } else {
            WearStateStore.pendingCommands(this)
        }
        val nextPending = remaining.firstOrNull()
        if (remaining.isNotEmpty()) {
            WearStateStore.writeResult(
                this,
                previous.copy(
                    message = if (remaining.size == 1) {
                        "Saved on watch - syncing"
                    } else {
                        "Saved on watch - ${remaining.size} to sync"
                    },
                    success = true,
                    completedAtMillis = completedAtMillis,
                    lastResultCommandId = commandId,
                    pendingCommandId = nextPending?.id,
                    pendingAction = nextPending?.action,
                    pendingTransportAction = nextPending?.transportAction,
                    pendingOccurredAtMillis = nextPending?.occurredAtMillis,
                    pendingSinceMillis = nextPending?.lastAttemptAtMillis,
                    pendingCount = remaining.size,
                ),
            )
            vibrate(true)
            WatchTileUpdater.requestAll(this)
            return
        }
        val activeSince = data.getLong("activeSinceMillis", -1L)
        val activeType = data.getString("activeType")
        val activeSide = data.getString("activeSide")
        val priorNursing = previous.snapshots["nursing"]
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
        val updatedNursing = priorNursing.copy(
            active = activeType == "nursing",
            lastEventAtMs = data.getLong("nursingLastAtMillis", -1L)
                .takeIf { it >= 0L } ?: priorNursing.lastEventAtMs,
            timerStartedAtMs = activeSince.takeIf { activeType == "nursing" && it >= 0L },
            leftSeconds = data.getLong("nursingLeftSeconds", priorNursing.leftSeconds ?: 0L),
            rightSeconds = data.getLong("nursingRightSeconds", priorNursing.rightSeconds ?: 0L),
            activeSide = activeSide.takeIf { activeType == "nursing" },
            activeSideStartedAtMs = data.getLong("activeSideStartedAtMillis", -1L)
                .takeIf { activeType == "nursing" && it >= 0L },
        )
        WearStateStore.writeResult(
            this,
            previous.copy(
                message = data.getString("message") ?: "Care updated",
                success = data.getBoolean("success"),
                completedAtMillis = completedAtMillis,
                lastResultCommandId = commandId,
                babyName = data.getString("babyName") ?: previous.babyName,
                activeType = activeType,
                activeSinceMillis = activeSince.takeIf { it >= 0L },
                activeSide = activeSide,
                pendingCommandId = null,
                pendingAction = null,
                pendingTransportAction = null,
                pendingOccurredAtMillis = null,
                pendingSinceMillis = null,
                pendingCount = 0,
                snapshots = previous.snapshots + ("nursing" to updatedNursing),
            ),
        )
        vibrate(data.getBoolean("success"))
        WatchTileUpdater.requestAll(this)
    }

    private fun vibrate(success: Boolean) {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService(VibratorManager::class.java).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        val pattern = if (success) longArrayOf(0, 45) else longArrayOf(0, 80, 80, 80)
        vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
    }

    companion object {
        private const val RESULT_PREFIX = "/pitterpatter/results/"
        private const val RESULT_MESSAGE_PATH = "/pitterpatter/messages/result"
        private const val STATE_PATH = "/pitterpatter/state/snapshot"
    }
}
