# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# React Native Skia
-keep class com.shopify.reactnative.skia.** { *; }

# Keep Android classes used via reflection (React Native new architecture / Expo)
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Expo / SQLite
-keep class expo.modules.** { *; }

# llama.rn / native model bridges
-keep class com.rnllama.** { *; }

# LiteRT-LM is loaded from HakiLiteRtLmModule through reflection so Gemma
# runtime classes must survive release shrinking in EAS preview APKs.
-keep class com.google.ai.edge.litertlm.** { *; }
-keepclassmembers class com.google.ai.edge.litertlm.** { *; }

# Haki native modules (bundled GGUF copy, device profile)
-keep class com.tupt.haki.** { *; }

# Prevent stripping of serialization used by some native modules
-keepattributes Signature,*Annotation*,EnclosingMethod,InnerClasses
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod <methods>;
}
