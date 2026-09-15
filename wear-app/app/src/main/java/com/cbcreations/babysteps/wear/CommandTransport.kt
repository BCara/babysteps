package com.cbcreations.babysteps.wear

import android.content.Context
import com.google.android.gms.wearable.DataMap
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import java.util.UUID

object CommandTransport {
    private const val COMMAND_PREFIX = "/pitterpatter/commands/"
    private const val COMMAND_MESSAGE_PATH = "/pitterpatter/messages/command"

    fun send(context: Context, action: String, onComplete: (Result<String>) -> Unit): String {
        val commandId = UUID.randomUUID().toString()
        val occurredAtMillis = System.currentTimeMillis()
        val transportAction = transportActionFor(WearStateStore.read(context), action)
        WearStateStore.markPending(
            context,
            commandId,
            action,
            transportAction,
            occurredAtMillis,
        )
        dispatch(context, commandId, transportAction, occurredAtMillis, onComplete)
        return commandId
    }

    fun retryPending(context: Context, onComplete: (Result<String>) -> Unit): Boolean {
        val pending = WearStateStore.pendingCommands(context).firstOrNull() ?: return false
        WearStateStore.markRetryAttempt(context, pending.id)
        dispatch(context, pending.id, pending.transportAction, pending.occurredAtMillis, onComplete)
        return true
    }

    fun flushPending(context: Context) {
        WearStateStore.pendingCommands(context).forEach { pending ->
            WearStateStore.markRetryAttempt(context, pending.id)
            dispatch(
                context,
                pending.id,
                pending.transportAction,
                pending.occurredAtMillis,
            ) {}
        }
    }

    private fun transportActionFor(state: WearState, action: String): String = when {
        action == "nursing_left" &&
            state.activeType == "nursing" &&
            state.activeSide == "left" -> "nursing_pause"
        action == "nursing_right" &&
            state.activeType == "nursing" &&
            state.activeSide == "right" -> "nursing_pause"
        else -> action
    }

    private fun dispatch(
        context: Context,
        commandId: String,
        action: String,
        occurredAtMillis: Long,
        onComplete: (Result<String>) -> Unit,
    ) {
        val request = PutDataMapRequest.create("$COMMAND_PREFIX$commandId").apply {
            dataMap.putString("commandId", commandId)
            dataMap.putString("action", action)
            dataMap.putLong("occurredAtMillis", occurredAtMillis)
            // Updating this value makes an existing queued DataItem deliver again after
            // either device or the phone's internet connection comes back.
            dataMap.putLong("attemptAtMillis", System.currentTimeMillis())
        }.asPutDataRequest().setUrgent()

        // MessageClient is the low-latency path while the paired phone is reachable.
        // The urgent DataItem remains the durable fallback for brief disconnections.
        val message = DataMap().apply {
            putString("commandId", commandId)
            putString("action", action)
            putLong("occurredAtMillis", occurredAtMillis)
        }.toByteArray()
        Wearable.getNodeClient(context).connectedNodes.addOnSuccessListener { nodes ->
            nodes.forEach { node ->
                Wearable.getMessageClient(context)
                    .sendMessage(node.id, COMMAND_MESSAGE_PATH, message)
            }
        }

        Wearable.getDataClient(context).putDataItem(request)
            .addOnSuccessListener { onComplete(Result.success(commandId)) }
            .addOnFailureListener {
                WearStateStore.markTransportFailure(context, commandId)
                WatchTileUpdater.requestAll(context)
                onComplete(Result.failure(it))
            }
    }
}
