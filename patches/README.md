# patch-package patches

These patches run from `postinstall`. Re-test the matching Android build issue
before removing one after a dependency upgrade.

## `@react-native+gradle-plugin+0.83.6.patch`

Updates the Foojay resolver plugin for the Gradle/JDK toolchain used by this
project.

## `@react-native-voice+voice+3.2.4.patch`

Replaces the retired JCenter repository and updates the Android Gradle Plugin
compile-SDK property used by the unmaintained voice dependency.

## `expo-modules-core+55.0.25.patch`

Restores missing Expo module Gradle-plugin descriptors and publication wiring
required by native Android builds. Re-check this patch after every Expo SDK
upgrade.
