const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins');

const NATIVE_DEPENDENCIES = [
  'implementation(platform("com.google.firebase:firebase-bom:34.15.0"))',
  'implementation("com.google.firebase:firebase-functions")',
  'implementation("com.google.android.gms:play-services-wearable:20.0.1")',
];
const SERVICE_NAME = '.WatchCommandListenerService';

const stateSyncSource = packageName => `package ${packageName}

import android.content.Context
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable

object WatchStateSync {
  private const val STATE_PATH = "/pitterpatter/state/snapshot"

  fun push(context: Context) {
    val request = PutDataMapRequest.create(STATE_PATH).apply {
      dataMap.putStringArrayList("actions", ArrayList(WidgetPreferences.watchActions(context)))
      dataMap.putString("snapshotsJson", WidgetPreferences.snapshotsJson(context))
      dataMap.putLong("syncedAtMillis", System.currentTimeMillis())
    }.asPutDataRequest().setUrgent()
    Wearable.getDataClient(context).putDataItem(request)
  }
}
`;

const listenerSource = packageName => `package ${packageName}

import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMap
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import com.google.firebase.functions.FirebaseFunctions
import java.util.concurrent.Executors

class WatchCommandListenerService : WearableListenerService() {
  data class WatchCommand(
    val id: String,
    val action: String,
    val occurredAtMillis: Long,
    val uri: android.net.Uri?,
  )

  data class CachedResult(
    val success: Boolean,
    val message: String,
    val result: Map<String, Any?>,
    val stateIncluded: Boolean,
    val completedAtMillis: Long,
  )

  override fun onDataChanged(dataEvents: DataEventBuffer) {
    val commands = dataEvents
      .filter { event ->
        event.type == DataEvent.TYPE_CHANGED &&
          event.dataItem.uri.path?.startsWith(COMMAND_PREFIX) == true
      }
      .mapNotNull { event ->
        val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
        val id = dataMap.getString("commandId") ?: return@mapNotNull null
        val action = dataMap.getString("action") ?: return@mapNotNull null
        WatchCommand(
          id = id,
          action = action,
          occurredAtMillis = dataMap.getLong("occurredAtMillis"),
          uri = event.dataItem.uri,
        )
      }
      .sortedBy { it.occurredAtMillis }

    commands.forEach { command ->
      executor.submit { process(command) }
    }
  }

  override fun onMessageReceived(messageEvent: MessageEvent) {
    if (messageEvent.path != COMMAND_MESSAGE_PATH) return
    val dataMap = runCatching { DataMap.fromByteArray(messageEvent.data) }.getOrNull() ?: return
    val id = dataMap.getString("commandId") ?: return
    val action = dataMap.getString("action") ?: return
    executor.submit {
      process(
        WatchCommand(
          id = id,
          action = action,
          occurredAtMillis = dataMap.getLong("occurredAtMillis"),
          uri = null,
        ),
      )
    }
  }

  private fun process(command: WatchCommand) {
    val dataClient = Wearable.getDataClient(this)
    cachedResult(command.id)?.let { cached ->
      sendResult(
        command.id,
        cached.success,
        cached.message,
        cached.result,
        cached.stateIncluded,
        cached.completedAtMillis,
      )
      command.uri?.let { Tasks.await(dataClient.deleteDataItems(it)) }
      return
    }
    try {
      if (command.action == "sync") {
        WatchStateSync.push(this)
        sendResult(command.id, true, "Synced from phone", emptyMap(), false)
        command.uri?.let { Tasks.await(dataClient.deleteDataItems(it)) }
        return
      }
      val callableResult = Tasks.await(
        FirebaseFunctions.getInstance(REGION)
          .getHttpsCallable(FUNCTION_NAME)
          .call(
            mapOf(
              "commandId" to command.id,
              "action" to command.action,
              "occurredAtMillis" to command.occurredAtMillis,
            ),
          ),
      )
      @Suppress("UNCHECKED_CAST")
      val result = callableResult.data as? Map<String, Any?> ?: emptyMap()
      sendResult(
        command.id,
        true,
        result["message"] as? String ?: "Care updated",
        result,
        true,
      )
      command.uri?.let { Tasks.await(dataClient.deleteDataItems(it)) }
    } catch (error: Exception) {
      val message = error.cause?.message
        ?: error.message
        ?: "Saved on watch. Waiting to sync."
      sendResult(command.id, false, message, emptyMap(), false, cache = false)
      // Keep care DataItems queued so the watch can re-deliver the same idempotent
      // command after the phone or its internet connection becomes available.
      if (command.action == "sync") {
        command.uri?.let { Tasks.await(dataClient.deleteDataItems(it)) }
      }
    }
  }

  private fun sendResult(
    commandId: String,
    success: Boolean,
    message: String,
    result: Map<String, Any?>,
    stateIncluded: Boolean,
    completedAtMillis: Long = System.currentTimeMillis(),
    cache: Boolean = true,
  ) {
    if (cache) {
      cacheResult(
        commandId,
        CachedResult(success, message, result, stateIncluded, completedAtMillis),
      )
    }
    val resultData = DataMap().apply {
      putString("commandId", commandId)
      putBoolean("success", success)
      putString("message", message.take(180))
      putLong("completedAtMillis", completedAtMillis)
      putBoolean("stateIncluded", stateIncluded)
      (result["babyName"] as? String)?.let { putString("babyName", it) }
      (result["activeType"] as? String)?.let { putString("activeType", it) }
      (result["activeSide"] as? String)?.let { putString("activeSide", it) }
      (result["activeSinceMillis"] as? Number)?.let {
        putLong("activeSinceMillis", it.toLong())
      }
      listOf(
        "activeSideStartedAtMillis",
        "nursingLastAtMillis",
        "nursingLeftSeconds",
        "nursingRightSeconds",
      ).forEach { name ->
        (result[name] as? Number)?.let { putLong(name, it.toLong()) }
      }
    }
    val request = PutDataMapRequest.create("$RESULT_PREFIX$commandId").apply {
      dataMap.putAll(resultData)
    }.asPutDataRequest().setUrgent()

    // Return the acknowledgement over the fast path as well as the durable DataItem.
    runCatching {
      val nodes = Tasks.await(Wearable.getNodeClient(this).connectedNodes)
      nodes.forEach { node ->
        Tasks.await(
          Wearable.getMessageClient(this)
            .sendMessage(node.id, RESULT_MESSAGE_PATH, resultData.toByteArray()),
        )
      }
    }
    Tasks.await(Wearable.getDataClient(this).putDataItem(request))
  }

  private fun cachedResult(commandId: String): CachedResult? = synchronized(recentResults) {
    recentResults[commandId]
  }

  private fun cacheResult(commandId: String, result: CachedResult) = synchronized(recentResults) {
    recentResults[commandId] = result
  }

  companion object {
    private const val REGION = "australia-southeast1"
    private const val FUNCTION_NAME = "watch_executeCareCommand"
    private const val COMMAND_PREFIX = "/pitterpatter/commands/"
    private const val RESULT_PREFIX = "/pitterpatter/results/"
    private const val COMMAND_MESSAGE_PATH = "/pitterpatter/messages/command"
    private const val RESULT_MESSAGE_PATH = "/pitterpatter/messages/result"
    private val executor = Executors.newSingleThreadExecutor()
    private val recentResults = object : LinkedHashMap<String, CachedResult>(64, 0.75f, true) {
      override fun removeEldestEntry(
        eldest: MutableMap.MutableEntry<String, CachedResult>?,
      ): Boolean = size > 100
    }
  }
}
`;

const addService = manifest => {
  const application = manifest.manifest.application?.[0];
  if (!application) return manifest;
  application.service = application.service || [];
  let service = application.service.find(
    service => service.$?.['android:name'] === SERVICE_NAME,
  );
  if (!service) {
    service = {
      $: {
        'android:name': SERVICE_NAME,
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'com.google.android.gms.wearable.DATA_CHANGED' } },
          ],
          data: [
            {
              $: {
                'android:scheme': 'wear',
                'android:host': '*',
                'android:pathPrefix': '/pitterpatter/commands',
              },
            },
          ],
        },
      ],
    };
    application.service.push(service);
  }
  service['intent-filter'] = service['intent-filter'] || [];
  const hasMessageFilter = service['intent-filter'].some(filter =>
    filter.action?.some(
      action => action.$?.['android:name'] === 'com.google.android.gms.wearable.MESSAGE_RECEIVED',
    ),
  );
  if (!hasMessageFilter) {
    service['intent-filter'].push({
      action: [
        { $: { 'android:name': 'com.google.android.gms.wearable.MESSAGE_RECEIVED' } },
      ],
      data: [
        {
          $: {
            'android:scheme': 'wear',
            'android:host': '*',
            'android:pathPrefix': '/pitterpatter/messages',
          },
        },
      ],
    });
  }
  return manifest;
};

module.exports = config => {
  config = withAppBuildGradle(config, nextConfig => {
    const missingDependencies = NATIVE_DEPENDENCIES.filter(
      dependency => !nextConfig.modResults.contents.includes(dependency),
    );
    if (missingDependencies.length) {
      nextConfig.modResults.contents = nextConfig.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    ${missingDependencies.join('\n    ')}`,
      );
    }
    return nextConfig;
  });

  config = withAndroidManifest(config, nextConfig => {
    nextConfig.modResults = addService(nextConfig.modResults);
    return nextConfig;
  });

  config = withDangerousMod(config, [
    'android',
    async nextConfig => {
      const packageName = nextConfig.android?.package;
      if (!packageName) {
        throw new Error('Wear bridge requires expo.android.package.');
      }
      const javaDirectory = path.join(
        nextConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        ...packageName.split('.'),
      );
      fs.mkdirSync(javaDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(javaDirectory, 'WatchCommandListenerService.kt'),
        listenerSource(packageName),
      );
      fs.writeFileSync(
        path.join(javaDirectory, 'WatchStateSync.kt'),
        stateSyncSource(packageName),
      );
      return nextConfig;
    },
  ]);

  return config;
};
