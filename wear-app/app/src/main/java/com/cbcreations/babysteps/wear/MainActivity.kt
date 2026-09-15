package com.cbcreations.babysteps.wear

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            var state by remember { mutableStateOf(WearStateStore.read(this)) }
            LaunchedEffect(Unit) {
                CommandTransport.flushPending(this@MainActivity)
                CommandTransport.send(this@MainActivity, "sync") {}
                while (true) {
                    state = WearStateStore.read(this@MainActivity)
                    delay(500)
                }
            }
            MaterialTheme {
                ScalingLazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    item { Text("PitterPatter", color = Color(0xFFFFB5A7)) }
                    items(state.actions) { action ->
                        Chip(
                            modifier = Modifier.fillMaxWidth(0.82f),
                            onClick = {
                                startActivity(
                                    Intent(this@MainActivity, ActionActivity::class.java)
                                        .putExtra(ActionActivity.EXTRA_ACTION, action),
                                )
                            },
                            label = { Text(WearStateStore.labelFor(action)) },
                            secondaryLabel = {
                                Text(state.snapshots[action]?.summary ?: "Tap for details")
                            },
                        )
                    }
                    if (state.pendingCount > 0) {
                        item {
                            Text(
                                if (state.pendingCount == 1) "1 action saved · syncing" else "${state.pendingCount} actions saved · syncing",
                                color = Color(0xFFA9DEF9),
                            )
                        }
                    }
                }
            }
        }
    }
}
