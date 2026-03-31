# Codemagic iOS Build Setup

## Files

- `codemagic.yaml` — CI/CD workflow config (project root)
- `app.json` — updated with `ios.bundleIdentifier: com.tompkins.breedwise`

## Setup Steps

### 1. Update email in codemagic.yaml
Replace `YOUR_EMAIL_HERE` with your email address.

### 2. Create an App Store Connect API Key
- Go to **App Store Connect → Users and Access → Integrations → App Store Connect API**
- Click `+`, give it **App Manager** role
- Download the `.p8` file — you only get one chance
- Note the **Key ID** and **Issuer ID**

### 3. Add the API key to Codemagic
- Go to **Codemagic → Teams → Integrations → App Store Connect**
- Add the key, name it exactly **`codemagic`** (that's what the yaml references)
- Codemagic will use it to auto-generate your signing certificate and provisioning profile

### 4. Register your bundle ID in Apple Developer portal
- Go to **developer.apple.com → Certificates, IDs & Profiles → Identifiers**
- Register `com.tompkins.breedwise` as an App ID

### 5. Connect repo and trigger build
- In Codemagic dashboard, add your GitHub repo
- It will detect `codemagic.yaml` automatically
- Trigger the `React Native iOS` workflow

## Troubleshooting

**Build IPA fails with workspace-not-found error:**
`expo prebuild` generates the workspace name from the app name. Check the build logs for the actual filename and update `XCODE_WORKSPACE` and `XCODE_SCHEME` in `codemagic.yaml` accordingly.
