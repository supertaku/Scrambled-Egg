const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../node_modules/expo-sqlite/android/build.gradle');

if (fs.existsSync(targetFile)) {
    console.log('Applying robust fix to expo-sqlite build.gradle...');
    let content = fs.readFileSync(targetFile, 'utf8');

    // 1. Fix Windows path separators in NDK build
    content = content.replace(
        /arguments "-DSQLITE3_SRC_DIR=\${SQLITE3_SRC_DIR.absolutePath}"/g,
        'arguments "-DSQLITE3_SRC_DIR=${SQLITE3_SRC_DIR.absolutePath.replace(\'\\\\\', \'/\')}"'
    );

    // 2. Ensure expo-module-gradle-plugin is applied at the top to avoid New Arch conflicts
    if (content.includes("apply plugin: 'expo-module-gradle-plugin'") && !content.startsWith("import")) {
        // Only move it if it's not already at the top (after imports)
        content = content.replace("apply plugin: 'expo-module-gradle-plugin'", "");
        const lines = content.split('\n');
        let insertIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('apply plugin: \'com.android.library\'')) {
                insertIndex = i + 1;
                break;
            }
        }
        lines.splice(insertIndex, 0, "apply plugin: 'expo-module-gradle-plugin'");
        content = lines.join('\n');
    }

    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('Successfully patched expo-sqlite.');
} else {
    console.warn('expo-sqlite build.gradle not found, skipping patch.');
}
