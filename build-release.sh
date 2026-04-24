#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_JSON_PATH="$ROOT_DIR/app.json"
EAS_JSON_PATH="$ROOT_DIR/eas.json"
PACKAGE_JSON_PATH="$ROOT_DIR/package.json"

fail() {
  printf '\nError: %s\n' "$1" >&2
  exit 1
}

is_valid_version() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

read_json_value() {
  local file_path="$1"
  local expression="$2"

  node -e '
    const fs = require("fs");
    const filePath = process.argv[1];
    const expression = process.argv[2];
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const value = expression
      .split(".")
      .filter(Boolean)
      .reduce((current, key) => current?.[key], data);

    if (value === undefined || value === null) {
      process.exit(2);
    }

    if (typeof value === "object") {
      process.stdout.write(JSON.stringify(value));
    } else {
      process.stdout.write(String(value));
    }
  ' "$file_path" "$expression"
}

write_app_version() {
  local version="$1"

  node -e '
    const fs = require("fs");
    const filePath = process.argv[1];
    const version = process.argv[2];
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    data.expo.version = version;
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
  ' "$APP_JSON_PATH" "$version"
}

prompt_for_version() {
  local current_version="$1"
  local new_version

  while true; do
    read -r -p "Enter the new app version (current: $current_version): " new_version

    if [[ -z "$new_version" ]]; then
      printf 'Version is required.\n'
      continue
    fi

    if ! is_valid_version "$new_version"; then
      printf 'Use semantic version format like 1.2.3.\n'
      continue
    fi

    if [[ "$new_version" == "$current_version" ]]; then
      printf 'New version must be different from the current version.\n'
      continue
    fi

    printf '%s\n' "$new_version"
    return
  done
}

current_app_version="$(read_json_value "$APP_JSON_PATH" "expo.version")" \
  || fail '`app.json` is missing a valid `expo.version` value.'
current_package_version="$(read_json_value "$PACKAGE_JSON_PATH" "version")" \
  || fail '`package.json` is missing a valid `version` value.'
app_version_source="$(read_json_value "$EAS_JSON_PATH" "cli.appVersionSource" 2>/dev/null || printf 'local')"
production_auto_increment="$(read_json_value "$EAS_JSON_PATH" "build.production.autoIncrement" 2>/dev/null || printf 'false')"

is_valid_version "$current_app_version" || fail '`app.json` is missing a valid `expo.version` value.'
is_valid_version "$current_package_version" || fail '`package.json` is missing a valid `version` value.'

if [[ "$current_app_version" != "$current_package_version" ]]; then
  fail "Version mismatch detected: app.json=$current_app_version, package.json=$current_package_version. Fix that before building."
fi

printf 'Current version: %s\n' "$current_app_version"
printf 'EAS appVersionSource: %s\n' "$app_version_source"

if [[ "$app_version_source" == "remote" ]]; then
  if [[ "$production_auto_increment" == "true" ]]; then
    printf 'Production native build numbers are auto-incremented by EAS remotely.\n'
  else
    printf 'Native build numbers are managed remotely by EAS.\n'
  fi
fi

new_version="$(prompt_for_version "$current_app_version")"

printf '\nUpdating package version to %s...\n' "$new_version"
npm version --no-git-tag-version "$new_version"

write_app_version "$new_version"

printf '\nUpdated version fields:\n'
printf -- '- package.json -> %s\n' "$new_version"
printf -- '- package-lock.json -> %s\n' "$new_version"
printf -- '- app.json -> %s\n' "$new_version"

printf '\nStarting EAS build. Apple credential prompts will appear interactively if needed.\n\n'
eas build -p all
