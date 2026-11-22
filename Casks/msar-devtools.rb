# Homebrew cask for the DevTools desktop app.
#   brew tap 4msar/tools https://github.com/4msar/tools
#   brew trust --cask 4msar/tools/msar-devtools
#   brew install --cask 4msar/tools/msar-devtools
# The token is "msar-devtools" because homebrew/cask already has an unrelated "devtools" cask.
# version and sha256 are updated by .github/workflows/homebrew.yml when a desktop release is published.
cask "msar-devtools" do
  arch arm: "aarch64", intel: "x64"

  version "1.0.11"
  sha256 arm:   "fcf3d3e1acdf6c8221d3a9811930cc8044c38db43af88dd85b188fa928c594cc",
         intel: "7f06edc41b587f4be723fa75a601fa41bad8a9d8700a99dbc24537e8e4a36979"

  url "https://github.com/4msar/tools/releases/download/desktop-v#{version}/DevTools_#{version}_#{arch}.dmg"
  name "DevTools"
  desc "Developer tools that run entirely on your machine"
  homepage "https://tools.msar.me"

  livecheck do
    url :url
    regex(/^desktop-v?(\d+(?:\.\d+)+)$/i)
    strategy :github_latest
  end

  # The app updates itself (Settings → Updates), so brew upgrade leaves it alone unless --greedy.
  auto_updates true
  depends_on macos: :big_sur

  app "DevTools.app"

  caveats <<~EOS
    DevTools isn't notarized by Apple yet. The first time you open it, macOS says it
    can't verify the app: click Done, then go to System Settings → Privacy & Security
    and click "Open Anyway". You only need to do this once.
  EOS

  zap trash: [
    "~/Library/Application Support/dev.msar.devtools",
    "~/Library/Caches/dev.msar.devtools",
    "~/Library/LaunchAgents/DevTools.plist",
    "~/Library/Preferences/dev.msar.devtools.plist",
    "~/Library/Saved Application State/dev.msar.devtools.savedState",
    "~/Library/WebKit/dev.msar.devtools",
  ]
end
