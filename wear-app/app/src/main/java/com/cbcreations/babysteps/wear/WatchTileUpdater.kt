package com.cbcreations.babysteps.wear

import android.content.Context
import androidx.wear.tiles.TileService

object WatchTileUpdater {
    private val services = listOf(
        QuickCareTileService::class.java,
        NursingTileService::class.java,
        BottleTileService::class.java,
        SleepTileService::class.java,
        NappyTileService::class.java,
    )

    fun requestAll(context: Context) {
        val updater = TileService.getUpdater(context)
        services.forEach(updater::requestUpdate)
    }
}
