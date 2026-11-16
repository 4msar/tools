// .gitignore templates, shared by the tool page and the chat assistant.
export interface Tpl { id: string; name: string; group: "Languages" | "Frameworks" | "Tools" | "Editors" | "OS"; rules: string }

export const T: Tpl[] = [
    { id: "node", name: "Node.js", group: "Languages", rules: "node_modules/\nnpm-debug.log*\nyarn-debug.log*\nyarn-error.log*\npnpm-debug.log*\n.pnpm-store/\n.npm/\n.yarn/cache\n.yarn/unplugged\n.yarn/install-state.gz\n.pnp.*\ndist/\nbuild/\ncoverage/\n.nyc_output/\n*.tsbuildinfo\n.eslintcache\n.env\n.env.*\n!.env.example" },
    { id: "python", name: "Python", group: "Languages", rules: "__pycache__/\n*.py[cod]\n*$py.class\n*.so\n.Python\nbuild/\ndist/\n*.egg-info/\n.eggs/\n.venv/\nvenv/\nenv/\n.pytest_cache/\n.mypy_cache/\n.ruff_cache/\n.tox/\n.coverage\nhtmlcov/\n.ipynb_checkpoints/\n.env" },
    { id: "java", name: "Java", group: "Languages", rules: "*.class\n*.jar\n*.war\n*.ear\n*.log\nhs_err_pid*\ntarget/\nbuild/\n.gradle/\n!gradle/wrapper/gradle-wrapper.jar\n.mvn/timing.properties\nout/" },
    { id: "go", name: "Go", group: "Languages", rules: "*.exe\n*.exe~\n*.dll\n*.so\n*.dylib\n*.test\n*.out\ngo.work\ngo.work.sum\nvendor/\nbin/" },
    { id: "rust", name: "Rust", group: "Languages", rules: "target/\n**/*.rs.bk\n*.pdb\n# Keep Cargo.lock for binaries; ignore it for libraries\n# Cargo.lock" },
    { id: "php", name: "PHP / Composer", group: "Languages", rules: "vendor/\ncomposer.phar\n.phpunit.result.cache\n.phpunit.cache/\n.php-cs-fixer.cache\n.env" },
    { id: "ruby", name: "Ruby", group: "Languages", rules: "*.gem\n*.rbc\n.bundle/\nvendor/bundle/\nlog/\ntmp/\ncoverage/\n.byebug_history\n.env" },
    { id: "dotnet", name: "C# / .NET", group: "Languages", rules: "bin/\nobj/\n*.user\n*.suo\n.vs/\n*.nupkg\nTestResults/\npackages/\n*.DotSettings.user" },
    { id: "cpp", name: "C / C++", group: "Languages", rules: "*.o\n*.obj\n*.a\n*.lib\n*.so\n*.dylib\n*.dll\n*.exe\n*.out\n*.gch\n*.pch\nbuild/\ncmake-build-*/\nCMakeCache.txt\nCMakeFiles/\ncompile_commands.json" },
    { id: "swift", name: "Swift / Xcode", group: "Languages", rules: "xcuserdata/\nDerivedData/\n*.xcuserstate\n.build/\n.swiftpm/\nPods/\nCarthage/Build/\n*.ipa\n*.dSYM.zip\n*.dSYM" },
    { id: "kotlin", name: "Kotlin / Android", group: "Languages", rules: "*.iml\n.gradle/\nlocal.properties\nbuild/\ncaptures/\n.externalNativeBuild/\n.cxx/\n*.apk\n*.aab\n*.keystore\n!debug.keystore" },
    { id: "dart", name: "Dart / Flutter", group: "Languages", rules: ".dart_tool/\n.packages\n.pub-cache/\n.pub/\nbuild/\n.flutter-plugins\n.flutter-plugins-dependencies\n*.g.dart\n*.freezed.dart" },

    { id: "react", name: "React / Vite", group: "Frameworks", rules: "node_modules/\ndist/\ndist-ssr/\n*.local\n.vite/\ncoverage/" },
    { id: "next", name: "Next.js", group: "Frameworks", rules: "node_modules/\n.next/\nout/\nnext-env.d.ts\n.vercel\n*.tsbuildinfo\n.env*.local" },
    { id: "vue", name: "Vue / Nuxt", group: "Frameworks", rules: "node_modules/\ndist/\n.nuxt/\n.output/\n.nitro/\n.cache/\n*.local" },
    { id: "svelte", name: "SvelteKit", group: "Frameworks", rules: "node_modules/\n.svelte-kit/\nbuild/\n.output/\nvite.config.js.timestamp-*\nvite.config.ts.timestamp-*" },
    { id: "angular", name: "Angular", group: "Frameworks", rules: "node_modules/\ndist/\ntmp/\nout-tsc/\n.angular/cache\n.sass-cache/\ncoverage/" },
    { id: "laravel", name: "Laravel", group: "Frameworks", rules: "/vendor/\n/node_modules/\n/public/build\n/public/hot\n/public/storage\n/storage/*.key\n/storage/pail\n.env\n.env.backup\n.env.production\n.phpunit.result.cache\nHomestead.json\nHomestead.yaml\nauth.json\nnpm-debug.log" },
    { id: "django", name: "Django", group: "Frameworks", rules: "*.log\n*.pot\n*.pyc\n__pycache__/\nlocal_settings.py\ndb.sqlite3\ndb.sqlite3-journal\nmedia/\nstaticfiles/" },
    { id: "rails", name: "Rails", group: "Frameworks", rules: "/.bundle\n/log/*\n/tmp/*\n!/log/.keep\n!/tmp/.keep\n/storage/*\n!/storage/.keep\n/public/assets\n/config/master.key\n/config/credentials/*.key\n/node_modules" },
    { id: "unity", name: "Unity", group: "Frameworks", rules: "/[Ll]ibrary/\n/[Tt]emp/\n/[Oo]bj/\n/[Bb]uild/\n/[Bb]uilds/\n/[Ll]ogs/\n/[Uu]ser[Ss]ettings/\n*.csproj\n*.unityproj\n*.sln\n*.pidb\n*.booproj\n*.apk\n*.unitypackage" },

    { id: "env", name: "Secrets & env files", group: "Tools", rules: ".env\n.env.*\n!.env.example\n*.pem\n*.key\n*.p12\n*.pfx\nsecrets.*\n.secrets/\ncredentials.json" },
    { id: "docker", name: "Docker", group: "Tools", rules: "docker-compose.override.yml\ncompose.override.yaml\n.docker/\n*.pid" },
    { id: "terraform", name: "Terraform", group: "Tools", rules: ".terraform/\n*.tfstate\n*.tfstate.*\ncrash.log\ncrash.*.log\n*.tfvars\n*.tfvars.json\noverride.tf\noverride.tf.json\n*_override.tf\n.terraformrc\nterraform.rc" },
    { id: "logs", name: "Logs & temp files", group: "Tools", rules: "*.log\nlogs/\n*.tmp\n*.temp\n*.bak\n*.swp\n*~\ntmp/\n.cache/" },
    { id: "archives", name: "Archives & dumps", group: "Tools", rules: "*.zip\n*.tar\n*.tar.gz\n*.tgz\n*.rar\n*.7z\n*.sql\n*.sqlite\n*.dump" },
    { id: "ai", name: "AI coding tools", group: "Tools", rules: ".claude/settings.local.json\n.cursor/\n.aider*\n.continue/\n.codeium/" },

    { id: "vscode", name: "VS Code", group: "Editors", rules: ".vscode/*\n!.vscode/settings.json\n!.vscode/tasks.json\n!.vscode/launch.json\n!.vscode/extensions.json\n*.code-workspace\n.history/" },
    { id: "jetbrains", name: "JetBrains IDEs", group: "Editors", rules: ".idea/\n*.iws\n*.iml\n*.ipr\nout/\n.idea_modules/\ncmake-build-*/" },
    { id: "vim", name: "Vim / Emacs", group: "Editors", rules: "[._]*.s[a-v][a-z]\n[._]*.sw[a-p]\nSession.vim\n.netrwhist\ntags\n\\#*\\#\n.\\#*\n*.elc" },

    { id: "macos", name: "macOS", group: "OS", rules: ".DS_Store\n.AppleDouble\n.LSOverride\n._*\n.Spotlight-V100\n.Trashes\n.fseventsd" },
    { id: "windows", name: "Windows", group: "OS", rules: "Thumbs.db\nThumbs.db:encryptable\nehthumbs.db\n[Dd]esktop.ini\n$RECYCLE.BIN/\n*.lnk" },
    { id: "linux", name: "Linux", group: "OS", rules: "*~\n.fuse_hidden*\n.directory\n.Trash-*\n.nfs*" },
];
