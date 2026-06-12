# patch-package patches

Applied automatically by `npm install` via the `postinstall` script
(`node scripts/fix-expo-sqlite.js && patch-package`). Each patch exists for a
specific upstream gap; re-test the matching scenario before deleting one after
a dependency upgrade.

## `@react-native+gradle-plugin+0.83.6.patch`

Bumps the `org.gradle.toolchains.foojay-resolver-convention` plugin from
0.5.0 to 0.9.0 in the React Native Gradle plugin's `settings.gradle.kts`.
The 0.5.0 version fails to resolve JDK toolchains with the Gradle version
used by this project's Android build. Remove once React Native ships a
gradle-plugin that already references >= 0.9.0.

## `@react-native-voice+voice+3.2.4.patch`

Two Android build fixes for an unmaintained upstream:

- Replaces the defunct `jcenter()` repository with `mavenCentral()` (JCenter
  was sunset; dependency resolution fails without this).
- Renames `compileSdkVersion` to `compileSdk` for compatibility with the
  Android Gradle Plugin 8+ used by this Expo SDK.

Remove only if the voice module is replaced or upstream publishes a release
with AGP 8 support.

## `expo-modules-core+55.0.25.patch`

Adds the prebuilt `expo-module-gradle-plugin` descriptor files
(`pluginDescriptors` / `META-INF/gradle-plugins` properties) that are missing
from the published npm artifact, and patches `MavenPublicationExtension.kt`
so the Expo modules Gradle plugin resolves during `expo prebuild` /
`expo run:android`. Without this, Android builds fail to locate
`expo.modules.plugin.ExpoModulesGradlePlugin`. Re-check after every Expo SDK
upgrade — this is the patch most likely to become unnecessary.
