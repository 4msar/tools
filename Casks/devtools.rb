# Homebrew cask for the DevTools desktop app.
#   brew tap 4msar/tools https://github.com/4msar/tools
#   brew install --cask devtools
# version and sha256 are updated by .github/workflows/homebrew.yml when a desktop release is published.
cask "devtools" do
  arch arm: "aarch64", intel: "x64"

  version "1.0.10"
  sha256 arm:   "a20878fa05f0cf519cc22df1dc4e72590741982f76f9d671dc267c745e53ef28",
         intel: "57e3669c393fc5da03cb5a259ef83b76386d3ecf35801c6cb55a0b2e4a7c4dc9"

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
  depends_on macos: ">= :big_sur"

  app "DevTools.app"

  zap trash: [
    "~/Library/Application Support/dev.msar.devtools",
    "~/Library/Caches/dev.msar.devtools",
    "~/Library/LaunchAgents/DevTools.plist",
    "~/Library/Preferences/dev.msar.devtools.plist",
    "~/Library/Saved Application State/dev.msar.devtools.savedState",
    "~/Library/WebKit/dev.msar.devtools",
  ]
end
