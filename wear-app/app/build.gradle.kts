plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.cbcreations.babysteps"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.cbcreations.babysteps"
        minSdk = 30
        targetSdk = 36
        versionCode = 360020003
        versionName = "0.2.0-watch.3"
    }

    signingConfigs {
        getByName("debug") {
            storeFile = rootProject.file("../android/app/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
        create("release") {
            val keystorePath = System.getenv("BABYSTEPS_KEYSTORE_PATH")
            if (!keystorePath.isNullOrBlank()) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("BABYSTEPS_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("BABYSTEPS_KEY_ALIAS")
                keyPassword = System.getenv("BABYSTEPS_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.06.00"))
    implementation("androidx.activity:activity-compose:1.12.4")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.wear.compose:compose-foundation:1.6.2")
    implementation("androidx.wear.compose:compose-material:1.6.2")
    implementation("androidx.wear.tiles:tiles:1.6.2")
    implementation("androidx.wear.protolayout:protolayout:1.4.2")
    implementation("androidx.wear.protolayout:protolayout-expression:1.4.2")
    implementation("androidx.wear.protolayout:protolayout-material:1.4.2")
    implementation("com.google.android.gms:play-services-wearable:20.0.1")
    implementation("com.google.guava:guava:33.4.8-android")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.wear.tiles:tiles-renderer:1.6.2")
}
