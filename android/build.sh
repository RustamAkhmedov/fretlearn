#!/usr/bin/env bash
# Baut android/build/fretlearn.apk – ohne Gradle, direkt mit den SDK-Tools.
# Die Web-App (index.html, css, js, icons) wird 1:1 als assets/www eingepackt.
#   android/build.sh            nur bauen
#   android/build.sh install    bauen + per adb aufs Handy
set -euo pipefail
cd "$(dirname "$0")"
ROOT=..
SDK=${ANDROID_HOME:-$HOME/Android/Sdk}
BT=$(ls -d "$SDK"/build-tools/* | sort -V | tail -1)
JAR=$(ls -d "$SDK"/platforms/android-* | sort -V | tail -1)/android.jar
KS=$HOME/.android/fretlearn.jks   # gleicher Schlüssel für jedes Update – nicht löschen!
KSPASS=fretlearn
OUT=build

rm -rf "$OUT" && mkdir -p "$OUT"/{assets/www,gen,classes,dex}
cp -r "$ROOT"/index.html "$ROOT"/manifest.webmanifest "$ROOT"/css "$ROOT"/js "$ROOT"/icons "$OUT"/assets/www/

VCODE=$(( $(date +%s) / 60 ))   # steigt mit jedem Build
VNAME="1.0-$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo dev)$(git -C "$ROOT" diff --quiet 2>/dev/null || echo +)"

"$BT"/aapt2 compile --dir res -o "$OUT"/res.zip
"$BT"/aapt2 link -I "$JAR" --manifest AndroidManifest.xml -A "$OUT"/assets -o "$OUT"/base.apk "$OUT"/res.zip \
  --java "$OUT"/gen --min-sdk-version 26 --target-sdk-version 36 --version-code "$VCODE" --version-name "$VNAME"
javac --release 11 -cp "$JAR" -d "$OUT"/classes \
  $(find src "$OUT"/gen -name '*.java')
"$BT"/d8 --release --min-api 26 --lib "$JAR" --output "$OUT"/dex $(find "$OUT"/classes -name '*.class')
(cd "$OUT"/dex && zip -q ../base.apk classes.dex)
"$BT"/zipalign -f -p 4 "$OUT"/base.apk "$OUT"/aligned.apk

if [ ! -f "$KS" ]; then
  mkdir -p "$(dirname "$KS")"
  keytool -genkeypair -keystore "$KS" -storepass "$KSPASS" -keypass "$KSPASS" -alias fretlearn \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=fretlearn"
fi
"$BT"/apksigner sign --ks "$KS" --ks-pass pass:"$KSPASS" --out "$OUT"/fretlearn.apk "$OUT"/aligned.apk
echo "→ $(realpath "$OUT"/fretlearn.apk) ($VNAME)"

if [ "${1:-}" = install ]; then
  adb install -r "$OUT"/fretlearn.apk
fi
